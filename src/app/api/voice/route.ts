import { createHmac, timingSafeEqual } from "node:crypto";
import { AccessToken, RoomServiceClient, TrackSource } from "livekit-server-sdk";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { apiError, readLimitedBody, RequestError, requireSameOrigin, UUID_PATTERN } from "@/lib/request-security";
import { canJoinVoice, voiceMetadata, VOICE_CAPACITY, VOICE_PREFIX } from "@/lib/voice-shared";

const voicePasscodeFailures = new Map<string, { count: number; windowUntil: number; blockedUntil: number }>();

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

function voicePasscodeHash(roomId: string, passcode: string, secret: string) {
  return createHmac("sha256", secret).update(`${roomId}:${passcode}`).digest("hex");
}

function validVoicePasscode(storedHash: string | null, roomId: string, passcode: unknown, secret: string) {
  if (typeof passcode !== "string" || !/^\d{4}$/.test(passcode)) return false;
  if (typeof storedHash !== "string" || !/^[a-f0-9]{64}$/.test(storedHash)) return false;
  return timingSafeEqual(Buffer.from(storedHash, "hex"), Buffer.from(voicePasscodeHash(roomId, passcode, secret), "hex"));
}

function checkVoicePasscode(roomId: string, storedHash: string | null, passcode: unknown, secret: string) {
  const now = Date.now();
  const attempts = voicePasscodeFailures.get(roomId);
  if (attempts && attempts.blockedUntil > now) throw new RequestError("Trop d’essais. Réessaie dans quelques minutes.", 429);
  if (voicePasscodeFailures.size > 500) {
    for (const [key, attempt] of voicePasscodeFailures) if (attempt.windowUntil <= now && attempt.blockedUntil <= now) voicePasscodeFailures.delete(key);
  }
  if (validVoicePasscode(storedHash, roomId, passcode, secret)) { voicePasscodeFailures.delete(roomId); return true; }
  const activeWindow = attempts && attempts.windowUntil > now;
  const count = (activeWindow ? attempts.count : 0) + 1;
  const windowUntil = activeWindow ? attempts.windowUntil : now + 5 * 60_000;
  voicePasscodeFailures.set(roomId, { count, windowUntil, blockedUntil: count >= 5 ? now + 5 * 60_000 : 0 });
  return false;
}

async function findRoom(service: RoomServiceClient, name: string) {
  if (!/^rg-social-[0-9a-f-]{36}$/.test(name)) return undefined;
  // A room can be connected before it appears in the provider's full-room
  // inventory. Resolve the requested room directly, with a short bounded retry.
  for (let attempt = 0; attempt < 3; attempt++) {
    const room = (await service.listRooms([name])).find(room => room.name === name);
    if (room && voiceMetadata(room.name, room.metadata)) return room;
    if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 250));
  }
  return undefined;
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
    let acceptedInvitation = false;
    if (body.action === "joinInvitation") {
      if (typeof body.messageId !== "string" || !UUID_PATTERN.test(body.messageId)) throw new RequestError("Invitation invalide.");
      const { data: message } = await ctx.supabase.from("direct_messages")
        .select("voice_room_id,voice_room_sid,voice_expires_at,from_user_id")
        .eq("id", body.messageId).eq("to_user_id", ctx.user.id).single();
      if (!message?.voice_room_id || !message.voice_expires_at || Date.parse(message.voice_expires_at) <= Date.now()
        || !ctx.friendIds.has(message.from_user_id)) throw new RequestError("Invitation expirée ou indisponible.", 410);
      acceptedInvitation = true;
      body = { action: "join", roomId: message.voice_room_id, roomSid: message.voice_room_sid };
    }
    let native;
    if (body.action === "create") {
      const title = typeof body.title === "string" ? body.title.trim() : "";
      if (!title || title.length > 60) throw new RequestError("Choisis un nom de 1 à 60 caractères.");
      const passcode = typeof body.passcode === "string" ? body.passcode : "";
      if (passcode && !/^\d{4}$/.test(passcode)) throw new RequestError("Le code d’accès doit contenir exactement 4 chiffres.");
      // A deterministic owner room name prevents parallel creates from allocating extra rooms.
      const id = VOICE_PREFIX + ctx.user.id;
      const existing = await findRoom(ctx.service, id);
      const accessStore = createServiceClient();
      const { data: existingAccess, error: accessReadError } = await accessStore.from("voice_room_access_codes").select("passcode_hash").eq("room_id", id).maybeSingle();
      if (accessReadError) throw accessReadError;
      let hasPasscode = Boolean(existingAccess);
      if (passcode) {
        const { error: accessWriteError } = await accessStore.from("voice_room_access_codes").upsert({ room_id: id, host_user_id: ctx.user.id,
          passcode_hash: voicePasscodeHash(id, passcode, ctx.secret), updated_at: new Date().toISOString() }, { onConflict: "room_id" });
        if (accessWriteError) throw accessWriteError;
        hasPasscode = true;
      }
      const metadata = JSON.stringify({ kind: "rg-social-voice-v1", hostId: ctx.user.id, hostName: ctx.profile.username,
        hostAvatar: ctx.profile.avatar_url, title, visibility: body.visibility === "friends" ? "friends" : "public", hasPasscode,
      });
      native = existing
        ? await ctx.service.updateRoomMetadata(id, metadata)
        : await ctx.service.createRoom({ name: id, maxParticipants: VOICE_CAPACITY, emptyTimeout: 60, departureTimeout: 60, metadata });
    } else if ((body.action === "join" || body.action === "invite") && typeof body.roomId === "string") {
      native = await findRoom(ctx.service, body.roomId);
    } else { throw new RequestError("Demande invalide."); }
    const room = native && voiceMetadata(native.name, native.metadata);
    if (!native || !room || (body.roomSid && body.roomSid !== native.sid)
      || !canJoinVoice(room, ctx.user.id, ctx.friendIds, ctx.blockedIds)) throw new RequestError("Salon fermé ou accès non autorisé.", 404);
    if (body.action === "join" && room.locked && room.hostId !== ctx.user.id && !acceptedInvitation) {
      const { data: storedAccess, error: accessError } = await createServiceClient().from("voice_room_access_codes")
        .select("passcode_hash").eq("room_id", native.name).eq("host_user_id", room.hostId).maybeSingle();
      if (accessError) throw accessError;
      if (!checkVoicePasscode(native.name, storedAccess?.passcode_hash ?? null, body.passcode, ctx.secret)) {
        throw new RequestError("Code incorrect. Demande le code d’accès à l’hôte.", 403);
      }
    }
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
