// Opt-in: temporary Supabase users and a bounded room on the existing LiveKit.
// No payment endpoint, game server or existing room is modified.
import { execFileSync, spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { open, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { RoomServiceClient } from 'livekit-server-sdk';
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
  await b.getByRole('dialog', { name: 'Conversation avec AuditVoiceAlice' }).getByRole('button', { name: 'Rejoindre le salon vocal', exact: true }).click({ timeout: 30000 });
  await b.getByRole('region', { name: 'Ta salle vocale' }).waitFor({ timeout: 60000 });
  await a.getByRole('list', { name: 'Participants' }).getByText(/AuditVoiceBob/).waitFor();
  await a.getByRole('list', { name: 'Participants' }).getByAltText('AuditVoiceBob').waitFor();
  await a.waitForFunction(() => [...document.querySelectorAll('[aria-label="Participants"] img')].every(img => img.complete && img.naturalWidth > 0));
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
  await a.getByRole('list', { name: 'Participants' }).getByText(/AuditVoiceBob.*(Micro actif|Parle)/).waitFor({ timeout: 30000 });
  await b.getByRole('list', { name: 'Participants' }).getByText(/AuditVoiceAlice.*(Micro actif|Parle)/).waitFor({ timeout: 30000 });
  for (const page of [a, b]) {
    await page.locator('audio').waitFor({ state: 'attached' });
    await page.waitForFunction(() => [...document.querySelectorAll('audio')].some(el => el.currentTime > 0 && !el.paused && el.srcObject?.getAudioTracks().some(t => t.readyState === 'live')));
  }
  await a.getByRole('region', { name: 'Ta salle vocale' }).getByRole('button', { name: 'Couper le micro', exact: true }).click();
  await b.getByRole('list', { name: 'Participants' }).getByText(/AuditVoiceAlice.*Micro coupé/).waitFor();
  console.log('OK — microphones synthétiques publiés/reçus dans les deux sens et mute distant');
  await a.getByRole('link', { name: 'Retrouver mes amis', exact: true }).click();
  await a.getByRole('complementary', { name: 'Vocal en cours' }).waitFor();
  await a.getByRole('link', { name: /Salons vocaux · Créer/ }).click();
  await a.getByRole('region', { name: 'Ta salle vocale' }).waitFor();
  await a.reload();
  await a.locator('section').filter({ has: a.getByRole('heading', { name: 'Vocal Audit', exact: true }) }).getByRole('button', { name: 'Rejoindre le vocal', exact: true }).click();
  await a.getByRole('region', { name: 'Ta salle vocale' }).waitFor();
  await a.getByRole('link', { name: 'Retrouver mes amis' }).click();
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
