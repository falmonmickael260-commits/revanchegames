import { createHash } from 'node:crypto';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { RequestError } from '@/lib/request-security';
import { gameUser } from './platform';
import { isConnectedGame, PUBLIC_ROOM_GAMES, type ConnectedGame, type RoomSnapshot } from './protocol';
import { callGame, openSession, sealSession } from './server';
import { GAMES } from '@/data/games';

export type PublicGameRoom = {
  id: string;
  game_slug: string;
  host_name: string;
  player_count: number;
  capacity: number;
  isHost: boolean;
  ownRoomCode?: string;
};
type DirectoryRoom = PublicGameRoom & { room_code: string; instance_key: string; host_id: string };
const directoryGames: readonly string[] = PUBLIC_ROOM_GAMES;
export const canPublishGame = (slug: string) => directoryGames.includes(slug) && GAMES.some(game => game.id === slug && game.enabled);

async function directory(viewer: string | null, id?: string) {
  const { data, error } = await createServiceClient().rpc('find_public_game_rooms', { p_viewer: viewer, ...(id ? { p_id: id } : {}) });
  if (error) throw new RequestError('La liste des salons est momentanément indisponible.', 503);
  return (data as DirectoryRoom[]).filter(room => canPublishGame(room.game_slug));
}

export async function listPublicGameRooms(): Promise<PublicGameRoom[]> {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  return (await directory(user?.id ?? null)).map(({ id, game_slug, host_name, player_count, capacity, host_id, room_code }) => ({
    id, game_slug, host_name, player_count, capacity, isHost: host_id === user?.id,
    ...(host_id === user?.id ? { ownRoomCode: room_code } : {}),
  }));
}

export async function joinPublicGameRoom(id: string) {
  const { user, name } = await gameUser('Connecte-toi pour rejoindre un salon.');
  const [room] = await directory(user.id, id);
  if (!room || !isConnectedGame(room.game_slug)) throw new RequestError('Ce salon est fermé, complet ou a déjà démarré.', 409);

  const db = createServiceClient();
  const { data: host } = await db.from('game_room_memberships').select('sealed_session')
    .eq('user_id', room.host_id).eq('game_slug', room.game_slug).eq('room_code', room.room_code)
    .eq('instance_key', room.instance_key).maybeSingle();
  if (!host) throw new RequestError('L’hôte a quitté le salon.', 409);

  // The host already has a seat: do not run admission against their own room.
  if (room.host_id === user.id) {
    const proof = openSession(host.sealed_session);
    const checked = await callGame({ v: 1, game: room.game_slug, operation: 'inspect', room: room.room_code, uid: user.id, name, proof });
    if (!checked.room?.isHost || checked.room.instance !== room.instance_key) throw new RequestError('Ce salon a été remplacé.', 409);
    return { game_slug: room.game_slug };
  }
  const { session } = await callGame({
    v: 1, game: room.game_slug, operation: 'admit', room: room.room_code, uid: user.id, name,
    proof: openSession(host.sealed_session), inviter: room.host_id, instance: room.instance_key,
    invitation: idForPlayer(id, user.id), publicJoin: true,
  });
  const { error } = await db.from('game_room_memberships').upsert({
    user_id: user.id, game_slug: room.game_slug, room_code: room.room_code,
    instance_key: room.instance_key, sealed_session: sealSession(session!), verified_at: new Date().toISOString(),
  });
  if (error) throw new RequestError('Connexion momentanément indisponible. Réessaie pour reprendre ta place.', 503);
  return { game_slug: room.game_slug };
}

// Stable across retries, and distinct for each player using the same public listing.
function idForPlayer(roomId: string, userId: string) {
  const bytes = createHash('sha256').update(`rg-public-admission:${roomId}:${userId}`).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export async function loadPublicGameAdmission(id: string, slug: string) {
  const { user } = await gameUser('Connecte-toi pour rejoindre un salon.');
  const db = createServiceClient();
  const { data: room } = await db.from('public_game_rooms').select('room_code,instance_key')
    .eq('id', id).eq('game_slug', slug).maybeSingle();
  if (!room) throw new RequestError('Salon introuvable.', 404);
  const { data: member } = await db.from('game_room_memberships').select('sealed_session')
    .eq('game_slug', slug).eq('room_code', room.room_code).eq('instance_key', room.instance_key)
    .eq('user_id', user.id).maybeSingle();
  if (!member) throw new RequestError('Connexion au salon indisponible.', 409);
  return { id, session: openSession(member.sealed_session) };
}

export async function updatePublicRoom(slug: ConnectedGame, room: RoomSnapshot, hostId: string, publish?: boolean) {
  if (!canPublishGame(slug) || room.isHost !== true) {
    if (publish !== undefined) throw new RequestError('Seul l’hôte d’un jeu compatible peut publier le salon.', 403);
    return false;
  }
  const db = createServiceClient();
  const target = { game_slug: slug, room_code: room.code, instance_key: room.instance };
  if (publish === true) {
    if (room.status !== 'open' || room.count >= room.capacity) throw new RequestError('Ce salon ne peut plus accueillir de joueurs.', 409);
    const { error } = await db.from('public_game_rooms').upsert({
      ...target, host_id: hostId, refreshed_at: new Date().toISOString(),
    }, { onConflict: 'game_slug,room_code,instance_key' });
    if (error) throw new RequestError('Impossible de publier ce salon.', 503);
    return true;
  }
  if (publish === undefined && room.status === 'open' && room.count < room.capacity) {
    // Only insert a new listing. A previous explicit private choice is kept.
    const { error } = await db.from('public_game_rooms').upsert({
      ...target, host_id: hostId, refreshed_at: new Date().toISOString(),
    }, { onConflict: 'game_slug,room_code,instance_key', ignoreDuplicates: true });
    if (error) throw new RequestError('Impossible de publier ce salon.', 503);
  }
  const active = db.from('public_game_rooms').update({ refreshed_at: publish === false ? null : new Date().toISOString() })
    .match({ ...target, host_id: hostId }).not('refreshed_at', 'is', null);
  const { data, error } = await active.select('id').maybeSingle();
  if (error && publish === false) throw new RequestError('Impossible de masquer ce salon.', 503);
  return publish !== false && Boolean(data);
}

export async function hidePublicRoom(slug: ConnectedGame, code: string, instance: string) {
  const { user } = await gameUser();
  const { error } = await createServiceClient().from('public_game_rooms').update({ refreshed_at: null })
    .match({ game_slug: slug, room_code: code, instance_key: instance, host_id: user.id }).not('refreshed_at', 'is', null);
  if (error) throw new RequestError('Impossible de masquer ce salon.', 503);
}
