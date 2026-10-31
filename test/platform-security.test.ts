import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPlatformToken, verifyPlatformToken } from '../src/lib/platform-token';
import { POST } from '../src/app/api/report-result/route';

test('un jeton signé conserve le compte et le pseudonyme ; falsification et expiration refusées', () => {
  const previous = process.env.PLATFORM_SHARED_SECRET;
  process.env.PLATFORM_SHARED_SECRET = 'test-secret';
  try {
    const signed = createPlatformToken({ id: 'account', username: 'Mickaël' });
    assert.deepEqual(verifyPlatformToken(signed), { uid: 'account', username: 'Mickaël' });
    assert.equal(verifyPlatformToken(signed + 'tampered'), null);
    assert.equal(verifyPlatformToken(createPlatformToken({ id: 'account', username: 'Mickaël' }, -1)), null);
  } finally {
    if (previous === undefined) delete process.env.PLATFORM_SHARED_SECRET;
    else process.env.PLATFORM_SHARED_SECRET = previous;
  }
});

test('le navigateur ne peut pas déclarer une victoire La Meute pour gagner des pièces', async () => {
  const response = await POST(new Request('https://revanche.test/api/report-result', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ gameSlug: 'la-meute', idempotencyKey: 'forged', outcome: 'win', rgToken: 'arbitrary' }),
  }));
  assert.equal(response.status, 400);
});
