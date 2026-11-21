import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';

test('Kilomax debits the platform wallet once per vehicle and chest', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon;
      create role authenticated;
      create role service_role bypassrls;
      create schema auth;
      create table auth.users(id uuid primary key, raw_user_meta_data jsonb default '{}');
      create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    `);
    for (const file of ['20261025000000_platform_core', '20261031030000_wallet_trigger_fix', '20261121112123_kilomax_shop']) {
      await db.exec(await readFile(new URL(`../supabase/migrations/${file}.sql`, import.meta.url), 'utf8'));
    }
    const account = randomUUID();
    const other = randomUUID();
    await db.query('insert into auth.users(id) values ($1),($2)', [account, other]);
    await db.query("insert into wallet_ledger(user_id,delta_coins,reason) values ($1,1000,'reward')", [account]);
    const shop = async (user: string, action: string, item?: string, price?: number, match?: string, player?: string) =>
      (await db.query<{ data: { error?: string; balance?: number; owned?: string[]; receipt?: { id: string; reward: string } } }>(
        'select kilomax_shop($1,$2,$3,$4,$5,$6) as data', [user, action, item ?? null, match ?? null, player ?? null, price ?? null],
      )).rows[0].data;
    assert.deepEqual((await shop(other,'catalog')).owned, []);
    assert.equal((await shop(other,'vehicle','gt-circuit',500)).error,'insufficient_balance');
    assert.equal((await shop(account,'vehicle','gt-circuit',300)).error,'price_changed');
    assert.deepEqual((await shop(account,'vehicle','gt-circuit',500)).owned,['gt-circuit']);
    assert.equal((await shop(account,'vehicle','gt-circuit',500)).balance,500);
    const paid = await shop(account,'chest','repair',300,'ENR-TEST:123','p-1');
    assert.equal(paid.balance,200);
    assert.equal(paid.receipt?.reward,'repair');
    const retry = await shop(account,'chest','purple',300,'ENR-TEST:123','p-1');
    assert.deepEqual(retry,paid);
    const loaded = await shop(account,'catalog',undefined,undefined,'ENR-TEST:123','p-1');
    assert.deepEqual(loaded.receipt,paid.receipt);
    assert.equal((await shop(account,'chest','purple',300,'ENR-TEST:124','p-1')).error,'insufficient_balance');
    assert.equal((await shop(other,'catalog',undefined,undefined,'ENR-TEST:123','p-1')).receipt,null);
    await db.exec('set role authenticated');
    await assert.rejects(shop(account,'catalog'),/permission denied/);
  } finally { await db.close(); }
});
