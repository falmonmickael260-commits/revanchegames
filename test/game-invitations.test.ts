import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { connectorResponse, verifyCommand, contextResponse } from '../vendor/game-connector/server.mjs';
import { openSession, sealSession, openGameContext } from '../src/lib/game-connector/server';

const secret = 'local_connector_test_secret_only';
function request(body: unknown, age = 0) {
  const raw = JSON.stringify(body), timestamp = String(Math.floor(Date.now() / 1000) - age);
  const sig = createHmac('sha256', secret).update(`rg-connector-v1.${timestamp}.${raw}`).digest('hex');
  return new Request('https://game.test/api/platform/connector', { method: 'POST', body: raw, headers: { 'x-rg-signature': `${timestamp}.${sig}` } });
}
test('Connecteur : signature, expiration, audience, intégrité et chiffrement des sessions', async () => {
  const original = process.env.PLATFORM_SHARED_SECRET; process.env.PLATFORM_SHARED_SECRET = secret;
  try {
    const value = { v: 1, game: 'president', operation: 'admit', room: 'ABC123', uid: randomUUID(), name: 'Bob',
      inviter: randomUUID(), invitation: randomUUID(), instance: 'ABC123:1', proof: { code: 'ABC123', token: 'native-secret' } };
    const r = request(value);
    assert.equal(verifyCommand(await r.clone().text(), r.headers.get('x-rg-signature'), 'president').uid, value.uid);
    assert.throws(() => verifyCommand(JSON.stringify(value), r.headers.get('x-rg-signature'), '10000'));
    assert.throws(() => verifyCommand(JSON.stringify({ ...value, uid: randomUUID() }), r.headers.get('x-rg-signature'), 'president'));
    const expired = request(value, 31);
    assert.throws(() => verifyCommand(JSON.stringify(value), expired.headers.get('x-rg-signature'), 'president'));
    const sealed = sealSession(value.proof);
    assert.equal(sealed.includes('native-secret'), false);
    assert.deepEqual(openSession(sealed), value.proof);
    assert.throws(() => openSession(sealed.slice(0, -5) + 'aaaaa'));
    let called = 0;
    const adapter = { inspect: () => ({ code: 'ABC123', instance: 'ABC123:1', capacity: 2, count: 1, status: 'open' as const }),
      admit: () => { called++; return { code: 'ABC123', token: 'bob-session' }; } };
    assert.equal((await connectorResponse(new Request(r.url, { method: 'POST', body: JSON.stringify(value) }), 'president', adapter)).status, 403);
    assert.equal(called, 0);
    assert.equal((await connectorResponse(request({ ...value, instance: 'old-room' }), 'president', adapter)).status, 409);
    assert.equal(called, 0);
    assert.equal((await connectorResponse(request(value), 'president', adapter)).status, 200);
    assert.equal(called, 1);
    const context = await contextResponse(new Request('https://game.test/api/platform/context', { method: 'POST', body: JSON.stringify({ session: value.proof }) }), 'president', adapter);
    assert.equal(context.status, 200);
    const decoded = openGameContext((await context.json()).context);
    assert.equal(decoded.game, 'president');
    assert.equal(decoded.uid, null);
    assert.deepEqual(decoded.session, value.proof);
  } finally { if (original === undefined) delete process.env.PLATFORM_SHARED_SECRET; else process.env.PLATFORM_SHARED_SECRET = original; }
});

