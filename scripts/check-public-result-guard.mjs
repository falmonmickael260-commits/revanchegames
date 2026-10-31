import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';

/** Probe sans identité valide : même une ancienne API ne doit pas créer de résultat. */
export async function checkPublicResultGuard(origin, fetchImpl = fetch) {
  const target = new URL(origin);
  if (target.protocol !== 'https:' || target.username || target.password || target.pathname !== '/' || target.search || target.hash) {
    throw new Error('Indiquer une origine HTTPS, sans chemin ni identifiants.');
  }
  const response = await fetchImpl(new URL('/api/report-result', target), {
    method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15_000),
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
    body: JSON.stringify({ gameSlug: 'la-meute', outcome: 'win', idempotencyKey: `guard-probe:${randomUUID()}`, rgToken: 'invalid-probe-token' }),
  });
  const body = await response.json().catch(() => null);
  if (response.status !== 400 || body?.error !== 'gameSlug inconnu.') {
    throw new Error(`${target.origin} : protection non démontrée (HTTP ${response.status}). Ne pas appliquer les migrations ni déployer le jeu.`);
  }
  return { origin: target.origin, status: response.status, protection: 'verified', checkedAt: new Date().toISOString() };
}

async function main(origins) {
  if (!origins.length) throw new Error('Usage : node scripts/check-public-result-guard.mjs https://domaine-production [https://autre-origine-active]');
  for (const origin of origins) console.log(JSON.stringify(await checkPublicResultGuard(origin)));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error instanceof Error ? error.message : 'Vérification impossible.');
    process.exitCode = 1;
  });
}
