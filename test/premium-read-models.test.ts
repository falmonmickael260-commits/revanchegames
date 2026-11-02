import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
const a="11111111-1111-4111-8111-111111111111",b="22222222-2222-4222-8222-222222222222",c="33333333-3333-4333-8333-333333333333",d="44444444-4444-4444-8444-444444444444";
test("Refonte : popularité réelle et boîte de réception strictement privée",async t=>{
 const db=new PGlite();
 try{
  await db.exec(`create role anon;create role authenticated;create schema auth;
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   create table profiles(id uuid primary key,username text,avatar_url text);
   create table friendships(a uuid,b uuid);
   create function are_friends(x uuid,y uuid) returns boolean language sql stable as $$select exists(select 1 from friendships where (a=x and b=y) or (a=y and b=x))$$;
   create function is_blocked_between(x uuid,y uuid) returns boolean language sql stable as $$select false$$;
   create table direct_messages(id uuid default gen_random_uuid(),from_user_id uuid,to_user_id uuid,body text,created_at timestamptz default now(),read_at timestamptz);
   create table game_stats(user_id uuid,game_slug text,games_played bigint);
   insert into profiles values('${a}','Alice','private-a'),('${b}','Bob','private-b'),('${c}','Charlie','private-c'),('${d}','Diane','private-d');
   insert into friendships values('${a}','${b}');
   insert into direct_messages(from_user_id,to_user_id,body,created_at) values('${a}','${b}','Salut Bob',now()-interval '1 minute'),('${b}','${a}','Salut Alice',now()),('${c}','${d}','Secret CD',now());
   insert into game_stats values('${a}','president',6),('${b}','president',4),('${c}','10000',2);`);
  await db.exec(await readFile(new URL('../supabase/migrations/20261102010000_public_game_popularity.sql',import.meta.url),'utf8'));
  await t.test("l’agrégat public n’expose que les jeux et participations réellement enregistrées",async()=>{
   await db.exec('set role anon');try{const result=await db.query<{game_slug:string;games_played:number}>('select * from game_popularity()');assert.equal(result.rows[0].game_slug,'president');assert.equal(Number(result.rows[0].games_played),10);assert.deepEqual(Object.keys(result.rows[0]).sort(),['game_slug','games_played']);await assert.rejects(db.query('select * from direct_conversations()'),/permission denied/);}finally{await db.exec('reset role');}
  });
  await t.test("un compte ne reçoit que ses conversations et le vrai compteur de non-lus",async()=>{
   await db.query("select set_config('request.jwt.claim.sub',$1,false)",[b]);await db.exec('set role authenticated');try{const rows=(await db.query<{other_id:string;username:string;unread:number;last_body:string}>('select * from direct_conversations()')).rows;assert.equal(rows.length,1);assert.equal(rows[0].other_id,a);assert.equal(rows[0].username,'Alice');assert.equal(Number(rows[0].unread),1);assert.equal(rows[0].last_body,'Salut Alice');assert.equal(JSON.stringify(rows).includes('Secret CD'),false);}finally{await db.exec('reset role');}
  });
  await t.test("un ancien contact ne révèle ni le profil courant ni sa photo",async()=>{
   await db.exec('delete from friendships');const row=(await db.query<{username:string;avatar_url:string|null}>('select * from direct_conversations()')).rows[0];assert.equal(row.username,'Conversation');assert.equal(row.avatar_url,null);
  });
  await t.test("l’absence d’identité donne une boîte vide sans modifier aucun message",async()=>{
   await db.query("select set_config('request.jwt.claim.sub','',false)");assert.equal((await db.query('select * from direct_conversations()')).rows.length,0);assert.equal((await db.query('select * from direct_messages')).rows.length,3);
  });
 }finally{await db.close();}
});
