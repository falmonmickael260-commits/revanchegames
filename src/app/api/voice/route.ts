import { AccessToken, RoomServiceClient, TrackSource } from "livekit-server-sdk";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { apiError, readLimitedBody, RequestError, requireSameOrigin, UUID_PATTERN } from "@/lib/request-security";
import { canJoinVoice, voiceMetadata, VOICE_CAPACITY, VOICE_PREFIX } from "@/lib/voice-shared";

async function context() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.is_anonymous) throw new RequestError("Connecte-toi à ton compte pour rejoindre le vocal.", 401);
  const { data: profile, error: profileError } = await supabase.from("profiles").select("username,avatar_url").eq("id", user.id).single();
  if (profileError || !profile) throw new RequestError("Profil introuvable.", 403);
  const { data: friendships, error } = await supabase.from("friendships")
    .select("requester_id,addressee_id,status");
  if (error) throw error;
  const otherId = (f: {requester_id:string;addressee_id:string}) => f.requester_id === user.id ? f.addressee_id : f.requester_id;
  const friendIds = new Set<string>((friendships ?? []).filter(f => f.status === "accepted").map(otherId));
  const blockedIds = new Set<string>((friendships ?? []).filter(f => f.status === "blocked").map(otherId));
  const url = process.env.LIVEKIT_URL;
  const key = process.env.LIVEKIT_API_KEY;
  const secret = process.env.LIVEKIT_API_SECRET;
  if (!url || !key || !secret) throw new RequestError("Les salons vocaux ne sont pas encore disponibles.", 503);
  const service = new RoomServiceClient(url.replace(/^ws/, "http"), key, secret);
  return { user, profile, friendIds, blockedIds, url, key, secret, service, supabase };
}

function json(data: unknown) {
  return Response.json(data, { headers: { "Cache-Control": "no-store" } });
}

export async function GET() {
  try {
    const ctx = await context();
    const rooms = (await ctx.service.listRooms()).flatMap(r => {
      const room = voiceMetadata(r.name, r.metadata);
      return room && canJoinVoice(room, ctx.user.id, ctx.friendIds, ctx.blockedIds) ? [{ ...room, instanceId: r.sid, count: r.numParticipants }] : [];
    });
    return json({ rooms });
  } catch (error) { return apiError(error); }
}

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const ctx = await context();
    let body;
    try { body = JSON.parse(new TextDecoder().decode(await readLimitedBody(request, 2048))); }
    catch (error) { if (error instanceof RequestError) throw error; throw new RequestError("Demande invalide."); }
    if (!body || typeof body !== "object") throw new RequestError("Demande invalide.");
    if (body.action === "joinInvitation") {
      if (typeof body.messageId !== "string" || !UUID_PATTERN.test(body.messageId)) throw new RequestError("Invitation invalide.");
      const { data: message } = await ctx.supabase.from("direct_messages")
        .select("voice_room_id,voice_room_sid,voice_expires_at,from_user_id")
        .eq("id", body.messageId).eq("to_user_id", ctx.user.id).single();
      if (!message?.voice_room_id || !message.voice_expires_at || Date.parse(message.voice_expires_at) <= Date.now()
        || !ctx.friendIds.has(message.from_user_id)) throw new RequestError("Invitation expirée ou indisponible.", 410);
      body = { action: "join", roomId: message.voice_room_id, roomSid: message.voice_room_sid };
    }
    const rooms = await ctx.service.listRooms();
    let native;
    if (body.action === "create") {
      const title = typeof body.title === "string" ? body.title.trim() : "";
      if (!title || title.length > 60) throw new RequestError("Choisis un nom de 1 à 60 caractères.");
      // A deterministic owner room name prevents parallel creates from allocating extra rooms.
      const id = VOICE_PREFIX + ctx.user.id;
      const existing = rooms.find(r => r.name === id);
      native = existing ?? await ctx.service.createRoom({
        name: id, maxParticipants: VOICE_CAPACITY, emptyTimeout: 60, departureTimeout: 60,
        metadata: JSON.stringify({ kind: "rg-social-voice-v1", hostId: ctx.user.id, hostName: ctx.profile.username,
          hostAvatar: ctx.profile.avatar_url, title, visibility: body.visibility === "friends" ? "friends" : "public" }),
      });
    } else if ((body.action === "join" || body.action === "invite") && typeof body.roomId === "string") {
      native = rooms.find(r => r.name === body.roomId);
    } else { throw new RequestError("Demande invalide."); }
    const room = native && voiceMetadata(native.name, native.metadata);
    if (!native || !room || (body.roomSid && body.roomSid !== native.sid)
      || !canJoinVoice(room, ctx.user.id, ctx.friendIds, ctx.blockedIds)) throw new RequestError("Salon fermé ou accès non autorisé.", 404);
    const participants = await ctx.service.listParticipants(native.name);
    if (body.action === "invite") {
      if (!participants.some(p => p.identity === ctx.user.id)) throw new RequestError("Rejoins la salle avant d’inviter un ami.", 403);
      if (room.visibility === "friends" && room.hostId !== ctx.user.id) throw new RequestError("Seul l’hôte peut inviter dans cette salle privée.", 403);
      if (typeof body.friendId !== "string" || !UUID_PATTERN.test(body.friendId) || !ctx.friendIds.has(body.friendId)) throw new RequestError("Invitation réservée à tes amis.", 403);
      if (participants.length >= VOICE_CAPACITY) throw new RequestError("Ce salon est complet.", 409);
      const { data: id, error } = await createServiceClient().rpc("send_verified_voice_invitation", {
        p_from: ctx.user.id, p_to: body.friendId, p_room_id: native.name, p_room_sid: native.sid, p_title: room.title,
      });
      if (error) throw new RequestError(error.code === "P0001" ? error.message : "Invitation impossible.", error.code === "P0001" ? 429 : 403);
      return json({ messageId: id });
    }
    if (participants.length >= VOICE_CAPACITY && !participants.some(p => p.identity === ctx.user.id)) {
      throw new RequestError("Ce salon est complet.", 409);
    }
    const token = new AccessToken(ctx.key, ctx.secret, { identity: ctx.user.id, name: ctx.profile.username, ttl: 60,
      metadata: JSON.stringify({ avatarUrl: ctx.profile.avatar_url }) });
    token.addGrant({ room: native.name, roomJoin: true, canPublish: true, canSubscribe: true,
      canPublishData: true, canUpdateOwnMetadata: false, canPublishSources: [TrackSource.MICROPHONE] });
    return json({ room: { ...room, instanceId: native.sid, count: participants.length }, serverUrl: ctx.url, token: await token.toJwt() });
  } catch (error) { return apiError(error); }
}
