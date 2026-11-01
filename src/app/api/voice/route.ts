import { AccessToken, RoomServiceClient, TrackSource } from "livekit-server-sdk";
import { createClient } from "@/lib/supabase/server";
import { apiError, readLimitedBody, RequestError, requireSameOrigin } from "@/lib/request-security";
import { canJoinVoice, voiceMetadata, VOICE_CAPACITY, VOICE_PREFIX } from "@/lib/voice-shared";

async function context() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.is_anonymous) throw new RequestError("Connecte-toi à ton compte pour rejoindre le vocal.", 401);
  const { data: profile, error: profileError } = await supabase.from("profiles").select("username").eq("id", user.id).single();
  if (profileError || !profile) throw new RequestError("Profil introuvable.", 403);
  const { data: friendships, error } = await supabase.from("friendships")
    .select("requester_id,addressee_id").eq("status", "accepted");
  if (error) throw error;
  const friendIds = new Set<string>((friendships ?? []).map(f => f.requester_id === user.id ? f.addressee_id : f.requester_id));
  const url = process.env.LIVEKIT_URL;
  const key = process.env.LIVEKIT_API_KEY;
  const secret = process.env.LIVEKIT_API_SECRET;
  if (!url || !key || !secret) throw new RequestError("Les salons vocaux ne sont pas encore disponibles.", 503);
  const service = new RoomServiceClient(url.replace(/^ws/, "http"), key, secret);
  return { user, profile, friendIds, url, key, secret, service };
}

function json(data: unknown) {
  return Response.json(data, { headers: { "Cache-Control": "no-store" } });
}

export async function GET() {
  try {
    const ctx = await context();
    const rooms = (await ctx.service.listRooms()).flatMap(r => {
      const room = voiceMetadata(r.name, r.metadata);
      return room && canJoinVoice(room, ctx.user.id, ctx.friendIds) ? [{ ...room, count: r.numParticipants }] : [];
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
        metadata: JSON.stringify({ kind: "rg-social-voice-v1", hostId: ctx.user.id, hostName: ctx.profile.username, title }),
      });
    } else if (body.action === "join" && typeof body.roomId === "string") {
      native = rooms.find(r => r.name === body.roomId);
    } else { throw new RequestError("Demande invalide."); }
    const room = native && voiceMetadata(native.name, native.metadata);
    if (!native || !room || !canJoinVoice(room, ctx.user.id, ctx.friendIds)) throw new RequestError("Salon fermé ou réservé aux amis de l’hôte.", 404);
    const participants = await ctx.service.listParticipants(native.name);
    if (participants.length >= VOICE_CAPACITY && !participants.some(p => p.identity === ctx.user.id)) {
      throw new RequestError("Ce salon est complet.", 409);
    }
    const token = new AccessToken(ctx.key, ctx.secret, { identity: ctx.user.id, name: ctx.profile.username, ttl: 60 });
    token.addGrant({ room: native.name, roomJoin: true, canPublish: true, canSubscribe: true,
      canPublishData: false, canUpdateOwnMetadata: false, canPublishSources: [TrackSource.MICROPHONE] });
    return json({ room: { ...room, count: participants.length }, serverUrl: ctx.url, token: await token.toJwt() });
  } catch (error) { return apiError(error); }
}
