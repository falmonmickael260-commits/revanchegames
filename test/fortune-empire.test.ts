import assert from 'node:assert/strict';
import {createHmac,randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {test} from 'node:test';
import {PGlite} from '@electric-sql/pglite';
import {GAMES} from '../src/data/games';
import {isConnectedGame} from '../src/lib/game-connector/protocol';
import {trustedFortuneBody,validateFortuneResult} from '../src/lib/fortune-empire';
import {POST} from '../src/app/api/game/fortune-empire/results/route';
import {POST as publicResult} from '../src/app/api/report-result/route';
const key='isolated-fortune-test-key';
function request(body:unknown,age=0,purpose='result'){
 const raw=JSON.stringify(body),stamp=String(Math.floor(Date.now()/1000)-age);
 const hex=createHmac('sha256',key).update(`rg-fortune-${purpose}-v1.${stamp}.${raw}`).digest('hex');
 return new Request('https://platform.test/api/game/fortune-empire/results',{method:'POST',body:raw,headers:{'x-rg-signature':`${stamp}.${hex}`}});
}
test('Fortune Empire : disponible, NEW, bon lien et invitations activées',()=>{
 const game=GAMES.find(g=>g.id==='fortune-empire')!;assert(game.enabled&&game.newBadge&&game.supportsPlatformInvites);assert.equal(game.url,'https://atlasroyal-production.up.railway.app/');assert.equal(game.players,'2 à 8 joueurs');assert(isConnectedGame(game.id));
});
test('Fortune Empire : seul le serveur peut déclarer un résultat, avec une signature récente et une seule victoire',async()=>{
 const old=process.env.GAME_CONNECTOR_SECRET_FORTUNE_EMPIRE;process.env.GAME_CONNECTOR_SECRET_FORTUNE_EMPIRE=key;
 try{
  const value={game:'fortune-empire',room:'ABCD2',instance:randomUUID(),startedAt:1,endedAt:2,players:[{userId:randomUUID(),name:'Alice',outcome:'win',score:2500,position:1},{userId:null,name:'Invité',outcome:'loss',score:0,position:2}]};
  assert.deepEqual(validateFortuneResult(await trustedFortuneBody(request(value),'result')),value);
  await assert.rejects(trustedFortuneBody(request(value,31),'result'));
  await assert.rejects(trustedFortuneBody(request(value,0,'identity'),'result'));
  assert.throws(()=>validateFortuneResult({...value,players:[value.players[0],{...value.players[1],outcome:'win'}]}));
  assert.throws(()=>validateFortuneResult({...value,players:[value.players[0],{...value.players[1],userId:value.players[0].userId}]}));
  assert.equal((await POST(new Request('http://local/results',{method:'POST',body:'{}'}))).status,403);
  assert.equal((await POST(request({...value,instance:'invalid'}))).status,400);
  assert.equal((await publicResult(new Request('http://local/api/report-result',{method:'POST',body:JSON.stringify({gameSlug:'fortune-empire',outcome:'win',rgToken:'invalid'})}))).status,400);
 }finally{if(old===undefined)delete process.env.GAME_CONNECTOR_SECRET_FORTUNE_EMPIRE;else process.env.GAME_CONNECTOR_SECRET_FORTUNE_EMPIRE=old;}
});
test('Fortune Empire : catalogue, profil et idempotence des résultats réels via les vues existantes',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}');create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;`);
  await db.exec(await readFile(new URL('../supabase/migrations/20261025000000_platform_core.sql',import.meta.url),'utf8'));
  const sql=await readFile(new URL('../supabase/migrations/20261115010000_fortune_empire_catalog.sql',import.meta.url),'utf8');await db.exec(sql);await db.exec(sql);
  const uid=randomUUID();await db.query('insert into auth.users(id) values ($1)',[uid]);
  const players=JSON.stringify([{user_id:uid,outcome:'win',score:2500,position:1},{user_id:null,guest_label:'Bob',outcome:'loss',score:0,position:2}]);
  const call=()=>db.query<{id:string}>("select record_game_result('fortune-empire','fortune-empire:instance-test','ABCD2','{}',$1) as id",[players]);
  const first=await call(),second=await call();assert.equal(first.rows[0].id,second.rows[0].id);
  const stats=(await db.query<Record<string,unknown>>('select * from game_stats where user_id=$1 and game_slug=$2',[uid,'fortune-empire'])).rows[0];
  assert.equal(Number(stats.games_played),1);assert.equal(Number(stats.wins),1);assert.equal(Number(stats.losses),0);
  assert.equal((await db.query('select * from game_result_players')).rows.length,2);
 }finally{await db.close();}
});

test('Fortune Empire : le contexte d’invitation utilise la clé dédiée sans modifier les autres jeux',async()=>{
 const {contextResponse}=await import('../vendor/game-connector/server.mjs');
 const {openGameContext}=await import('../src/lib/game-connector/server');
 const old=process.env.PLATFORM_SHARED_SECRET,previous=process.env.GAME_CONNECTOR_SECRET_FORTUNE_EMPIRE;
 const uid=randomUUID();
 try{
  process.env.PLATFORM_SHARED_SECRET=key;
  const proof={code:'ABCD2',playerId:'native-seat',token:'private-seat-proof'};
  const response=await contextResponse(new Request('http://local/context',{method:'POST',body:JSON.stringify({session:proof,identity:null})}),'fortune-empire',{
   inspect:()=>({code:'ABCD2',instance:randomUUID(),capacity:8,count:1,status:'open',ownerUid:uid}),admit:()=>proof,
  });
  assert.equal(response.status,200);
  process.env.PLATFORM_SHARED_SECRET='legacy-key-for-other-games';process.env.GAME_CONNECTOR_SECRET_FORTUNE_EMPIRE=key;
  const value=openGameContext((await response.json()).context);
  assert.equal(value.game,'fortune-empire');assert.equal(value.uid,uid);assert.deepEqual(value.session,proof);
 }finally{if(old===undefined)delete process.env.PLATFORM_SHARED_SECRET;else process.env.PLATFORM_SHARED_SECRET=old;if(previous===undefined)delete process.env.GAME_CONNECTOR_SECRET_FORTUNE_EMPIRE;else process.env.GAME_CONNECTOR_SECRET_FORTUNE_EMPIRE=previous;}
});
