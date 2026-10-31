import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkPublicResultGuard } from '../scripts/check-public-result-guard.mjs';

test('la sonde accepte uniquement le refus explicite du jeu par la route de production', async () => {
  const pass = await checkPublicResultGuard('https://revanche.test', async (url, init) => {
    assert.equal(String(url), 'https://revanche.test/api/report-result');
    assert.equal(init?.redirect, 'error');
    assert.equal(JSON.parse(String(init?.body)).rgToken, 'invalid-probe-token');
    return Response.json({ error: 'gameSlug inconnu.' }, { status: 400 });
  });
  assert.equal(pass.protection, 'verified');
});

test('ancienne API, redirection de connexion, erreur générique et panne réseau bloquent la suite', async () => {
  for (const response of [
    Response.json({ ok: true, skipped: 'no_valid_identity' }),
    Response.json({ error: 'Bad request' }, { status: 400 }),
    Response.json({ error: 'Unauthorized' }, { status: 401 }),
    Response.json({ error: 'Not found' }, { status: 404 }),
  ]) await assert.rejects(checkPublicResultGuard('https://revanche.test', async () => response), /protection non démontrée/);
  await assert.rejects(checkPublicResultGuard('https://revanche.test', async () => { throw new Error('offline'); }), /offline/);
  await assert.rejects(checkPublicResultGuard('https://revanche.test/path'), /origine HTTPS/);
  await assert.rejects(checkPublicResultGuard('https://user:password@revanche.test'), /origine HTTPS/);
});
