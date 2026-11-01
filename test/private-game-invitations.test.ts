import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { invitationPath } from '../src/lib/social/invitation-path';

test('Invitation privée : message atomique, confidentiel et impossible à fabriquer avec du texte', async t => {
  const db = new PGlite();
  const a = randomUUID(), b = randomUUID(), outsider = randomUUID();
  const as = (id: string) => db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  const invite = async () => { await as(a); return (await db.query<{ id: string }>("select send_game_invitation($1,'president','AUDIT123') as id", [b])).rows[0].id; };
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
      create schema auth;create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}');
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      create publication supabase_realtime;`);
    for (const name of ['20261025000000_platform_core.sql','20261026030000_social_core.sql','20261026040000_direct_messages.sql',
      '20261101020000_direct_game_invitations.sql','20261101030000_private_game_registry.sql','20261101040000_game_invitation_private_messages.sql']) {
      await db.exec(await readFile(new URL(`../supabase/migrations/${name}`, import.meta.url),'utf8'));
    }
    await db.query("insert into auth.users(id,raw_user_meta_data) values($1,'{\"username\":\"Alice\"}'),($2,'{\"username\":\"Bob\"}'),($3,'{\"username\":\"Charlie\"}')",[a,b,outsider]);
    await db.query("insert into friendships(requester_id,addressee_id,status) values($1,$2,'accepted')",[a,b]);
    await db.query("insert into room_registry(game_slug,room_code,instance_key,refreshed_at,capacity,player_count) values('president','AUDIT123','instance-1',now(),8,1)");
    await db.query("insert into game_room_memberships(user_id,game_slug,room_code,instance_key,sealed_session) values($1,'president','AUDIT123','instance-1','encrypted')",[a]);
    const id = await invite();
    await t.test('une invitation crée exactement un MP contenant le nom et le jeu, sans code de salon', async () => {
      const rows = (await db.query<{ from_user_id:string;to_user_id:string;body:string;read_at:string|null;invitation_id:string }>('select * from direct_messages')).rows;
      assert.equal(rows.length,1);
      assert.equal(rows[0].from_user_id,a); assert.equal(rows[0].to_user_id,b);
      assert.equal(rows[0].invitation_id,id); assert.equal(rows[0].read_at,null);
      assert.equal(rows[0].body,'Alice t’invite à rejoindre sa partie de Président.');
      assert.equal(rows[0].body.includes('AUDIT123'),false);
      await assert.rejects(db.query('insert into direct_messages(from_user_id,to_user_id,body,invitation_id) values($1,$2,$3,$4)',[a,b,'doublon',id]),/unique/);
    });
    await t.test('le message est non lu pour le destinataire, puis peut être marqué lu', async () => {
      await as(b);
      assert.equal(Number((await db.query<{unread:number}>('select * from unread_direct_message_counts()')).rows[0].unread),1);
      await db.query('select mark_direct_messages_read($1)',[a]);
      assert.equal((await db.query('select * from unread_direct_message_counts()')).rows.length,0);
    });
    await t.test('un troisième compte ne lit pas la conversation et ne peut pas fabriquer un bouton', async () => {
      await db.exec('grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;grant select,insert on direct_messages to authenticated');
      await as(outsider); await db.exec('set role authenticated');
      try {
        assert.equal((await db.query('select * from direct_messages')).rows.length,0);
        await assert.rejects(db.query('insert into direct_messages(from_user_id,to_user_id,body,invitation_id) values($1,$2,$3,$4)',[outsider,b,'faux',id]),/row-level security/);
      } finally { await db.exec('reset role'); }
    });
    await t.test('un texte copié dans un message ordinaire ne crée pas une action rejoindre', async () => {
      await as(a);
      const result = await db.query<{invitation_id:string|null}>('select (send_direct_message($1,$2)).*',[b,'Alice t’invite à rejoindre sa partie de Président.']);
      assert.equal(result.rows[0].invitation_id,null);
    });
    await t.test('un nouvel envoi remplace l’ancienne invitation et ajoute son propre MP', async () => {
      const next = await invite(); assert.notEqual(next,id);
      assert.equal((await db.query<{status:string}>('select status from game_invitations where id=$1',[id])).rows[0].status,'cancelled');
      assert.equal((await db.query('select * from direct_messages where invitation_id is not null')).rows.length,2);
    });
    await t.test('un salon complet ou un destinataire non ami ne produit aucun MP parasite', async () => {
      const count = (await db.query('select id from direct_messages')).rows.length;
      await db.exec("update room_registry set player_count=8 where room_code='AUDIT123'");
      await assert.rejects(invite(),/complet/);
      await as(a); await assert.rejects(db.query("select send_game_invitation($1,'president',null)",[outsider]),/amis/);
      assert.equal((await db.query('select id from direct_messages')).rows.length,count);
    });
    await t.test('le bouton vise l’admission sécurisée, pas un code saisi ou un lien utilisateur', () => {
      assert.equal(invitationPath({status:'accepted',game_slug:'president',room_code:'AUDIT123',invitation_id:id}),`/play/president?invitation=${id}`);
      assert.equal(invitationPath({status:'accepted',game_slug:'president',room_code:null}),'/play/president');
    });
  } finally { await db.close(); }
});
