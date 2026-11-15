import { createHmac, timingSafeEqual } from 'node:crypto';
import { createServiceClient } from './supabase/server';
import { RequestError, UUID_PATTERN } from './request-security';

export async function trustedFortuneBody(request: Request, purpose: 'identity' | 'result') {
  const key = process.env.GAME_CONNECTOR_SECRET_FORTUNE_EMPIRE;
  const raw = await request.text();
  const [stamp, hex, extra] = (request.headers.get('x-rg-signature') || '').split('.');
  if (!key || raw.length > 16384 || extra || !/^\d{10}$/.test(stamp || '') || !/^[a-f0-9]{64}$/.test(hex || '') || Math.abs(Date.now()/1000-Number(stamp))>30) throw new RequestError('Signature invalide.',403);
  const expected = createHmac('sha256',key).update(`rg-fortune-${purpose}-v1.${stamp}.${raw}`).digest();
  if (!timingSafeEqual(expected,Buffer.from(hex,'hex'))) throw new RequestError('Signature invalide.',403);
  try { return JSON.parse(raw) as unknown; } catch { throw new RequestError('Envoi invalide.'); }
}

let catalog: Promise<void> | undefined;
export function ensureFortuneCatalog() {
  return catalog ??= (async()=>{
    const {error} = await createServiceClient().from('game_catalog').upsert({slug:'fortune-empire',display_name:'Fortune Empire',sort_order:20},{onConflict:'slug'});
    if(error) throw new RequestError('Catalogue indisponible.',503);
  })().catch(error=>{catalog=undefined;throw error;});
}
export type FortuneResult = {game:'fortune-empire';room:string;instance:string;startedAt:number;endedAt:number;players:{userId:string|null;name:string;outcome:'win'|'loss';score:number;position:number}[]};
export function validateFortuneResult(body: unknown): FortuneResult {
  const d=body as FortuneResult;
  if(!d || d.game!=='fortune-empire' || !/^[A-Z2-9]{5}$/.test(d.room) || !UUID_PATTERN.test(d.instance) || !Number.isFinite(d.startedAt) || !Number.isFinite(d.endedAt) || d.endedAt<d.startedAt || !Array.isArray(d.players) || d.players.length<2 || d.players.length>8) throw new RequestError('Résultat invalide.');
  const ids=new Set<string>(), ranks=new Set<number>();
  for(const p of d.players){
    if(!p || (p.userId!==null && (typeof p.userId!=='string' || !UUID_PATTERN.test(p.userId))) || typeof p.name!=='string' || p.name.length>32 || !['win','loss'].includes(p.outcome) || !Number.isSafeInteger(p.score) || !Number.isInteger(p.position) || p.position<1 || p.position>d.players.length || ranks.has(p.position)) throw new RequestError('Joueur invalide.');
    if(p.userId && ids.has(p.userId)) throw new RequestError('Compte dupliqué.');
    if(p.userId) ids.add(p.userId);
    ranks.add(p.position);
    if((p.outcome==='win')!==(p.position===1)) throw new RequestError('Classement invalide.');
  }
  if(d.players.filter(p=>p.outcome==='win').length!==1) throw new RequestError('Vainqueur invalide.');
  return d;
}
