import { PGlite } from '@electric-sql/pglite';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

const db = new PGlite();
const file = async name => db.exec(await readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8'));
const query = (sql, args = []) => db.query(sql, args);
const sender = randomUUID(), recipient = randomUUID(), stranger = randomUUID();
const send = (gift, quantity = 1, key = randomUUID(), to = recipient) => query(
  "select (public.send_virtual_gift($1,$2,$3,$4,'dm',null,null,$5)).*",
  [sender, to, gift, quantity, key],
);
const balance = async id => Number((await query('select balance_coins from public.wallet_accounts where user_id=$1', [id])).rows[0]?.balance_coins ?? 0);
const rev = async id => Number((await query('select total_rev from public.rev_accounts where user_id=$1', [id])).rows[0]?.total_rev ?? 0);
try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth;
    create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create publication supabase_realtime;
    create schema storage;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
    alter table storage.objects enable row level security;
  `);
  await file('20261025000000_platform_core.sql');
  await file('20261026030000_social_core.sql');
  await file('20261026040000_direct_messages.sql');
  await file('20261031030000_wallet_trigger_fix.sql');
  await file('20261031020000_role_reservations.sql');
  await file('20261031040000_role_selection_deferred_charge.sql');
  await file('20261101000000_stripe_shop.sql');
  await file('20261105000000_virtual_gifts_schema.sql');
  await file('20261105010000_virtual_gifts_transactions.sql');
  await file('20261105020000_virtual_gifts_admin.sql');
  await query('create table public.support_admins(user_id uuid primary key references public.profiles(id))');
  await file('20261105030000_virtual_gifts_presentation_privacy.sql');

  const catalog = (await query('select id,price_coins,rev_points from public.gift_catalog order by price_coins,id')).rows;
  assert.equal(catalog.length, 24);
  assert.deepEqual(Object.entries(Object.groupBy(catalog, gift => gift.price_coins)).map(([price, rows]) => [Number(price), rows.length]),
    [[10,4],[30,4],[50,4],[100,3],[250,3],[500,3],[520,3]]);
  assert.ok(catalog.every(gift => gift.rev_points === gift.price_coins / 2));
  console.log('✓ 24 cadeaux, sept prix exacts et REV fixes');

  for (const [id, username] of [[sender,'LewisTest'],[recipient,'SarahTest'],[stranger,'OtherTest']]) {
    await query('insert into auth.users(id,raw_user_meta_data) values($1,$2)', [id,{username}]);
    await query("update public.profiles set created_at=now()-interval '30 days' where id=$1", [id]);
  }
  await query("insert into public.friendships(requester_id,addressee_id,status) values($1,$2,'accepted')", [sender,recipient]);
  await query('insert into public.support_admins(user_id) values($1)', [sender]);
  await query("insert into public.wallet_ledger(user_id,delta_coins,reason,reference) values($1,2000,'adjustment','test:seed')", [sender]);
  await assert.rejects(send('rose-rouge'), /pas encore activés/);
  assert.equal(await balance(sender), 2000);
  console.log('✓ désactivé par défaut, sans débit');
  await db.exec("update public.gift_settings set gifts_enabled=true,renta_enabled=true,min_account_age_hours=0,cooldown_seconds=0,max_daily_to_recipient=5000;");

  const rose = (await send('rose-rouge')).rows[0];
  assert.equal(Number(rose.total_price), 10);
  assert.equal(Number(rose.total_rev), 5);
  assert.equal(Number(rose.total_reward), 0);
  assert.equal(await balance(sender), 1990);
  assert.equal(await balance(recipient), 0);
  assert.equal(await rev(sender), 0);
  assert.equal(await rev(recipient), 5);
  console.log('✓ 10 pièces : seul le destinataire reçoit 5 REV, aucune renta');

  const thirty = (await send('ourson-calin')).rows[0];
  assert.ok(Number(thirty.total_reward) >= 1 && Number(thirty.total_reward) <= 30);
  assert.equal(await balance(sender), 1960);
  assert.equal(await rev(recipient), 20);
  console.log('✓ 30 pièces : 1 à 30 pièces et 15 REV pour le destinataire');

  const key = randomUUID();
  const diamond = (await send('diamant-violet', 1, key)).rows[0];
  assert.ok(Number(diamond.total_reward) >= 150 && Number(diamond.total_reward) <= 750);
  assert.equal(await balance(sender), 1460);
  assert.equal(await rev(recipient), 270);
  const before = await balance(recipient);
  assert.equal((await send('diamant-violet', 1, key)).rows[0].id, diamond.id);
  assert.equal(await balance(sender), 1460);
  assert.equal(await balance(recipient), before);
  await assert.rejects(send('rose-rouge', 1, key), /déjà/);
  console.log('✓ 500 pièces : 150 à 750, retry idempotent, aucun double crédit');

  const batch = (await send('ourson-royal',5)).rows[0];
  const rolls = (await query('select coins from public.gift_reward_rolls where batch_id=$1 order by ordinal', [batch.id])).rows;
  assert.equal(rolls.length, 5);
  assert.ok(rolls.every(roll => roll.coins >= 30 && roll.coins <= 150));
  assert.equal(rolls.reduce((sum, roll) => sum + roll.coins, 0), Number(batch.total_reward));
  assert.equal(await balance(sender), 960);
  assert.equal(await rev(recipient), 520);
  assert.equal((await query("select quantity from public.gift_collection where recipient_id=$1 and gift_id='ourson-royal'", [recipient])).rows[0].quantity, 5);
  console.log('✓ quantité ×5 : cinq tirages indépendants, débit et REV corrects');

  const count = Number((await query('select count(*)::integer as n from public.gift_send_batches')).rows[0].n);
  await assert.rejects(send('diamant-violet', 3), /insuffisant/);
  await assert.rejects(send('rose-rouge',1,randomUUID(),sender), /invalide/);
  await assert.rejects(send('rose-rouge',1,randomUUID(),stranger), /ami/);
  await query("update public.gift_catalog set active=false where id='rose-rouge'");
  await assert.rejects(send('rose-rouge'), /pas disponible/);
  assert.equal(Number((await query('select count(*)::integer as n from public.gift_send_batches')).rows[0].n), count);
  assert.equal(await balance(sender), 960);
  console.log('✓ solde insuffisant, soi-même, non-ami, cadeau retiré : état inchangé');

  const ledger = (await query("select user_id,reason,delta_coins from public.wallet_ledger where reason in ('gift_purchase','gift_renta') order by created_at")).rows;
  assert.ok(ledger.filter(row => row.user_id === sender).every(row => row.reason === 'gift_purchase' && Number(row.delta_coins) < 0));
  assert.ok(ledger.filter(row => row.user_id === recipient).every(row => row.reason === 'gift_renta' && Number(row.delta_coins) > 0));
  assert.equal((await query('select count(*)::integer as n from public.notifications where kind=$1 and user_id=$2', ['gift_received',recipient])).rows[0].n, 4);
  assert.equal((await query('select count(*)::integer as n from public.direct_messages where gift_batch_id is not null')).rows[0].n, 4);
  assert.equal((await query('select count(*)::integer as n from public.game_results')).rows[0].n, 0);
  console.log('✓ crédits, REV, collection, MP et notifications uniquement aux bons comptes ; XP intact');

  await query("insert into public.role_reservations(game_slug,room_code,user_id,role_key,price_coins,charged) values('la-meute','GIFTTEST',$1,'villager',900,false)", [sender]);
  await assert.rejects(send('ourson-royal'), /solde insuffisant/);
  assert.equal(await balance(sender), 960);
  assert.equal(Number((await query('select count(*)::integer as n from public.gift_send_batches')).rows[0].n), count);
  await query("update public.role_reservations set status='cancelled' where user_id=$1", [sender]);
  await query('insert into public.stripe_wallet_debts(user_id,coins) values($1,100)', [sender]);
  await assert.rejects(send('bonbon-sucre'), /remboursement/);
  assert.equal(await balance(sender), 960);
  console.log('✓ réservation de rôle et dette Stripe bloquent le transfert sans débit partiel');

  await db.exec(`set role authenticated; set request.jwt.claim.sub = '${sender}';`);
  try {
    await assert.rejects(send('bonbon-sucre'), /permission denied/);
    await assert.rejects(query('update public.gift_settings set gifts_enabled=true'), /permission denied/);
    await assert.rejects(query("insert into public.gift_collection(recipient_id,gift_id,quantity) values($1,'bonbon-sucre',1)", [sender]), /permission denied/);
    await assert.rejects(query('select rev_points from public.gift_catalog limit 1'), /permission denied/);
    await assert.rejects(query('select * from public.gift_reward_bands'), /permission denied/);
    await assert.rejects(query('select * from public.gift_send_batches'), /permission denied/);
    await assert.rejects(query('select * from public.gift_reward_rolls'), /permission denied/);
    assert.equal((await query('select * from public.rev_accounts where user_id=$1', [recipient])).rows.length, 0);
    assert.equal((await query('select count(*)::integer as n from public.gift_collection where recipient_id=$1', [recipient])).rows[0].n > 0, true);
    console.log('✓ client authentifié : aucun RPC financier ni écriture directe ; collection en lecture seule');
  } finally { await db.exec('reset role; reset request.jwt.claim.sub;'); }

  await db.exec(`set role authenticated; set request.jwt.claim.sub = '${sender}';`);
  try {
    await assert.rejects(query("select public.gift_admin_apply($1,'band',$2)", [sender, {rule:'thirty',band:1,weight:5}]), /permission denied/);
  } finally { await db.exec('reset role; reset request.jwt.claim.sub;'); }
  const beforeWeight = (await query("select weight from public.gift_reward_bands where rule='thirty' and band=1")).rows[0].weight;
  await query("select public.gift_admin_apply($1,'band',$2)", [sender, {rule:'thirty',band:1,weight:60}]);
  assert.equal((await query("select weight from public.gift_reward_bands where rule='thirty' and band=1")).rows[0].weight, 60);
  const audit = (await query("select before_value,after_value from public.gift_admin_audit where target='band:thirty:1'")).rows[0];
  assert.equal(audit.before_value.weight, beforeWeight);
  assert.equal(audit.after_value.weight, 60);
  await assert.rejects(query("select public.gift_admin_apply($1,'band',$2)", [stranger, {rule:'thirty',band:1,weight:-1}]), /violates check constraint/);
  assert.equal((await query("select count(*)::integer as n from public.gift_admin_audit")).rows[0].n, 1);
  console.log('✓ administration : accès serveur seul, configuration et audit atomiques');

  await query("select public.gift_admin_update_visual($1,'feu-artifice','prestige','Un message personnalisé pour le test.')", [sender]);
  const visual = (await query("select animation_tier,celebration_message from public.gift_catalog where id='feu-artifice'")).rows[0];
  assert.equal(visual.animation_tier, 'prestige');
  assert.equal(visual.celebration_message, 'Un message personnalisé pour le test.');
  assert.equal((await query("select count(*)::integer as n from public.gift_admin_audit where target='gift:feu-artifice' and action='visual'")).rows[0].n, 1);
  console.log('✓ visuels configurables par admin et journalisés ; règles de récompense inchangées');
} finally {
  await db.close();
}
