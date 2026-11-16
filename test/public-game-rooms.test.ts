import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { connectorResponse } from '../vendor/game-connector/server.mjs';

test('Salons publics : le jeu exige un hôte connecté et un salon ouvert', async () => {
  const saved = process.env.PLATFORM_SHARED_SECRET;
  const secret = 'local-public-rooms-test';
  process.env.PLATFORM_SHARED_SECRET = secret;
  const command = { v: 1, game: 'president', operation: 'admit', room: 'ABCDE',
    uid: randomUUID(), name: 'Bob', inviter: randomUUID(), instance: 'instance-1',
    invitation: randomUUID(), proof: { code: 'ABCDE', token: 'host-seat' }, publicJoin: true };
  let admissionCount = 0;
  const attempt = async (isHost: boolean, status: 'open' | 'started', publicJoin = true) => {
    const body = JSON.stringify({ ...command, publicJoin });
    const stamp = Math.floor(Date.now() / 1000);
    const signature = createHmac('sha256', secret).update(`rg-connector-v1.${stamp}.${body}`).digest('hex');
    return connectorResponse(new Request('https://game.test/api/platform/connector', {
      method: 'POST', body, headers: { 'x-rg-signature': `${stamp}.${signature}` },
    }), 'president', {
      inspect: () => ({ code: 'ABCDE', instance: 'instance-1', capacity: 2, count: 1, isHost, status }),
      admit: () => { admissionCount++; return { code: 'ABCDE', token: 'player-seat' }; },
    });
  };
  try {
    assert.equal((await attempt(false, 'open')).status, 409);
    assert.equal((await attempt(true, 'started')).status, 409);
    assert.equal(admissionCount, 0);
    assert.equal((await attempt(true, 'open')).status, 200);
    assert.equal((await attempt(false, 'open', false)).status, 200);
    assert.equal(admissionCount, 2);
  } finally {
    if (saved === undefined) delete process.env.PLATFORM_SHARED_SECRET;
    else process.env.PLATFORM_SHARED_SECRET = saved;
  }
});

test('Accueil : seuls les salons publiés, disponibles et autorisés sont listés', async () => {
  const db = new PGlite();
  const host = randomUUID(), viewer = randomUUID();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}');
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      create publication supabase_realtime;`);
    for (const name of [
      '20261025000000_platform_core.sql', '20261026030000_social_core.sql',
      '20261101020000_direct_game_invitations.sql', '20261101030000_private_game_registry.sql',
      '20261116000000_public_game_rooms.sql',
    ]) await db.exec(await readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8'));
    await db.query('insert into auth.users(id) values($1),($2)', [host, viewer]);
    await db.exec(`insert into room_registry(game_slug,room_code,instance_key,refreshed_at,capacity,player_count,status) values
      ('president','OPEN','i1',now(),4,2,'open'),
      ('president','PRIVATE','i2',now(),4,2,'open'),
      ('president','FULL','i3',now(),4,4,'full'),
      ('president','STARTED','i4',now(),4,2,'started'),
      ('president','OLD','i5',now(),4,2,'open'),
      ('president','REUSED','new',now(),4,2,'open'),
      ('president','HIDDEN','i7',now(),4,2,'open');`);
    await db.query(`insert into public_game_rooms(game_slug,room_code,instance_key,host_id,refreshed_at) values
      ('president','OPEN','i1',$1,now()),
      ('president','FULL','i3',$1,now()),
      ('president','STARTED','i4',$1,now()),
      ('president','OLD','i5',$1, now() - interval '60 seconds'),
      ('president','REUSED','old',$1,now()),
      ('president','HIDDEN','i7',$1,null)`, [host]);
    await db.exec('set role service_role');
    const result = await db.query<{room_code:string}>('select room_code from find_public_game_rooms($1)', [viewer]);
    assert.deepEqual(result.rows, [{ room_code: 'OPEN' }]);
    await db.exec('reset role');
    await db.query("insert into friendships(requester_id,addressee_id,status,blocked_by) values($1,$2,'blocked',$1)", [viewer, host]);
    await db.exec('set role service_role');
    assert.deepEqual((await db.query('select id from find_public_game_rooms($1)', [viewer])).rows, []);
    await db.exec('reset role; set role authenticated');
    await assert.rejects(db.query('select * from public_game_rooms'), /permission/);
    await assert.rejects(db.query('select * from find_public_game_rooms($1)', [viewer]), /permission/);
    await db.exec('reset role');
  } finally { await db.close(); }
});
