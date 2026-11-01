import { copyFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
const base = process.argv[2] || '/private/tmp/revanche-invitations-audit';
for (const game of ['presidente', 'QuizzMaster', 'Leloupbo', 'lewisdee', 'Enroute']) {
  const root = path.join(base, game);
  const dir = path.join(root, 'platform-connector');
  await mkdir(dir, { recursive: true });
  for (const name of ['server.mjs', 'server.d.mts', 'browser.js', 'browser.d.ts']) {
    await copyFile(new URL(`../vendor/game-connector/${name}`, import.meta.url), path.join(dir, name));
  }
  if (game === 'Leloupbo' || game === 'lewisdee') {
    await copyFile(new URL('../vendor/game-connector/browser.js', import.meta.url), path.join(root, game === 'Leloupbo' ? 'public/js/platformConnector.js' : 'js/platformConnector.js'));
  }
  console.log(`Connecteur synchronisé : ${game}`);
}