test('Invitations directes : deux identités, registre vérifié, expiration, concurrence et credentials privés', async t => {
  const db = new PGlite();
  const a = randomUUID(), b = randomUUID(), third = randomUUID();
  const as = (id: string) => db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}');
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      create publication supabase_realtime;`);
    for (const file of ['20261025000000_platform_core.sql','20261026030000_social_core.sql','20261101020000_direct_game_invitations.sql','20261101030000_private_game_registry.sql']) {
      await db.exec(await readFile(new URL(`../supabase/migrations/${file}`, import.meta.url), 'utf8'));
    }
    await db.query('insert into auth.users(id) values($1),($2),($3)', [a,b,third]);
    await db.query("insert into friendships(requester_id,addressee_id,status) values($1,$2,'accepted')", [a,b]);
    const invite = async () => { await as(a); return (await db.query<{ id: string }>("select send_game_invitation($1,'president','ABC123') as id", [b])).rows[0].id; };
    await t.test('un salon absent ou sans preuve de présence est refusé', async () => {
      await assert.rejects(invite(), /non vérifié/);
      await db.query("insert into room_registry(game_slug,room_code,instance_key,refreshed_at,capacity,player_count) values('president','ABC123','instance-1',now(),2,1)");
      await assert.rejects(invite(), /présence/);
    });
    await db.query("insert into game_room_memberships(user_id,game_slug,room_code,instance_key,sealed_session) values($1,'president','ABC123','instance-1','encrypted-source')", [a]);
    const id = await invite(), lease = randomUUID();
    await t.test('seul le destinataire peut accepter', async () => {
      await as(third); await assert.rejects(db.query('select claim_game_admission($1,$2)', [id,lease]), /introuvable/);
    });
    await t.test('RPC historique ne contourne pas l’admission serveur', async () => {
      await as(b); await assert.rejects(db.query('select * from respond_to_game_invitation($1,true)', [id]), /sécurisée/);
    });
    await t.test('une seule tentative simultanée et aucun faux succès avant réponse du jeu', async () => {
      await as(b); await db.query('select claim_game_admission($1,$2)', [id,lease]);
      await assert.rejects(db.query('select claim_game_admission($1,$2)', [id,randomUUID()]), /en cours/);
      assert.equal((await db.query<{ status:string }>('select status from game_invitations where id=$1',[id])).rows[0].status,'pending');
      await assert.rejects(db.query('select * from respond_to_game_invitation($1,false)', [id]), /en cours/);
    });
    await t.test('confirmation clôturée une fois, reprise sans nouvel achat/siège', async () => {
      await db.query('select complete_game_admission($1,$2,$3)', [id,lease,'sealed-bob-session']);
      await as(b); const result = await db.query<{ sealed_session:string }>('select (claim_game_admission($1,$2)).*', [id,randomUUID()]);
      assert.equal(result.rows[0].sealed_session, 'sealed-bob-session');
      await assert.rejects(db.query('select complete_game_admission($1,$2,$3)', [id,lease,'other']), /déjà traitée/);
      assert.equal((await db.query<{ count:number }>("select count(*)::integer as count from notifications where invitation_id=$1 and kind='invitation_accepted'",[id])).rows[0].count,1);
    });
    await t.test('expiration et mauvais lease refusés', async () => {
      const fresh = await invite(); await db.query("update game_invitations set expires_at=now()-interval '1 second' where id=$1",[fresh]);
      await as(b); await assert.rejects(db.query('select claim_game_admission($1,$2)',[fresh,randomUUID()]),/expirée/);
    });
    await t.test('tables privées et fonctions de confirmation interdites au navigateur', async () => {
      await db.exec('set role authenticated');
      try {
        await assert.rejects(db.query('select * from game_room_memberships'), /permission/);
        await assert.rejects(db.query('select * from game_admissions'), /permission/);
        await assert.rejects(db.query('select complete_game_admission($1,$2,$3)',[id,lease,'x']), /permission/);
      } finally { await db.exec('reset role'); }
    });
    await t.test('les codes du registre ne sont pas consultables par les visiteurs ou les autres comptes', async () => {
      await db.exec('grant select on room_registry to anon,authenticated');
      await as(third); await db.exec('set role authenticated');
      assert.equal((await db.query('select * from room_registry')).rows.length,0);
      await db.exec('reset role');
      await as(b); await db.exec('set role authenticated');
      assert.equal((await db.query('select * from room_registry')).rows.length,1);
      await db.exec('reset role;set role anon');
      assert.equal((await db.query('select * from room_registry')).rows.length,0);
      await db.exec('reset role');
    });
  } finally { await db.close(); }
});
