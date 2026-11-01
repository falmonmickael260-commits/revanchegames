import { apiError, readLimitedBody, requireSameOrigin, RequestError } from '@/lib/request-security';
import { isConnectedGame } from '@/lib/game-connector/protocol';
import { registerGameRoom } from '@/lib/game-connector/platform';
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const body = JSON.parse(Buffer.from(await readLimitedBody(request, 8192)).toString());
    if (!isConnectedGame(body.game)) throw new RequestError('Jeu inconnu.');
    return Response.json(await registerGameRoom(body.game, body.session), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return apiError(error); }
}
