import { ensureDomirushCatalog, readDomirushRequest, validateDomirushResult } from '@/lib/dominorush';
import { RequestError } from '@/lib/request-security';
import { createServiceClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const data = validateDomirushResult(await readDomirushRequest(request, 'result'));
    await ensureDomirushCatalog();
    const { data: id, error } = await createServiceClient().rpc('record_game_result', {
      p_game_slug: data.game,
      p_room_code: data.room,
      p_idempotency_key: `dominorush:${data.instance}`,
      p_raw_payload: data,
      p_players: data.players.map(p => ({
        user_id: p.userId, guest_label: p.userId ? null : p.name, outcome: p.outcome, position: p.position, score: p.score,
      })),
    });
    if (error) throw new RequestError('Enregistrement indisponible.', 503);
    return Response.json({ id }, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return Response.json({ error: error instanceof RequestError ? error.message : 'Enregistrement indisponible.' },
      { status: error instanceof RequestError ? error.status : 503 });
  }
}
