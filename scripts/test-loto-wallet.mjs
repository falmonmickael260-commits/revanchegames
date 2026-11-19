import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const db = new PGlite();
const one = randomUUID();
const two = randomUUID();
const room = randomUUID();
const order = randomUUID();
const apply = async (file) => db.exec(await readFile(new URL(`../supabase/migrations/${file}`, import.meta.url), "utf8"));
const run = async (action, id, uid, price, quantity, request, winners) => {
  const { rows } = await db.query("select loto_wallet($1,$2,$3,$4,$5,$6,$7) result", [
    action, id ?? null, uid ?? null, price ?? null, quantity ?? null, request ?? null, winners ?? null,
  ]);
  return rows[0].result;
};
try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth;
    create table auth.users(id uuid primary key, raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create publication supabase_realtime;
  `);
  await apply("20261025000000_platform_core.sql");
  await apply("20261031030000_wallet_trigger_fix.sql");
  await apply("20261119162500_loto_wallet.sql");
  for (const user of [one, two]) {
    await db.query("insert into auth.users(id) values ($1)", [user]);
    await db.query("insert into wallet_ledger(user_id, delta_coins, reason) values ($1, 500, 'adjustment')", [user]);
  }

  assert.equal((await run("create", room, one, 100, 3, order)).balance, 200);
  assert.equal((await run("create", room, one, 100, 3, order)).balance, 200);
  assert.equal((await run("buy", room, one, null, 3, randomUUID())).ok, false);
  assert.equal((await run("buy", room, two, null, 1, randomUUID())).balance, 400);
  assert.equal((await run("leave", room, two)).balance, 500);
  assert.equal((await run("leave", room, two)).balance, 500);
  assert.equal((await run("start", room)).ok, false);
  await run("buy", room, two, null, 1, randomUUID());
  assert.equal((await run("start", room)).ok, true);
  assert.equal((await run("buy", room, one, null, 1, randomUUID())).ok, false);
  await assert.rejects(() => run("settle", room, null, null, null, null, [randomUUID(), null, two]), /sans carton/);
  const settle = () => run("settle", room, null, null, null, null, [one, one, two]);
  assert.deepEqual((await settle()).balances, { [one]: 320, [two]: 600 });
  assert.deepEqual((await settle()).balances, { [one]: 320, [two]: 600 });

  const retained = await db.query("select retained_coins from loto_rounds where id=$1", [room]);
  assert.equal(Number(retained.rows[0].retained_coins), 80);

  const expired = randomUUID();
  assert.equal((await run("create", expired, one, 50, 5, randomUUID())).balance, 70);
  await db.query("update loto_rounds set expires_at = now() - interval '1 minute' where id = $1", [expired]);
  await run("sweep");
  await run("sweep");
  assert.equal((await run("balance", null, one)).balance, 320);

  const cancelled = randomUUID();
  assert.equal((await run("create", cancelled, two, 500, 1, randomUUID())).balance, 100);
  assert.equal((await run("cancel", cancelled)).balances[two], 600);
  assert.equal((await run("cancel", cancelled)).balances[two], 600);

  const partial = randomUUID();
  await run("create", partial, one, 100, 1, randomUUID());
  await run("buy", partial, two, null, 2, randomUUID());
  await run("start", partial);
  assert.deepEqual((await run("settle", partial, null, null, null, null, [one, null, null])).balances,
    { [one]: 330, [two]: 530 });

  await db.exec("set role authenticated");
  await assert.rejects(() => run("balance", null, one), /permission denied/);
  console.log("Loto : débit, solde insuffisant, rejouabilité, remboursements, gains, part plateforme et accès vérifiés.");
} finally {
  await db.close();
}
