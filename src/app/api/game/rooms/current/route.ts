import { apiError, readLimitedBody, requireSameOrigin, RequestError } from '@/lib/request-security';
import { isConnectedGame, validRoom } from '@/lib/game-connector/protocol';
import { gameUser, registerGameRoom } from '@/lib/game-connector/platform';
import { canPublishGame, hidePublicRoom, updatePublicRoom } from '@/lib/game-connector/public-rooms';

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const raw = await readLimitedBody(request, 8192);
    let body;
    try { body = JSON.parse(Buffer.from(raw).toString()); } catch { throw new RequestError("Demande invalide."); }
    if (!body || !isConnectedGame(body.game)) throw new RequestError('Jeu inconnu.');
    if (body.session === null && validRoom(body.room) && typeof body.instance === 'string' && body.instance.length > 0 && body.instance.length <= 160) {
      await hidePublicRoom(body.game, body.room, body.instance);
      return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
    }
    if (body.publish !== undefined && typeof body.publish !== 'boolean') throw new RequestError('Visibilité invalide.');
    const account = await gameUser();
    const room = await registerGameRoom(body.game, body.session, account);
    const listed = await updatePublicRoom(body.game, room, account.user.id, body.publish);
    return Response.json({ ...room, isHost: room.isHost === true && canPublishGame(body.game), listed }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return apiError(error); }
}
