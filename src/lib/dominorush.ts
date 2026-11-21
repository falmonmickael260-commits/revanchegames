import { createHmac, timingSafeEqual } from 'node:crypto';
import { readLimitedBody, RequestError, UUID_PATTERN } from './request-security';
import { createServiceClient } from './supabase/server';

export async function readDomirushRequest(request: Request, purpose: 'identity' | 'result') {
  const secret = process.env.GAME_CONNECTOR_SECRET_DOMINORUSH;
  const header = /^(\d{10})\.([a-f0-9]{64})$/.exec(request.headers.get('x-rg-signature') ?? '');
  if (!secret || !header || Math.abs(Date.now() / 1000 - Number(header[1])) > 30) {
    throw new RequestError('Signature invalide.', 403);
  }
  const raw = Buffer.from(await readLimitedBody(request, 8192)).toString("utf8");
  const expected = createHmac('sha256', secret).update(`rg-dominorush-${purpose}-v1.${header[1]}.${raw}`).digest();
  if (!timingSafeEqual(expected, Buffer.from(header[2], 'hex'))) {
    throw new RequestError('Signature invalide.', 403);
  }
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new RequestError('Requête invalide.');
  }
}

let catalog: Promise<void> | undefined;

export function ensureDomirushCatalog() {
  return catalog ??= (async () => {
    const { error } = await createServiceClient().from('game_catalog').upsert(
      { slug: 'dominorush', display_name: 'Domirush', sort_order: 22 }, { onConflict: 'slug' },
    );
    if (error) throw new RequestError('Catalogue indisponible.', 503);
  })().catch(error => { catalog = undefined; throw error; });
}

type DomirushPlayer = { userId: string | null; name: string; score: number; position: number; outcome: 'win' | 'loss' };
type DomirushResult = { game: 'dominorush'; room: string; instance: string; players: DomirushPlayer[] };

export function validateDomirushResult(body: unknown): DomirushResult {
  const result = body as DomirushResult;
  if (!result || result.game !== 'dominorush' || !/^[A-HJ-NP-Z2-9]{6}$/.test(result.room) ||
      !UUID_PATTERN.test(result.instance) || !Array.isArray(result.players) ||
      result.players.length < 2 || result.players.length > 4) throw new RequestError('Résultat invalide.');
  const accounts = new Set<string>();
  for (const [index, player] of result.players.entries()) {
    if (!player || player.position !== index + 1 || player.outcome !== (index === 0 ? 'win' : 'loss') ||
        typeof player.name !== 'string' || player.name.length < 1 || player.name.length > 32 ||
        !Number.isSafeInteger(player.score) || player.score < 0 ||
        (player.userId !== null && (typeof player.userId !== 'string' || !UUID_PATTERN.test(player.userId) || accounts.has(player.userId)))) {
      throw new RequestError('Joueur invalide.');
    }
    if (player.userId) accounts.add(player.userId);
  }
  if (!accounts.size) throw new RequestError('Aucun compte à créditer.');
  return result;
}
