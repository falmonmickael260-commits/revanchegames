// Opt-in: temporary Supabase users and a bounded room on the existing LiveKit.
// No payment endpoint, game server or existing room is modified.
import { execFileSync, spawn } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { open, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';
const require = createRequire(import.meta.url);
require('@next/env').loadEnvConfig(process.cwd());
if (process.env.RUN_VOICE_E2E !== '1') throw new Error('RUN_VOICE_E2E=1 obligatoire');
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '/private/tmp/revanche-browser-harness/node_modules/playwright/index.mjs');
const config = JSON.parse(execFileSync('npm', ['exec','--yes','--package=@railway/cli','--','railway','variable','list','--project','f3ea84af-f08a-491b-a27e-49e4ccbe006d','--service','village-des-blackops','--environment','production','--json'], { encoding: 'utf8' }));
const voiceEnv = Object.fromEntries(['LIVEKIT_URL','LIVEKIT_API_KEY','LIVEKIT_API_SECRET'].map(k => [k, config[k]]));
assert.ok(Object.values(voiceEnv).every(Boolean));
const service = new RoomServiceClient(voiceEnv.LIVEKIT_URL.replace(/^ws/,'http'), voiceEnv.LIVEKIT_API_KEY, voiceEnv.LIVEKIT_API_SECRET);
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const created = [];
let browser, server, roomId;
const testRooms = new Set();
const work = '/private/tmp/revanche-voice-e2e';
await mkdir(work, { recursive: true });
async function account(label) {
  const password = randomBytes(24).toString('base64url') + 'aA1!';
  const email = `rg-voice-audit-${Date.now()}-${label}@example.com`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { username: `AuditVoice${label}` } });
  if (error) throw error;
  created.push(data.user.id);
  return { id: data.user.id, email, password };
}
async function login(user, mobile = false) {
  const context = await browser.newContext({ permissions: ['microphone'], ...(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : {}) });
  await context.route('**/api/stripe/**', route => route.abort());
  const page = await context.newPage();
  await page.goto('http://localhost:3198/sign-in');
  await page.getByLabel('Adresse e-mail').fill(user.email);
  await page.getByLabel('Mot de passe').fill(user.password);
  await page.getByRole('button', { name: 'Se connecter', exact: true }).click();
  await page.waitForURL('**/profile', { timeout: 60000 });
  await page.goto('http://localhost:3198/voice');
  await page.getByRole('button', { name: 'Créer une salle éphémère', exact: true }).waitFor();
  return page;
}
async function participants(page, check) {
  await page.getByRole('button', { name: /^Participants ·/ }).click();
  await check(page.getByRole('dialog'));
  await page.getByRole('button', { name: 'Fermer le panneau', exact: true }).click();
}
async function friendsFromRoom(page) {
  await page.getByRole('button', { name: 'Autres salons', exact: true }).click();
  await page.getByRole('link', { name: 'Retrouver mes amis', exact: true }).click();
}
async function compactLayout(page, admission) {
  const peers = await browser.newPage();
  try {
    await peers.goto('http://localhost:3198/voice');
    await peers.addScriptTag({ path: process.cwd() + '/node_modules/livekit-client/dist/livekit-client.umd.js' });
    const tokens = [];
    for (const name of ['Charlotte','Alexandre','Camille','Raphael','Noemie','Gabriel']) {
      const token = new AccessToken(voiceEnv.LIVEKIT_API_KEY, voiceEnv.LIVEKIT_API_SECRET, { identity: randomUUID(), name,
        metadata: JSON.stringify({ avatarUrl: 'http://localhost:3198/icons/icon-192.png' }), ttl: 120 });
      token.addGrant({ room: roomId, roomJoin: true, canPublish: false, canSubscribe: true });
      tokens.push(await token.toJwt());
    }
    await peers.evaluate(async ({ serverUrl, tokens }) => {
      window.layoutPeers = [];
      for (const token of tokens) { const room = new window.LivekitClient.Room(); window.layoutPeers.push(room); await room.connect(serverUrl, token); }
    }, { serverUrl: admission.serverUrl, tokens });
    await page.getByRole('button', { name: 'Participants · 8', exact: true }).waitFor();
    for (const [width, height] of [[320,568],[360,640],[390,844],[1280,800]]) {
      await page.setViewportSize({ width, height });
      await page.evaluate(() => window.scrollTo(0, 0));
      const dimensions = await page.evaluate(() => ({ h: innerHeight, w: innerWidth, docH: document.documentElement.scrollHeight, docW: document.documentElement.scrollWidth }));
      assert.ok(dimensions.docW <= dimensions.w + 1 && dimensions.docH <= dimensions.h + 1, `page sans défilement ${width}x${height}`);
      for (const locator of [page.getByRole('region', { name: 'Chat de la salle', exact: true }).getByLabel('Votre message'),
        page.getByRole('button', { name: 'Activer le micro', exact: true }), page.getByRole('button', { name: 'Quitter la salle', exact: true })]) {
        const bounds = await locator.boundingBox();
        const nav = await page.getByRole('navigation', { name: 'Navigation principale' }).isVisible();
        assert.ok(bounds && bounds.y >= 0 && bounds.y + bounds.height <= height - (nav ? 56 : 0) + 1, 'chat et commandes visibles sans swipe');
      }
      await page.getByRole('button', { name: 'Participants · 8', exact: true }).click();
      const dialog = page.getByRole('dialog');
      assert.equal(await dialog.getByRole('list', { name: 'Participants', exact: true }).getByRole('listitem').count(), 8);
      assert.ok(await dialog.evaluate(el => {
        const list = el.querySelector('ul').getBoundingClientRect(), box = el.getBoundingClientRect();
        return list.top >= box.top && list.bottom <= box.bottom && box.top >= 0 && box.bottom <= innerHeight;
      }), 'les huit participants visibles ensemble');
      await page.keyboard.press('Tab');
      assert.ok(await dialog.evaluate(el => el.contains(document.activeElement)), 'focus contenu dans le panneau');
      if (width === 320) await page.screenshot({ path: work + '/participants-8-compact.png' });
      await page.keyboard.press('Escape');
      await dialog.waitFor({ state: 'detached' });
      assert.equal(await page.getByRole('button', { name: 'Participants · 8', exact: true }).evaluate(el => el === document.activeElement), true);
      if (width === 320) await page.screenshot({ path: work + '/voice-compact-320.png' });
    }
    console.log('OK — 8 participants dans un panneau, focus et Échap ; chat/micro sans swipe sur 320x568, 360x640, 390x844 et ordinateur');
  } finally { await peers.evaluate(async () => { await Promise.all((window.layoutPeers || []).map(room => room.disconnect())); }).catch(() => {}); await peers.close(); }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Participants · 2', exact: true }).waitFor();
}
try {
  const log = await open(work + '/platform.log', 'w');
  server = spawn('npm',['run','dev','--','--hostname','localhost','--port','3198'], { detached: true, env: {
    ...process.env, ...voiceEnv, INVITATION_E2E: '1', STRIPE_SITE_URL: 'http://localhost:3198', NEXT_PUBLIC_SITE_URL: 'http://localhost:3198', STRIPE_MODE: 'test', STRIPE_SECRET_KEY: 'rk_test_never_charge',
  }, stdio: ['ignore', log.fd, log.fd] });
  await log.close();
  let ready = false;
  for (let i = 0; i < 120; i++) {
    try {
      const status = execFileSync('curl', ['--noproxy','*','--max-time','5','-s','-o','/dev/null','-w','%{http_code}','http://localhost:3198/sign-in'], { encoding: 'utf8' });
      if (status === '200') { ready = true; break; }
    } catch {}
    await new Promise(r => setTimeout(r, 1000));
  }
  assert.ok(ready, 'serveur local disponible');
  console.log('Serveur local disponible, lancement des navigateurs.');
  browser = await chromium.launch({ executablePath: process.env.CHROME_EXECUTABLE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true,
    args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required'] });
  const alice = await account('Alice'), bob = await account('Bob'), outsider = await account('Outsider');
  for (const [user, photo] of [[alice,'president'],[bob,'quiz-master']]) {
    const result = await admin.from('profiles').update({ avatar_url: `http://localhost:3198/games/${photo}.webp` }).eq('id', user.id);
    if (result.error) throw result.error;
  }
  const { error } = await admin.from('friendships').insert({ requester_id: alice.id, addressee_id: bob.id, status: 'accepted' });
  if (error) throw error;
  const a = await login(alice), b = await login(bob, true), c = await login(outsider);
  assert.deepEqual(await b.getByRole('navigation', { name: 'Navigation principale' }).getByRole('link').allTextContents(), ['Accueil','Jeux','Salons','Amis','Chat','Profil']);
  const anon = await browser.newPage();
  await anon.goto('http://localhost:3198/voice');
  assert.equal((await anon.request.get('http://localhost:3198/api/voice')).status(), 401);
  await a.getByLabel('Nom de la salle').fill('Vocal Audit');
  await a.getByLabel('Qui peut rejoindre ?').selectOption('friends');
  const createdResponse = a.waitForResponse(r => r.url().endsWith('/api/voice') && r.request().method() === 'POST');
  await a.getByRole('button', { name: 'Créer une salle éphémère', exact: true }).click();
  const admission = await (await createdResponse).json();
  roomId = admission.room?.id;
  if (roomId) testRooms.add(roomId);
  assert.ok(roomId, admission.error);
  const claims = JSON.parse(Buffer.from(admission.token.split('.')[1], 'base64url').toString());
  assert.equal(claims.sub, alice.id); assert.equal(claims.video.room, roomId);
  assert.deepEqual(claims.video.canPublishSources, ['microphone']);
  assert.equal(claims.video.canPublishData, true);
  assert.match(JSON.parse(claims.metadata).avatarUrl, /president.webp$/);
  assert.ok(!claims.video.roomAdmin && !claims.video.roomCreate && !claims.video.roomList);
  assert.ok(claims.exp - claims.nbf <= 60);
  await a.getByRole('region', { name: 'Ta salle vocale' }).waitFor({ timeout: 60000 });
  await b.goto('http://localhost:3198/friends');
  await b.getByRole('button', { name: /^Discuter avec AuditVoiceAlice/ }).click();
  await a.getByRole('button', { name: 'Inviter des amis', exact: true }).click();
  const invitationResponse = a.waitForResponse(r => r.url().endsWith('/api/voice') && r.request().postDataJSON()?.action === 'invite');
  await a.getByRole('button', { name: 'Inviter AuditVoiceBob au vocal', exact: true }).click();
  const invitation = await (await invitationResponse).json();
  assert.ok(invitation.messageId, invitation.error);
  await a.getByRole('button', { name: 'Fermer le panneau', exact: true }).click();
  await b.getByRole('dialog', { name: 'Conversation avec AuditVoiceAlice' }).getByRole('button', { name: 'Rejoindre le salon vocal', exact: true }).click({ timeout: 30000 });
  await b.getByRole('region', { name: 'Ta salle vocale' }).waitFor({ timeout: 60000 });
  await participants(a, async dialog => {
    await dialog.getByText(/AuditVoiceBob/).waitFor();
    await dialog.getByAltText('AuditVoiceBob').waitFor();
    await a.waitForFunction(() => [...document.querySelectorAll('[aria-label="Participants"] img')].every(img => img.complete && img.naturalWidth > 0));
  });
  await compactLayout(b, admission);
  assert.equal((await c.request.get('http://localhost:3198/api/voice')).status(), 200);
  const listed = await (await c.request.get('http://localhost:3198/api/voice')).json();
  assert.ok(!listed.rooms.some(r => r.id === roomId));
  const denied = await c.request.post('http://localhost:3198/api/voice', { headers: { Origin: 'http://localhost:3198' }, data: { action: 'join', roomId } });
  assert.equal(denied.status(), 404);
  const stolen = await c.request.post('http://localhost:3198/api/voice', { headers: { Origin: 'http://localhost:3198' }, data: { action: 'joinInvitation', messageId: invitation.messageId } });
  assert.equal(stolen.status(), 410);
  const repeated = await a.request.post('http://localhost:3198/api/voice', { headers: { Origin: 'http://localhost:3198' }, data: { action: 'invite', roomId, friendId: bob.id } });
  assert.equal(repeated.status(), 429);
  const csrf = await b.request.post('http://localhost:3198/api/voice', { headers: { Origin: 'https://evil.invalid' }, data: { action: 'join', roomId } });
  assert.equal(csrf.status(), 403);
  console.log('OK — onglet Salons, avatars réels, MP avec rejoindre, accès privé, vol d’invitation et spam refusés');
  const chatA = a.getByRole('region', { name: 'Chat de la salle', exact: true });
  const chatB = b.getByRole('region', { name: 'Chat de la salle', exact: true });
  await chatA.getByLabel('Votre message').fill('Bonjour depuis la salle privée');
  await chatA.getByRole('button', { name: 'Envoyer', exact: true }).click();
  await chatB.getByText('Bonjour depuis la salle privée', { exact: true }).waitFor();
  await chatB.getByLabel('Votre message').fill('<script>window.voiceXss=1</script>');
  await chatB.getByRole('button', { name: 'Envoyer', exact: true }).click();
  await chatA.getByText('<script>window.voiceXss=1</script>', { exact: true }).waitFor();
  assert.equal(await a.evaluate(() => window.voiceXss), undefined);
  await c.getByLabel('Nom de la salle').fill('Autre salle audit');
  const secondResponse = c.waitForResponse(r => r.url().endsWith('/api/voice') && r.request().postDataJSON()?.action === 'create');
  await c.getByRole('button', { name: 'Créer une salle éphémère', exact: true }).click();
  const second = await (await secondResponse).json();
  assert.equal(second.room.visibility, 'public');
  testRooms.add(second.room.id);
  await c.getByRole('region', { name: 'Ta salle vocale' }).waitFor();
  const chatC = c.getByRole('region', { name: 'Chat de la salle', exact: true });
  assert.equal(await chatC.getByText('Bonjour depuis la salle privée', { exact: true }).count(), 0);
  await chatC.getByLabel('Votre message').fill('Seulement dans la deuxième salle');
  await chatC.getByRole('button', { name: 'Envoyer', exact: true }).click();
  await chatC.getByText('Seulement dans la deuxième salle', { exact: true }).waitFor();
  assert.equal(await chatA.getByText('Seulement dans la deuxième salle', { exact: true }).count(), 0);
  // The public room can be discovered and admitted by a non-friend.
  let publicListed;
  for (let attempt = 0; attempt < 15; attempt++) {
    publicListed = await (await b.request.get('http://localhost:3198/api/voice')).json();
    if (publicListed.rooms.some(r => r.id === second.room.id && r.visibility === 'public')) break;
    await new Promise(r => setTimeout(r, 1000));
  }
  assert.ok(publicListed.rooms.some(r => r.id === second.room.id && r.visibility === 'public'));
  const publicJoin = await b.request.post('http://localhost:3198/api/voice', { headers: { Origin: 'http://localhost:3198' }, data: { action: 'join', roomId: second.room.id } });
  assert.equal(publicJoin.status(), 200);
  await b.setViewportSize({ width: 320, height: 740 });
  assert.ok(await b.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));
  await b.screenshot({ path: work + '/voice-mobile.png', fullPage: true });
  await c.getByRole('region', { name: 'Ta salle vocale' }).getByRole('button', { name: 'Quitter la salle', exact: true }).click();
  console.log('OK — chat dans les deux sens, texte rendu sans exécution, isolation entre salles, découverte publique, mobile 320px');
  await a.getByRole('region', { name: 'Ta salle vocale' }).getByRole('button', { name: 'Activer le micro', exact: true }).click();
  await b.getByRole('region', { name: 'Ta salle vocale' }).getByRole('button', { name: 'Activer le micro', exact: true }).click();
  await participants(a, dialog => dialog.getByText(/AuditVoiceBob.*(Micro actif|Parle)/).waitFor({ timeout: 30000 }));
  await participants(b, dialog => dialog.getByText(/AuditVoiceAlice.*(Micro actif|Parle)/).waitFor({ timeout: 30000 }));
  for (const page of [a, b]) {
    await page.locator('audio').waitFor({ state: 'attached' });
    await page.waitForFunction(() => [...document.querySelectorAll('audio')].some(el => el.currentTime > 0 && !el.paused && el.srcObject?.getAudioTracks().some(t => t.readyState === 'live')));
  }
  await a.getByRole('region', { name: 'Ta salle vocale' }).getByRole('button', { name: 'Couper le micro', exact: true }).click();
  await participants(b, dialog => dialog.getByText(/AuditVoiceAlice.*Micro coupé/).waitFor());
  console.log('OK — microphones synthétiques publiés/reçus dans les deux sens et mute distant');
  // The native game is replaced with an inert iframe; only the platform toolbar is exercised.
  const fakeGame = async route => {
    if (route.request().resourceType() === 'document' && route.request().frame().parentFrame()) {
      await route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Jeu de test</title><body style="margin:0;background:#18212c;color:white">Zone de jeu de test</body>' });
    } else await route.continue();
  };
  await a.route('**/*', fakeGame);
  await a.locator('a[href="/library"]').first().click();
  await a.locator('a[href="/play/president"]').first().click();
  const gameVoice = a.getByRole('button', { name: 'Commandes du vocal', exact: true });
  await gameVoice.waitFor();
  assert.equal(await gameVoice.getAttribute('aria-expanded'), 'false');
  assert.equal(await a.getByRole('complementary', { name: 'Vocal en cours', exact: true }).count(), 0);
  assert.equal(await a.getByRole('complementary', { name: 'Commandes du vocal', exact: true }).count(), 0);
  for (const [width, height] of [[320,568],[390,844],[1280,800]]) {
    await a.setViewportSize({ width, height });
    const bar = await gameVoice.boundingBox();
    const frame = await a.locator('iframe.rg-game-frame').boundingBox();
    assert.ok(bar && frame && bar.y >= 0 && bar.y + bar.height <= frame.y + 1, 'vocal réduit dans la barre au-dessus du jeu');
    await gameVoice.click();
    const controls = a.getByRole('complementary', { name: 'Commandes du vocal', exact: true });
    await controls.waitFor();
    const box = await controls.boundingBox();
    assert.ok(box && box.x >= 0 && box.x + box.width <= width && box.y >= frame.y, 'commandes déployées en haut, dans l’écran');
    if (width === 320) await a.screenshot({ path: work + '/voice-in-game-expanded.png' });
    await controls.getByRole('button', { name: 'Réduire le vocal', exact: true }).click();
    assert.equal(await gameVoice.getAttribute('aria-expanded'), 'false');
    if (width === 320) await a.screenshot({ path: work + '/voice-in-game-collapsed.png' });
    await gameVoice.click();
    await a.keyboard.press('Escape');
    assert.equal(await gameVoice.getAttribute('aria-expanded'), 'false');
  }
  assert.equal((await service.listParticipants(roomId)).length, 2);
  await gameVoice.click();
  await a.getByRole('complementary', { name: 'Commandes du vocal', exact: true }).getByRole('link').click();
  await a.getByRole('region', { name: 'Ta salle vocale' }).waitFor();
  await a.unroute('**/*', fakeGame);
  console.log('OK — vocal réduit par défaut dans la barre haute du jeu, ouverture/réduction/Échap, audio conservé sur trois formats');
  await friendsFromRoom(a);
  await a.getByRole('complementary', { name: 'Vocal en cours' }).waitFor();
  await a.getByRole('link', { name: /Salons vocaux · Créer/ }).click();
  await a.getByRole('region', { name: 'Ta salle vocale' }).waitFor();
  await a.reload();
  await a.locator('section').filter({ has: a.getByRole('heading', { name: 'Vocal Audit', exact: true }) }).getByRole('button', { name: 'Rejoindre le vocal', exact: true }).click();
  await a.getByRole('region', { name: 'Ta salle vocale' }).waitFor();
  await friendsFromRoom(a);
  await a.getByRole('complementary', { name: 'Vocal en cours' }).waitFor();
  assert.equal((await service.listParticipants(roomId)).length, 2);
  await a.getByRole('complementary', { name: 'Vocal en cours' }).getByRole('button', { name: 'Quitter', exact: true }).click();
  await b.getByRole('region', { name: 'Ta salle vocale' }).getByRole('button', { name: 'Quitter la salle', exact: true }).click();
  console.log('OK — retour dans le vocal, persistance pendant la navigation et sortie');
  let removed = false;
  for (let i = 0; i < 85; i++) {
    if (!(await service.listRooms([roomId])).length) { removed = true; break; }
    await new Promise(r => setTimeout(r, 1000));
  }
  assert.ok(removed, 'la salle vide doit disparaître');
  console.log('OK — suppression automatique de la salle vide après le délai de reconnexion');
} finally {
  await browser?.close();
  for (const name of testRooms) if (created.some(id => name === 'rg-social-' + id)) await service.deleteRoom(name).catch(() => {});
  for (const id of created) {
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) console.error('Nettoyage du compte temporaire à reprendre :', id);
  }
  if (server?.pid) { try { process.kill(-server.pid, 'SIGTERM'); } catch {} }
}
