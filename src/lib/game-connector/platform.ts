import { randomUUID } from 'node:crypto';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { RequestError } from '@/lib/request-security';
import { callGame, openSession, sealSession } from './server';
import { isConnectedGame, validRoom, type ConnectedGame, type NativeSession } from './protocol';

export async function gameUser() {
  const auth = await createClient();
  const { data: { user }, error } = await auth.auth.getUser();
  if (error || !user || user.is_anonymous) throw new RequestError('Connecte-toi pour inviter un ami.', 401);
  const { data: profile } = await auth.from('profiles').select('username').eq('id', user.id).single();
  if (!profile) throw new RequestError('Profil introuvable.', 401);
  return { auth, user, name: profile.username as string };
}

export async function registerGameRoom(slug: ConnectedGame, session: NativeSession) {
  const { user, name } = await gameUser();
  if (!validRoom(session?.code)) throw new RequestError('Salon invalide.');
  const { room } = await callGame({ v: 1, game: slug, operation: 'inspect', room: session.code, uid: user.id, name, proof: session });
  const db = createServiceClient();
  const r = await db.from('room_registry').upsert({ game_slug: slug, room_code: room.code, instance_key: room.instance,
    capacity: room.capacity, player_count: room.count, status: room.status === 'open' && room.count >= room.capacity ? 'full' : room.status,
    refreshed_at: new Date().toISOString() }, { onConflict: 'game_slug,room_code' });
  if (r.error) throw new RequestError('Registre des salons indisponible.', 503);
  const m = await db.from('game_room_memberships').upsert({ user_id: user.id, game_slug: slug, room_code: room.code,
    instance_key: room.instance, sealed_session: sealSession(session), verified_at: new Date().toISOString() });
  if (m.error) throw new RequestError('Présence dans le salon indisponible.', 503);
  return room;
}

export async function acceptGameInvitation(id: string) {
  const { auth, user, name } = await gameUser();
  const { data: invitation } = await auth.from('game_invitations').select('*').eq('id', id).eq('to_user_id', user.id).single();
  if (!invitation || !isConnectedGame(invitation.game_slug)) throw new RequestError('Invitation introuvable.', 404);
  if (!invitation.room_code) {
    const result = await auth.rpc('respond_to_game_invitation', { p_invitation_id: id, p_accept: true });
    if (result.error) throw new RequestError(result.error.message, 409);
    return { status: 'accepted', game_slug: invitation.game_slug, room_code: null };
  }
  const lease = randomUUID();
  const claim = await auth.rpc('claim_game_admission', { p_invitation: id, p_lease: lease });
  if (claim.error) throw new RequestError(claim.error.message, 409);
  const db = createServiceClient();
  if (!claim.data.completed_at) {
    try {
      const { data: member } = await db.from('game_room_memberships').select('*').eq('user_id', invitation.from_user_id)
        .eq('game_slug', invitation.game_slug).eq('room_code', invitation.room_code).single();
      if (!member || member.instance_key !== invitation.room_instance) throw new RequestError('Ce salon a fermé ou a été remplacé.', 409);
      const result = await callGame({ v: 1, game: invitation.game_slug, operation: 'admit', room: invitation.room_code,
        uid: user.id, name, proof: openSession(member.sealed_session), inviter: invitation.from_user_id,
        instance: invitation.room_instance, invitation: id });
      const complete = await db.rpc('complete_game_admission', { p_invitation: id, p_lease: lease, p_session: sealSession(result.session!) });
      if (complete.error) throw new RequestError('Connexion créée ; réessaie pour la reprendre.', 503);
    } catch (error) {
      await db.from('game_admissions').update({ lease_token: null, lease_until: null }).eq('invitation_id', id).eq('lease_token', lease);
      throw error;
    }
  }
  return { status: 'accepted', game_slug: invitation.game_slug, room_code: invitation.room_code, invitation_id: id };
}

export async function loadGameAdmission(id: string, slug: string) {
  const { auth, user } = await gameUser();
  const { data: invitation } = await auth.from('game_invitations').select('game_slug,status').eq('id', id).eq('to_user_id', user.id).single();
  if (!invitation || invitation.game_slug !== slug || invitation.status !== 'accepted') throw new RequestError('Invitation introuvable.', 404);
  const { data } = await createServiceClient().from('game_admissions').select('sealed_session').eq('invitation_id', id).eq('user_id', user.id).not('completed_at', 'is', null).single();
  if (!data?.sealed_session) throw new RequestError('Connexion au salon indisponible.', 409);
  return { id, session: openSession(data.sealed_session) };
}
