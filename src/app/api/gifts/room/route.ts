import { RoomServiceClient } from "livekit-server-sdk";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { apiError, RequestError } from "@/lib/request-security";
import { voiceMetadata } from "@/lib/voice-shared";

const ROOM_ID = /^rg-social-[0-9a-f-]{36}$/;

export async function GET(request: Request) {
  try {
    const db = await createClient();
    const { data: { user } } = await db.auth.getUser();
    if (!user || user.is_anonymous) throw new RequestError("Connexion requise.", 401);
    const roomId = new URL(request.url).searchParams.get("roomId");
    if (!roomId || !ROOM_ID.test(roomId)) throw new RequestError("Salon invalide.");
    const url = process.env.LIVEKIT_URL, key = process.env.LIVEKIT_API_KEY, secret = process.env.LIVEKIT_API_SECRET;
    if (!url || !key || !secret) throw new RequestError("Salon indisponible.", 503);
    const live = new RoomServiceClient(url.replace(/^ws/, "http"), key, secret);
    const room = (await live.listRooms([roomId])).find(item => item.name === roomId);
    if (!room || !voiceMetadata(room.name, room.metadata)
      || !(await live.listParticipants(roomId)).some(item => item.identity === user.id)) {
      throw new RequestError("Salon inaccessible.", 403);
    }
    const service = createServiceClient();
    const { data: batches, error } = await service.from("gift_send_batches")
      .select("id,sender_id,recipient_id,quantity,total_rev,total_reward,context,created_at,gift:gift_catalog(id,name,image_url,animation_type,rarity)")
      .eq("context", "voice").eq("room_id", roomId).eq("room_sid", room.sid)
      .order("created_at", { ascending: false }).limit(20);
    if (error) throw new RequestError("Historique des cadeaux indisponible.", 503);
    const ids = [...new Set((batches ?? []).flatMap(batch => [batch.sender_id, batch.recipient_id]))];
    const { data: profiles } = ids.length
      ? await service.from("profiles").select("id,username").in("id", ids)
      : { data: [] as { id: string; username: string }[] };
    const name = (id: string) => profiles?.find(profile => profile.id === id)?.username ?? "Joueur";
    return Response.json({ events: (batches ?? []).filter(batch => batch.gift).reverse().map(batch => ({
      id: batch.id, gift: batch.gift, quantity: batch.quantity, senderId: batch.sender_id,
      senderName: name(batch.sender_id), recipientId: batch.recipient_id, recipientName: name(batch.recipient_id),
      totalRev: user.id === batch.recipient_id ? batch.total_rev : null,
      totalReward: user.id === batch.recipient_id ? batch.total_reward : null,
      createdAt: batch.created_at, context: batch.context,
    })) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}
