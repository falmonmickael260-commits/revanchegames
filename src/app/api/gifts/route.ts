import { DataPacket_Kind, RoomServiceClient } from "livekit-server-sdk";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { apiError, readLimitedBody, RequestError, requireSameOrigin, UUID_PATTERN } from "@/lib/request-security";
import { voiceMetadata, VOICE_GIFT_TOPIC } from "@/lib/voice-shared";

const GIFT_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const VOICE_ID = /^rg-social-[0-9a-f-]{36}$/;
const noStore = { "Cache-Control": "no-store" };

export async function GET() {
  try {
    const db = await createClient();
    const [{ data: gifts, error: catalogError }, { data: settings, error: settingsError }] = await Promise.all([
      db.from("gift_catalog").select("id,name,price_coins,rev_points,image_url,animation_type,rarity,active,starts_at,ends_at,limited").order("price_coins").order("name"),
      db.from("gift_settings").select("gifts_enabled,renta_enabled,max_quantity").eq("singleton", true).single(),
    ]);
    if (catalogError || settingsError) throw new RequestError("Catalogue indisponible.", 503);
    return Response.json({ gifts, settings: { ...settings, enabled: process.env.GIFT_FINANCIAL_APPROVED === "1" && settings.gifts_enabled } }, { headers: noStore });
  } catch (error) { return apiError(error); }
}

async function verifyVoiceParticipants(roomId: string, senderId: string, recipientId: string) {
  const url = process.env.LIVEKIT_URL, key = process.env.LIVEKIT_API_KEY, secret = process.env.LIVEKIT_API_SECRET;
  if (!url || !key || !secret) throw new RequestError("Salon vocal indisponible.", 503);
  const service = new RoomServiceClient(url.replace(/^ws/, "http"), key, secret);
  const room = (await service.listRooms([roomId])).find(item => item.name === roomId);
  if (!room || !voiceMetadata(room.name, room.metadata)) throw new RequestError("Salon fermé.", 404);
  const participants = await service.listParticipants(roomId);
  if (!participants.some(item => item.identity === senderId) || !participants.some(item => item.identity === recipientId)) {
    throw new RequestError("Les deux joueurs doivent être dans le salon.", 403);
  }
  return room.sid;
}

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const db = await createClient();
    const { data: { user } } = await db.auth.getUser();
    if (!user || user.is_anonymous || !user.email_confirmed_at) throw new RequestError("Compte confirmé requis.", 401);
    if (process.env.GIFT_FINANCIAL_APPROVED !== "1") throw new RequestError("Les cadeaux ne sont pas encore activés.", 503);
    let body: Record<string, unknown>;
    try { body = JSON.parse(new TextDecoder().decode(await readLimitedBody(request, 2048))); }
    catch { throw new RequestError("Demande invalide."); }
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new RequestError("Demande invalide.");
    const giftId = body.giftId, recipientId = body.recipientId, quantity = body.quantity;
    const context = body.context, roomId = body.roomId, idempotencyKey = body.idempotencyKey;
    if (typeof giftId !== "string" || !GIFT_ID.test(giftId) || typeof recipientId !== "string" || !UUID_PATTERN.test(recipientId)
      || typeof quantity !== "number" || !Number.isInteger(quantity) || quantity < 1 || quantity > 100
      || typeof idempotencyKey !== "string" || !UUID_PATTERN.test(idempotencyKey)
      || (context !== "dm" && context !== "voice")) throw new RequestError("Choix de cadeau invalide.");
    if (user.id === recipientId) throw new RequestError("Tu ne peux pas t’envoyer un cadeau.");
    let roomSid: string | null = null;
    let voiceRoomId: string | null = null;
    if (context === "voice") {
      if (typeof roomId !== "string" || !VOICE_ID.test(roomId)) throw new RequestError("Salon invalide.");
      voiceRoomId = roomId;
      roomSid = await verifyVoiceParticipants(voiceRoomId, user.id, recipientId);
    }
    const service = createServiceClient();
    const { data: batch, error } = await service.rpc("send_virtual_gift", {
      p_sender: user.id, p_recipient: recipientId, p_gift_id: giftId, p_quantity: quantity,
      p_context: context, p_room_id: voiceRoomId, p_room_sid: roomSid,
      p_idempotency_key: idempotencyKey,
    });
    if (error) {
      await service.from("gift_attempts").insert({ sender_id: user.id, recipient_id: recipientId,
        gift_id: giftId, idempotency_key: idempotencyKey, error_code: error.code || "unknown" });
      const known = ["P0001", "22023", "42501", "23505"].includes(error.code ?? "");
      throw new RequestError(known ? error.message : "Envoi du cadeau impossible.", known ? 409 : 503);
    }
    const { data: message } = context === "dm"
      ? await service.from("direct_messages").select("id").eq("gift_batch_id", batch.id).maybeSingle()
      : { data: null };
    if (voiceRoomId) {
      const url = process.env.LIVEKIT_URL!, key = process.env.LIVEKIT_API_KEY!, secret = process.env.LIVEKIT_API_SECRET!;
      const live = new RoomServiceClient(url.replace(/^ws/, "http"), key, secret);
      // La transaction est déjà enregistrée. Une panne réseau du signal temps
      // réel ne doit jamais provoquer un second débit lors d'un retry.
      try { await live.sendData(voiceRoomId, new TextEncoder().encode(JSON.stringify({ id: batch.id })),
        DataPacket_Kind.RELIABLE, { topic: VOICE_GIFT_TOPIC }); } catch { /* historique durable conservé */ }
    }
    return Response.json({ batch, messageId: message?.id ?? null }, { headers: noStore });
  } catch (error) { return apiError(error); }
}
