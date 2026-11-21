import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';

test('Domirush shop locks unpriced skins and atomically credits a paid skin once', async () => {
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
    for (const file of ['20261025000000_platform_core', '20261031030000_wallet_trigger_fix', '20261121103836_domirush_skins']) {
      await db.exec(await readFile(new URL(`../supabase/migrations/${file}.sql`, import.meta.url), 'utf8'));
    }
    const owner = randomUUID();
    const guest = randomUUID();
    await db.query('insert into auth.users (id) values ($1), ($2)', [owner, guest]);
    await db.query("insert into wallet_ledger (user_id, delta_coins, reason) values ($1, 120, 'reward')", [owner]);

    async function shop(action: string, uid: string | null, skin?: string, expectedPrice?: number) {
      const { rows } = await db.query<{ state: { error?: string; balance?: number; equipped?: string; equippedBoard?: string; prices?: Record<string, number>; owned?: string[] } }>(
        'select domirush_shop($1, $2, $3, $4) as state', [action, uid, skin ?? null, expectedPrice ?? null],
      );
      return rows[0].state;
    }

    assert.equal((await shop('catalog', null)).balance, null);
    assert.equal((await shop('catalog', owner)).balance, 120);
    assert.equal((await shop('buy', owner, 'jade')).error, 'price_pending');
    assert.equal((await shop('equip', owner, 'jade')).error, 'not_owned');

    await db.exec("update domirush_skin_catalog set price_coins = 50 where id = 'jade'");
    assert.equal((await shop('buy', owner, 'jade', 40)).error, 'price_changed');
    assert.equal((await shop('buy', guest, 'jade', 50)).error, 'insufficient_balance');
    assert.equal((await shop('buy', owner, 'jade', 50)).balance, 70);
    assert.equal((await shop('buy', owner, 'jade', 50)).balance, 70);
    assert.equal((await shop('equip', owner, 'jade')).equipped, 'jade');
    assert.equal((await shop('catalog', owner)).equipped, 'jade');
    assert.equal((await shop('equip', owner, 'classic')).equipped, 'classic');
    assert.equal((await shop('catalog', owner)).owned?.length, 1);
    await db.exec(await readFile(new URL('../supabase/migrations/20261121105019_domirush_board_skins.sql', import.meta.url), 'utf8'));
    const catalog = await shop('catalog', owner);
    assert.equal(Object.keys(catalog.prices ?? {}).length, 12);
    assert.ok(Object.values(catalog.prices ?? {}).every(price => price === 500));
    assert.equal((await shop('buy', owner, 'boardroyal', 500)).error, 'insufficient_balance');
    assert.equal((await shop('equip', owner, 'boardroyal')).error, 'not_owned');
    await db.query("insert into wallet_ledger (user_id, delta_coins, reason) values ($1, 1000, 'reward')", [owner]);
    assert.equal((await shop('buy', owner, 'boardroyal', 500)).balance, 570);
    assert.equal((await shop('buy', owner, 'boardroyal', 500)).balance, 570);
    assert.equal((await shop('equip', owner, 'jade')).equipped, 'jade');
    const equipped = await shop('equip', owner, 'boardroyal');
    assert.equal(equipped.equippedBoard, 'boardroyal');
    assert.equal(equipped.equipped, 'jade');
    assert.equal((await shop('equip', owner, 'boardclassic')).equipped, 'jade');
    assert.equal((await shop('catalog', owner)).equippedBoard, 'boardclassic');
    await db.exec('set role authenticated');
    await assert.rejects(shop('buy', owner, 'jade'), /permission denied/);
  } finally {
    await db.close();
  }
});
