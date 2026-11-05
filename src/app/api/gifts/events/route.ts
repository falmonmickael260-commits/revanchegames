import { RoomServiceClient } from "livekit-server-sdk";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { apiError, RequestError, UUID_PATTERN } from "@/lib/request-security";
import { voiceMetadata } from "@/lib/voice-shared";
import { giftPresentation } from "@/lib/gifts/presentation";

async function roomAccess(roomId: string, roomSid: string, userId: string) {
  const url = process.env.LIVEKIT_URL, key = process.env.LIVEKIT_API_KEY, secret = process.env.LIVEKIT_API_SECRET;
  if (!url || !key || !secret) return false;
  const client = new RoomServiceClient(url.replace(/^ws/, "http"), key, secret);
  const room = (await client.listRooms([roomId])).find(item => item.name === roomId);
  if (!room || room.sid !== roomSid || !voiceMetadata(room.name, room.metadata)) return false;
  return (await client.listParticipants(roomId)).some(item => item.identity === userId);
}

export async function GET(request: Request) {
  try {
    const db = await createClient();
    const { data: { user } } = await db.auth.getUser();
    if (!user || user.is_anonymous) throw new RequestError("Connexion requise.", 401);
    const id = new URL(request.url).searchParams.get("id");
    if (!id || !UUID_PATTERN.test(id)) throw new RequestError("Cadeau introuvable.", 404);
    const service = createServiceClient();
    const { data: batch, error } = await service.from("gift_send_batches")
      .select("id,sender_id,recipient_id,gift_id,quantity,unit_price,total_rev,total_reward,context,room_id,room_sid,created_at")
      .eq("id", id).maybeSingle();
    if (error || !batch) throw new RequestError("Cadeau introuvable.", 404);
    const participant = user.id === batch.sender_id || user.id === batch.recipient_id;
    if (!participant && (batch.context !== "voice" || !batch.room_id || !batch.room_sid
      || !(await roomAccess(batch.room_id, batch.room_sid, user.id)))) throw new RequestError("Cadeau inaccessible.", 403);
    const [{ data: gift }, { data: profiles }] = await Promise.all([
      service.from("gift_catalog").select("id,name,image_url,animation_type,rarity,animation_tier,celebration_message").eq("id", batch.gift_id).single(),
      service.from("profiles").select("id,username,avatar_url").in("id", [batch.sender_id, batch.recipient_id]),
    ]);
    if (!gift) throw new RequestError("Cadeau introuvable.", 404);
    const profile = (id: string) => profiles?.find(item => item.id === id);
    const sender = profile(batch.sender_id), recipient = profile(batch.recipient_id);
    const presentation = giftPresentation({ ...gift, price_coins: batch.unit_price });
    return Response.json({ id: batch.id, gift, quantity: batch.quantity, senderId: batch.sender_id,
      senderName: sender?.username ?? "Joueur", senderAvatarUrl: sender?.avatar_url ?? null,
      recipientId: batch.recipient_id, recipientName: recipient?.username ?? "Joueur",
      recipientAvatarUrl: recipient?.avatar_url ?? null,
      animationTier: gift.animation_tier ?? presentation.tier,
      celebrationMessage: gift.celebration_message || presentation.message,
      // Les montants réels ne sont visibles que par les deux participants directs.
      // Les autres membres d'une salle vocale reçoivent uniquement la présentation publique.
      totalRev: participant ? batch.total_rev : null,
      totalReward: participant ? batch.total_reward : null,
      createdAt: batch.created_at, context: batch.context }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}
