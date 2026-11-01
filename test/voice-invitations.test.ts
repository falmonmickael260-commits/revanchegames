import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

test("Invitations vocales : MP authentique, privé, limité et réservé au serveur", async t => {
  const db = new PGlite();
  const a = randomUUID(), b = randomUUID(), c = randomUUID();
  const room = `rg-social-${a}`;
  const invite = (target = b, sid = "RM_audit") => db.query<{id:string}>("select send_verified_voice_invitation($1,$2,$3,$4,'Amis') id", [a, target, room, sid]);
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}');
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      create publication supabase_realtime;`);
    for (const name of ['20261025000000_platform_core.sql','20261026030000_social_core.sql','20261026040000_direct_messages.sql','20261101050000_voice_private_invitations.sql']) {
      await db.exec(await readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8'));
    }
    await db.query("insert into auth.users(id,raw_user_meta_data) values($1,'{\"username\":\"Alice\"}'),($2,'{\"username\":\"Bob\"}'),($3,'{\"username\":\"Charlie\"}')", [a,b,c]);
    await db.query("insert into friendships(requester_id,addressee_id,status) values($1,$2,'accepted')", [a,b]);
    await t.test("le serveur écrit un MP lié à l’instance de la salle avec expiration", async () => {
      const id = (await invite()).rows[0].id;
      const row = (await db.query<{body:string;voice_room_id:string;voice_room_sid:string;voice_expires_at:Date}>("select * from direct_messages where id=$1", [id])).rows[0];
      assert.equal(row.voice_room_id, room); assert.equal(row.voice_room_sid, "RM_audit");
      assert.match(row.body, /Alice.*salon vocal/); assert.ok(new Date(row.voice_expires_at).getTime() > Date.now());
    });
    await t.test("les répétitions et les non-amis sont refusés sans MP parasite", async () => {
      await assert.rejects(invite(), /déjà envoyée/);
      await assert.rejects(invite(c), /réservée aux amis/);
      assert.equal((await db.query("select id from direct_messages")).rows.length, 1);
    });
    await t.test("un utilisateur ne peut pas certifier une salle ni lire le MP d’un autre", async () => {
      await db.exec("grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;grant select,insert on direct_messages to authenticated");
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [c]);
      await db.exec("set role authenticated");
      try {
        assert.equal((await db.query("select * from direct_messages")).rows.length, 0);
        await assert.rejects(invite(c, "RM_forged"), /permission denied/);
        await assert.rejects(db.query("insert into direct_messages(from_user_id,to_user_id,body,voice_room_id,voice_room_sid,voice_expires_at) values($1,$2,'faux',$3,'RM_fake',now())", [c,b,room]), /row-level security/);
      } finally { await db.exec("reset role"); }
    });
    await t.test("un message normal ne produit jamais une action vocale", async () => {
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [a]);
      const row = (await db.query<{voice_room_id:string|null}>("select (send_direct_message($1,'Invitation copiée')).*", [b])).rows[0];
      assert.equal(row.voice_room_id, null);
    });
    await t.test("un blocage empêche les nouvelles invitations", async () => {
      await db.query("update friendships set status='blocked',blocked_by=$1", [a]);
      await assert.rejects(invite(b, "RM_new"), /réservée aux amis/);
    });
  } finally { await db.close(); }
});
