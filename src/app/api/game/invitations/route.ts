import { apiError, readLimitedBody, requireSameOrigin, RequestError, UUID_PATTERN } from '@/lib/request-security';
import { gameUser, registerGameRoom } from '@/lib/game-connector/platform';
import { openSession } from '@/lib/game-connector/server';
import { isConnectedGame, validRoom } from '@/lib/game-connector/protocol';
import { createServiceClient } from '@/lib/supabase/server';
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const body = JSON.parse(Buffer.from(await readLimitedBody(request, 2048)).toString());
    if (!isConnectedGame(body.game) || !UUID_PATTERN.test(body.to) || (body.room && !validRoom(body.room))) throw new RequestError('Invitation invalide.');
    const { auth, user } = await gameUser();
    if (body.room) {
      const { data: membership } = await createServiceClient().from('game_room_memberships').select('sealed_session').eq('user_id', user.id).eq('game_slug', body.game).eq('room_code', body.room).single();
      if (!membership) throw new RequestError('Crée ou rejoins ce salon avant d’inviter un ami.', 409);
      await registerGameRoom(body.game, openSession(membership.sealed_session));
    }
    const { data, error } = await auth.rpc('send_game_invitation', { p_to_user_id: body.to, p_game_slug: body.game, p_room_code: body.room || null });
    if (error) throw new RequestError(error.message, 409);
    return Response.json({ id: data }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return apiError(error); }
}
