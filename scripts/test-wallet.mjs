import { PGlite } from '@electric-sql/pglite';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

const db = new PGlite();
let checks = 0;
const check = (name, fn) => Promise.resolve().then(fn).then(() => { checks++; console.log(`✓ ${name}`); });
const query = (sql, args = []) => db.query(sql, args);
const sql = async (file) => db.exec(await readFile(new URL(`../supabase/migrations/${file}`, import.meta.url), 'utf8'));
const balance = async (user) => Number((await query('select balance_coins from wallet_accounts where user_id=$1', [user])).rows[0]?.balance_coins ?? 0);
const user = randomUUID(), loser = randomUUID(), legacy = randomUUID(), poor = randomUUID();
const login = async (id) => query("select set_config('request.jwt.claim.sub', $1, false)", [id]);
const reserve = (id, role = 'hunter', price = 100, request = randomUUID(), room = 'ROOM') => query(
  "select * from reserve_role('la-meute', $1, $2, $3, $4, $5, clock_timestamp()+interval '10 seconds')",
  [room, id, role, price, request]);
try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth;
    create table auth.users (id uuid primary key, raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create publication supabase_realtime;
  `);
  await sql('20261025000000_platform_core.sql');
  await sql('20261031000000_promo_codes.sql');
  await sql('20261031020000_role_reservations.sql');
  await sql('20261031030000_wallet_trigger_fix.sql');
  for (const id of [user, loser, legacy, poor]) await query('insert into auth.users(id) values ($1)', [id]);
  for (const id of [user, loser, legacy]) await query("insert into wallet_ledger(user_id,delta_coins,reason,reference) values ($1,500,'adjustment',$2)", [id, `seed:${id}`]);
  // Historique réel : ancien code utilisé et ancienne réservation déjà débitée.
  await login(legacy);
  await query("select * from redeem_promo_code('REVANCHE1500')");
  await query("select * from reserve_role('la-meute','LEGACY',$1,'hunter',100)", [legacy]);
  await check('ancien débit effectué avant migration', async () => assert.equal(await balance(legacy), 1900));
  await sql('20261031010000_promo_code_rename.sql');
  await check('préflight de production exécuté en lecture seule', async () => db.exec(await readFile(new URL('./sql/production-preflight.sql', import.meta.url), 'utf8')));
  await sql('20261031040000_role_selection_deferred_charge.sql');
  await sql('20261031050000_promo_alias_and_win_rewards.sql');
  await sql('20261031060000_trusted_meute_results.sql');
  await check('postflight de production : schéma, permissions et RLS', async () => db.exec(await readFile(new URL('./sql/production-postflight.sql', import.meta.url), 'utf8')));

  await check('migrations exécutées sans erreur, même avec des utilisations historiques', async () => {
    await assert.rejects(query("select * from redeem_promo_code('REVANCHE1500')"), /déjà utilisé/);
    await query("select cancel_role_reservations('la-meute','LEGACY')");
    assert.equal(await balance(legacy), 2000);
    await query("select cancel_role_reservations('la-meute','LEGACY')");
    assert.equal(await balance(legacy), 2000);
  });
  await check('REVANCHE1500 crédite une fois ; RG1500 partage la même limite', async () => {
    await login(user);
    await query("select * from redeem_promo_code(' revanche1500 ')");
    assert.equal(await balance(user), 2000);
    await assert.rejects(query("select * from redeem_promo_code('RG1500')"), /déjà utilisé/);
    assert.equal(await balance(user), 2000);
  });
  await check('code inexistant et invité refusés sans crédit', async () => {
    await assert.rejects(query("select * from redeem_promo_code('INVALID')"), /invalide/);
    await login('');
    await assert.rejects(query("select * from redeem_promo_code('REVANCHE1500')"), /authentification/);
  });
  const requests = [];
  await check('sept prix contrôlés par SQL ; aucun débit à la demande', async () => {
    const prices = {villager:50,werewolf:100,witch:150,seer:150,black_wolf:200,white_wolf:100,hunter:100};
    for (const [role, price] of Object.entries(prices)) {
      const request = randomUUID(); requests.push(request);
      await reserve(user, role, price, request, role);
      await reserve(user, role, price, request, role); // retry idempotent
      await assert.rejects(reserve(user, role, price+1, randomUUID(), 'bad'), /prix invalide/);
    }
    assert.equal(await balance(user), 2000);
    await assert.rejects(reserve(user, 'unknown', 100), /prix invalide/);
  });
  await check('solde insuffisant et seconde demande du même salon refusés', async () => {
    await assert.rejects(reserve(poor), /solde insuffisant/);
    await assert.rejects(reserve(user, 'hunter', 100, randomUUID(), 'hunter'), /déjà réservée/);
  });
  await check('les autres dépenses respectent le total réservé', async () => {
    await assert.rejects(query("insert into wallet_ledger(user_id,delta_coins,reason,reference) values ($1,-1800,'purchase','overspend')", [user]), /solde insuffisant/);
    assert.equal(await balance(user), 2000);
  });
  await check('une attribution débite exactement une fois ; les perdants ne sont pas débités', async () => {
    const winnerReq = requests.at(-1);
    await reserve(loser, 'hunter', 100, randomUUID(), 'hunter');
    await query("select resolve_role_reservations('la-meute','hunter',array[$1]::uuid[])", [user]);
    assert.equal(await balance(user), 1900);
    assert.equal(await balance(loser), 500);
    await query("select resolve_role_reservations('la-meute','hunter',array[$1]::uuid[],array[$2]::uuid[])", [user,winnerReq]);
    assert.equal(await balance(user), 1900);
  });
  await check('annulation avant réservation bloque une réponse réseau tardive', async () => {
    const request = randomUUID();
    await query('select cancel_role_reservation($1)', [request]);
    await assert.rejects(reserve(user,'hunter',100,request,'late'), /sélection terminée/);
  });
  await check('demande après deadline refusée', async () => {
    await assert.rejects(query("select reserve_role('la-meute','expired',$1,'hunter',100,$2,clock_timestamp()-interval '1 second')",[user,randomUUID()]), /sélection terminée/);
  });
  await check('résoudre une ancienne manche ne touche pas la nouvelle', async () => {
    const next = randomUUID();
    await reserve(user, 'hunter', 100, next, 'hunter');
    await query("select resolve_role_reservations('la-meute','hunter',array[$1]::uuid[],array[$2]::uuid[])",[user,requests.at(-1)]);
    assert.equal((await query('select status from role_reservations where id=$1',[next])).rows[0].status,'pending');
    await query('select cancel_role_reservation($1)',[next]);
    assert.equal(await balance(user),1900);
  });
  await check('ancienne API bloquée par PostgreSQL, même avec une identité valide', async () => {
    const payload = JSON.stringify([{user_id:user,outcome:'win'}]);
    await assert.rejects(query("select record_game_result('la-meute','forged-old-api','FORGED',null,$1::jsonb)",[payload]), /serveur de confiance/);
    assert.equal((await query("select count(*)::int as n from game_results where idempotency_key='forged-old-api'")).rows[0].n,0);
  });
  await check('50 pièces par gagnant connecté, zéro pour perdant/invité/nul, retry sans double crédit', async () => {
    const payload = JSON.stringify([{user_id:user,outcome:'win'},{user_id:loser,outcome:'loss'},{user_id:poor,outcome:'draw'},{guest_label:'Invité',outcome:'win'}]);
    for (let i=0;i<2;i++) await query("select record_la_meute_result('test-win','WIN',null,$1::jsonb)",[payload]);
    assert.equal(await balance(user),1950); assert.equal(await balance(loser),500); assert.equal(await balance(poor),0);
    await query("select record_game_result('kilomax','test-other','OTHER',null,$1::jsonb)",[payload]);
    assert.equal(await balance(user),1950);
  });
  await check('fonctions financières réservées au serveur ; RLS active', async () => {
    const signatures = ['reserve_role(text,text,uuid,text,bigint,uuid,timestamptz)','resolve_role_reservations(text,text,uuid[],uuid[])','cancel_role_reservation(uuid)','cancel_role_reservations(text,text)','record_game_result(text,text,text,jsonb,jsonb)','record_la_meute_result(text,text,jsonb,jsonb)'];
    for (const fn of signatures) {
      for (const role of ['anon','authenticated']) assert.equal((await query("select has_function_privilege($1,$2,'EXECUTE') as allowed",[role,fn])).rows[0].allowed,false);
      assert.equal((await query("select has_function_privilege('service_role',$1,'EXECUTE') as allowed",[fn])).rows[0].allowed,true);
    }
    assert.equal((await query("select relrowsecurity from pg_class where oid='wallet_accounts'::regclass")).rows[0].relrowsecurity,true);
  });
  console.log(`${checks} tests PostgreSQL réussis (PGlite).`);
} finally { await db.close(); }
