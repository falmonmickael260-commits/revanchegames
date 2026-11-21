import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { POST } from '../src/app/api/game/dominorush/results/route';
import { readDomirushRequest, validateDomirushResult } from '../src/lib/dominorush';

test('Domirush verifies results, credits the right profile and deduplicates retries', async () => {
  const key = 'domirush-test-key';
  const previousKey = process.env.GAME_CONNECTOR_SECRET_DOMINORUSH;
  process.env.GAME_CONNECTOR_SECRET_DOMINORUSH = key;
  const db = new PGlite();
  try {
    const userId = randomUUID();
    const result = {
      game: 'dominorush', room: 'D2M4R7', instance: randomUUID(),
      players: [
        { userId, name: 'Alice', outcome: 'win', score: 50, position: 1 },
        { userId: null, name: 'Benoît', outcome: 'loss', score: 16, position: 2 },
      ],
    };
    const raw = JSON.stringify(result);
    function signed(age = 0) {
      const stamp = Math.floor(Date.now() / 1000) - age;
      const signature = createHmac('sha256', key).update(`rg-dominorush-result-v1.${stamp}.${raw}`).digest('hex');
      return new Request('http://local/results', { method: 'POST', body: raw, headers: { 'x-rg-signature': `${stamp}.${signature}` } });
    }

    assert.deepEqual(validateDomirushResult(await readDomirushRequest(signed(), 'result')), result);
    assert.equal((await POST(signed(35))).status, 403);
    assert.equal((await POST(new Request('http://local/results', { method: 'POST', body: raw }))).status, 403);
    assert.throws(() => validateDomirushResult({ ...result, players: [result.players[0], { ...result.players[1], userId }] }));

    await db.exec(`
      create role anon;
      create role authenticated;
      create role service_role bypassrls;
      create schema auth;
      create table auth.users(id uuid primary key, raw_user_meta_data jsonb default '{}');
      create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    `);
    await db.exec(await readFile(new URL('../supabase/migrations/20261025000000_platform_core.sql', import.meta.url), 'utf8'));
    await db.query('insert into auth.users (id) values ($1)', [userId]);
    await db.exec("insert into game_catalog (slug, display_name, sort_order) values ('dominorush', 'Domirush', 22)");
    const parameters = [result.game, `dominorush:${result.instance}`, result.room, raw, JSON.stringify(result.players.map(player => ({
      user_id: player.userId, guest_label: player.userId ? null : player.name,
      outcome: player.outcome, score: player.score, position: player.position,
    })))];
    const report = () => db.query<{ id: string }>('select record_game_result($1, $2, $3, $4, $5) as id', parameters);
    assert.equal((await report()).rows[0].id, (await report()).rows[0].id);
    const stats = await db.query<{ games_played: number; wins: number }>(
      'select games_played, wins from game_stats where user_id = $1 and game_slug = $2', [userId, result.game],
    );
    assert.equal(Number(stats.rows[0].games_played), 1);
    assert.equal(Number(stats.rows[0].wins), 1);
  } finally {
    await db.close();
    if (previousKey === undefined) delete process.env.GAME_CONNECTOR_SECRET_DOMINORUSH;
    else process.env.GAME_CONNECTOR_SECRET_DOMINORUSH = previousKey;
  }
});
