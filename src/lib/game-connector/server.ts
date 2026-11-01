import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from 'node:crypto';
import { GAMES } from '@/data/games';
import { RequestError } from '@/lib/request-security';
import { isConnectedGame, type ConnectorCommand, type ConnectedGame, type NativeSession, type RoomSnapshot } from './protocol';

function secret() {
  const value = process.env.PLATFORM_SHARED_SECRET;
  if (!value) throw new RequestError('Connexion aux jeux indisponible.', 503);
  return value;
}
function sealKey() { return createHash('sha256').update(`rg-admission-storage-v1:${secret()}`).digest(); }
export function sealSession(value: NativeSession): string {
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', sealKey(), iv);
  const body = Buffer.concat([cipher.update(JSON.stringify(value)), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64url');
}
export function openSession(value: string): NativeSession {
  const bytes = Buffer.from(value, 'base64url');
  const decipher = createDecipheriv('aes-256-gcm', sealKey(), bytes.subarray(0, 12));
  decipher.setAuthTag(bytes.subarray(12, 28));
  return JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString());
}
export function openGameContext(value: string): { game: ConnectedGame; uid: string | null; session: NativeSession } {
  if (value.length > 8192) throw new RequestError('Lien invalide.');
  try {
    const bytes = Buffer.from(value, 'base64url');
    const key = createHash('sha256').update(`rg-game-context-v1:${secret()}`).digest();
    const decipher = createDecipheriv('aes-256-gcm', key, bytes.subarray(0, 12)); decipher.setAuthTag(bytes.subarray(12, 28));
    const context = JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString());
    if (!isConnectedGame(context.game) || typeof context.exp !== 'number' || context.exp < Date.now() / 1000 || !context.session?.code) throw new Error('expired');
    return context;
  } catch { throw new RequestError('Lien expiré : utilise de nouveau « Inviter un ami » dans le jeu.', 409); }
}
export function gameOrigin(slug: ConnectedGame) {
  const key = slug.toUpperCase().replace(/-/g, '_');
  const target = process.env[`GAME_CONNECTOR_URL_${key}`] || process.env[`GAME_URL_${key}`] || GAMES.find(g => g.id === slug)?.url;
  const url = new URL(target || '');
  if (url.protocol !== 'https:' && !(process.env.NODE_ENV !== 'production' && ['localhost', '127.0.0.1'].includes(url.hostname))) throw new Error('Origine du jeu invalide.');
  return url.origin;
}
export async function callGame(command: ConnectorCommand): Promise<{ room: RoomSnapshot; session?: NativeSession }> {
  const raw = JSON.stringify(command), timestamp = String(Math.floor(Date.now() / 1000));
  const signature = createHmac('sha256', secret()).update(`rg-connector-v1.${timestamp}.${raw}`).digest('hex');
  const response = await fetch(`${gameOrigin(command.game)}/api/platform/connector`, {
    method: 'POST', body: raw, headers: { 'content-type': 'application/json', 'x-rg-signature': `${timestamp}.${signature}` },
    redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(12000),
  });
  if (!(response.headers.get('content-type') || '').includes('application/json')) throw new RequestError('Ce jeu ne permet pas encore les invitations directes.', 503);
  const data = await response.json();
  if (!response.ok) throw new RequestError(typeof data.error === 'string' ? data.error : 'Impossible de rejoindre ce salon.', response.status >= 500 ? 503 : 409);
  const r = data.room;
  if (!r || r.code !== command.room || typeof r.instance !== 'string' || r.instance.length > 160 ||
      !Number.isInteger(r.capacity) || r.capacity < 1 || r.capacity > 100 || !Number.isInteger(r.count) || r.count < 0 ||
      !['open', 'started', 'closed'].includes(r.status)) throw new RequestError('Réponse du jeu invalide.', 503);
  if (command.operation === 'admit' && (!data.session || data.session.code !== command.room)) throw new RequestError('Session du jeu manquante.', 503);
  return data;
}
