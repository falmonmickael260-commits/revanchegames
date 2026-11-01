// Explicit opt-in: creates two temporary Supabase Auth users, cleans up only
// their own records in finally. No game is started and no Stripe request is made.
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdir, open } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createClient } from '@supabase/supabase-js';
const require = createRequire(import.meta.url);
require('@next/env').loadEnvConfig(process.cwd());
if (process.env.RUN_INVITATION_E2E !== '1') throw new Error('RUN_INVITATION_E2E=1 obligatoire : comptes temporaires et navigateurs réels.');
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '/private/tmp/revanche-browser-harness/node_modules/playwright/index.mjs');
const root = process.cwd(), copies = '/private/tmp/revanche-invitations-audit';
const work = '/private/tmp/revanche-invitation-e2e'; await mkdir(work, { recursive: true });
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const created = [], children = [], rooms = [];
const key = randomBytes(32).toString('hex');
const specs = [
  ['president','presidente',3101,['run','dev','--','--webpack','--hostname','localhost','--port','3101']],
  ['la-meute','Leloupbo',3102,['start']],
  ['quiz-master','QuizzMaster',3103,['run','dev']],
  ['10000','lewisdee',3104,['start']],
];
let browser;
async function start(name, cwd, args, env) {
  const log = await open(path.join(work, name + '.log'), 'w');
  const child = spawn('npm', args, { cwd, env, stdio: ['ignore', log.fd, log.fd], detached: true });
  children.push(child); await log.close();
  return child;
}
async function ready(url, timeout = 180000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    try { const r = await fetch(url, { signal: AbortSignal.timeout(5000) }); await r.arrayBuffer(); if (r.ok) return; } catch { /* starting */ }
    await new Promise(r => setTimeout(r, 1000));
  }
  throw new Error('Serveur indisponible : ' + url);
}
async function account(label) {
  const password = randomBytes(24).toString('base64url') + 'aA1!';
  const email = `rg-invitation-audit-${Date.now()}-${label}@example.com`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { username: `AuditInvite${label}` } });
  if (error) throw error; created.push(data.user.id);
  return { id: data.user.id, email, password };
}
async function login(user) {
  const context = await browser.newContext();
  await context.route('**/api/stripe/**', route => route.abort());
  const page = await context.newPage();
  await page.goto('http://localhost:3100/sign-in');
  await page.getByLabel('Adresse e-mail').fill(user.email);
  await page.getByLabel('Mot de passe').fill(user.password);
  await page.getByRole('button', { name: 'Se connecter', exact: true }).click();
  await page.waitForURL('**/profile', { timeout: 45000 });
  return page;
}
async function gameFrame(page) {
  await page.locator('iframe.rg-game-frame').waitFor({ timeout: 60000 });
  return await page.locator('iframe.rg-game-frame').elementHandle().then(e => e.contentFrame());
}
async function createNative(frame, slug) {
  if (slug === 'president') await frame.getByRole('button', { name: 'Créer une partie', exact: true }).click();
  if (slug === 'la-meute') await frame.locator('#btn-create').click();
  if (slug === 'quiz-master') { await frame.locator('#pseudo').fill('Audit Alice'); await frame.getByRole('button', { name: /Créer une émission/ }).click(); }
  if (slug === '10000') { await frame.locator('#btn-create-room').click(); await frame.locator('#online-submit').click(); }
}
async function guestJoin(slug, code, port) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await page.goto(`http://localhost:${port}/`);
  if (slug === 'president') {
    await page.getByLabel('Votre pseudo').fill('GuestAudit'); await page.getByPlaceholder('CODE', { exact: true }).fill(code);
    await page.getByRole('button', { name: 'Rejoindre', exact: true }).click();
    await page.getByRole('button', { name: 'Rejoindre la partie', exact: true }).click();
  }
  if (slug === 'la-meute') {
    await page.locator('#btn-guest').click(); await page.locator('#name').fill('GuestAudit');
    await page.locator('#join-code').fill(code); await page.locator('#btn-join').click();
  }
  if (slug === 'quiz-master') {
    await page.locator('#pseudo').fill('GuestAudit'); await page.getByLabel('Code de la partie').fill(code.slice(-4));
    await page.getByRole('button', { name: 'Rejoindre', exact: true }).click();
  }
  if (slug === '10000') {
    await page.locator('#btn-join-room').click(); await page.locator('#online-name').fill('GuestAudit');
    await page.locator('#online-code-input').fill(code); await page.locator('#online-submit').click();
  }
  await page.getByText('GuestAudit').first().waitFor({ timeout: 45000 });
  console.log('OK — invité sans compte rejoint par code, viewport tactile mobile : ' + slug);
  await context.close();
}
try {
  const nativeEnv = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/SUPABASE|STRIPE|GAME_URL|NEXT_PUBLIC_SITE_URL/.test(k)));
  for (const [, repo, port, args] of specs) {
    await start(repo, path.join(copies, repo), args, { ...nativeEnv, PLATFORM_SHARED_SECRET: key, PORT: String(port), HOST: 'localhost', PLATFORM_SHELL_ORIGIN: 'http://localhost:3100', DATA_DIR: path.join(work, 'meute-data') });
  }
  const urls = Object.fromEntries(specs.map(([slug,,port]) => [`GAME_URL_${slug.toUpperCase().replace(/-/g,'_')}`, `http://localhost:${port}`]));
  await start('platform', root, ['run','dev','--','--hostname','localhost','--port','3100'], {
    ...process.env, ...urls, INVITATION_E2E: '1', PLATFORM_SHARED_SECRET: key, STRIPE_SITE_URL: 'http://localhost:3100', NEXT_PUBLIC_SITE_URL: 'http://localhost:3100', STRIPE_MODE: 'test', STRIPE_SECRET_KEY: 'rk_test_never_charge',
  });
  await Promise.all([ready('http://localhost:3100/sign-in'), ...specs.map(([, ,port]) => ready(`http://localhost:${port}/`))]);
  console.log('Serveurs locaux disponibles ; aucune clé de paiement active.');
  browser = await chromium.launch({ executablePath: process.env.CHROME_EXECUTABLE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  const alice = await account('Alice'), bob = await account('Bob');
  const friendship = await admin.from('friendships').insert({ requester_id: alice.id, addressee_id: bob.id, status: 'accepted' });
  if (friendship.error) throw friendship.error;
  const a = await login(alice), b = await login(bob);
  console.log('Deux vrais comptes Supabase Auth connectés dans deux contextes distincts.');
  for (const [slug,,port] of specs) {
    console.log('Parcours navigateur : ' + slug);
    await b.goto('http://localhost:3100/friends');
    await a.goto(`http://localhost:3100/play/${slug}`);
    const frame = await gameFrame(a);
    const registered = a.waitForResponse(r => r.url().endsWith('/api/game/rooms/current') && r.status() === 200, { timeout: 90000 });
    await createNative(frame, slug);
    const room = await (await registered).json(); rooms.push({ slug, ...room });
    await a.getByRole('button', { name: 'Inviter un ami dans cette partie', exact: true }).click();
    await a.getByRole('button', { name: 'Inviter', exact: true }).click();
    await b.getByRole('button', { name: 'Accepter', exact: true }).waitFor({ timeout: 30000 });
    const joined = b.waitForResponse(r => r.url().endsWith('/api/game/rooms/current') && r.status() === 200, { timeout: 90000 });
    await b.getByRole('button', { name: 'Accepter', exact: true }).click();
    await b.waitForURL(`**/play/${slug}?invitation=*`, { timeout: 60000 });
    const verified = await (await joined).json();
    if (verified.code !== room.code || verified.instance !== room.instance || verified.count !== 2) throw new Error('Mauvais salon ou siège en double : ' + slug);
    const id = new URL(b.url()).searchParams.get('invitation');
    const retry = await b.request.post(`http://localhost:3100/api/game/invitations/${id}/accept`, { headers: { origin: 'http://localhost:3100' } });
    if (retry.status() !== 200) throw new Error('Reprise acceptation refusée : ' + slug);
    const reloaded = b.waitForResponse(r => r.url().endsWith('/api/game/rooms/current') && r.status() === 200, { timeout: 90000 });
    await b.reload();
    if ((await (await reloaded).json()).count !== 2) throw new Error('Siège doublé après rechargement : ' + slug);
    console.log('OK — invitation Realtime, acceptation sans code, bon salon, identité vérifiée et reprise : ' + slug);
    await guestJoin(slug, room.code, port);
    await b.goto('http://localhost:3100/');
  }
} catch (error) {
  let index = 0;
  for (const context of browser?.contexts() || []) for (const page of context.pages()) {
    await page.screenshot({ path: path.join(work, `failure-${index++}.png`) }).catch(() => {});
  }
  console.error('Échec navigateur :', String(error.message).split('Call log:')[0]);
  console.error(String(error.message).split('\n').filter(line => line.includes('intercepts pointer')).map(line => line.replace(/src="[^"]*"/g, 'src="[masqué]"')).slice(0,2).join('\n'));
  process.exitCode = 1;
} finally {
  await browser?.close();
  for (const child of children) { try { process.kill(-child.pid, 'SIGTERM'); } catch { /* stopped */ } }
  if (created.length) {
    await admin.from('game_admissions').delete().in('user_id', created);
    await admin.from('game_room_memberships').delete().in('user_id', created);
    for (const id of created) { await admin.from('game_invitations').delete().or(`from_user_id.eq.${id},to_user_id.eq.${id}`); }
    for (const r of rooms) await admin.from('room_registry').delete().eq('game_slug', r.slug).eq('room_code', r.code).eq('instance_key', r.instance);
    for (const id of created) { const { error } = await admin.auth.admin.deleteUser(id); if (error) console.error('Nettoyage compte de test à reprendre :', id, error.message); }
    console.log('Nettoyage des comptes et données créés pour cet essai terminé.');
  }
}
