// Audit isolé de l'existant : aucun réseau, aucun compte ou salon distant.
// Les constats GAP reproduisent des défauts ; ils ne valident pas leur sécurité.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
let checks = 0;
async function check(label, fn) {
  await fn();
  console.log(label);
  checks++;
}
const a = randomUUID(), b = randomUUID(), outsider = randomUUID();
const identity = (uid) => db.query("select set_config('request.jwt.claim.sub',$1,false)", [uid || '']);
async function invite(code) {
  await identity(a);
  return (await db.query("select send_game_invitation($1,'president',$2) as id", [b, code])).rows[0].id;
}
async function accept(id) {
  await identity(b);
  return (await db.query('select * from respond_to_game_invitation($1,true)', [id])).rows[0];
}

try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth;
    create table auth.users(id uuid primary key, raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
    $$;
    create publication supabase_realtime;
  `);
  for (const name of ['20261025000000_platform_core.sql', '20261026030000_social_core.sql']) {
    await db.exec(await readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8'));
  }
  await db.query('insert into auth.users(id) values($1),($2),($3)', [a, b, outsider]);
  await db.query("insert into friendships(requester_id,addressee_id,status) values($1,$2,'accepted')", [a, b]);
  await db.exec('grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated');

  await check('OK — expéditeur non ami refusé', async () => {
    await identity(outsider);
    await assert.rejects(db.query("select send_game_invitation($1,'president','AUDIT')", [b]), /amis/);
  });
  await check('OK — autre destinataire refusé sous le rôle authenticated', async () => {
    const id = await invite('AUDIT');
    await identity(outsider);
    await db.exec('set role authenticated');
    try {
      await assert.rejects(db.query('select * from respond_to_game_invitation($1,true)', [id]), /adressée/);
    } finally { await db.exec('reset role'); }
  });
  await check('OK — invitation expirée refusée', async () => {
    const id = await invite('AUDIT');
    await db.query("update game_invitations set expires_at=now()-interval '1 second' where id=$1", [id]);
    await assert.rejects(accept(id), /expirée/);
  });
  await check('OK — refus enregistré', async () => {
    const id = await invite('AUDIT');
    await identity(b);
    assert.equal((await db.query('select * from respond_to_game_invitation($1,false)', [id])).rows[0].status, 'declined');
  });
  await check('GAP — salon absent du registre malgré tout accepté', async () => {
    const id = await invite('ABSENT');
    assert.equal((await accept(id)).status, 'accepted');
    await assert.rejects(accept(id), /déjà traitée/);
  });
  await db.query("insert into room_registry(game_slug,room_code,capacity,player_count) values('president','AUDIT',2,1)");
  await check('OK — salon rempli entre envoi et acceptation refusé', async () => {
    const id = await invite('AUDIT');
    await db.exec("update room_registry set player_count=2 where room_code='AUDIT'");
    await assert.rejects(accept(id), /complet/);
  });
  await db.exec("update room_registry set player_count=1 where room_code='AUDIT'");
  await check('OK — salon démarré entre envoi et acceptation refusé', async () => {
    const id = await invite('AUDIT');
    await db.exec("update room_registry set status='started' where room_code='AUDIT'");
    await assert.rejects(accept(id), /accepte plus/);
  });
  await db.exec("update room_registry set status='open' where room_code='AUDIT'");
  await check('GAP — invitation acceptée sans réservation ni admission au jeu', async () => {
    const id = await invite('AUDIT');
    assert.equal((await accept(id)).status, 'accepted');
    assert.equal((await db.query("select player_count from room_registry where room_code='AUDIT'")).rows[0].player_count, 1);
  });
  await check('GAP — deuxième identité accepte la dernière place : pas de verrou de capacité partagé', async () => {
    await db.query("insert into friendships(requester_id,addressee_id,status) values($1,$2,'accepted')", [a, outsider]);
    await identity(a);
    const id = (await db.query("select send_game_invitation($1,'president','AUDIT') as id", [outsider])).rows[0].id;
    await identity(outsider);
    assert.equal((await db.query('select * from respond_to_game_invitation($1,true)', [id])).rows[0].status, 'accepted');
  });
  console.log(`${checks} constats reproduits sur PostgreSQL local ; aucune validation navigateur ou compte Supabase réel.`);
} finally {
  await db.close();
}
