import { createClient, createServiceClient } from "@/lib/supabase/server";
import { apiError, RequestError, UUID_PATTERN } from "@/lib/request-security";
import { giftPresentation } from "@/lib/gifts/presentation";

type CatalogGiftRow = {
  id: string; name: string; image_url: string; animation_type: string; rarity: string;
  animation_tier: "small" | "medium" | "prestige" | null; celebration_message: string | null; price_coins: number;
};
type Joined<T> = T | T[] | null;
type CollectionRow = { gift_id: string; quantity: number; last_received_at: string; gift: Joined<CatalogGiftRow> };
type EventRow = { id: string; batch_id: string; gift_id: string; quantity: number; created_at: string; gift: Joined<CatalogGiftRow> };

function one<T>(value: Joined<T>): T | null { return Array.isArray(value) ? value[0] ?? null : value; }

function publicGift(value: CatalogGiftRow | null) {
  if (!value) return null;
  const presentation = giftPresentation({ id: value.id, price_coins: value.price_coins, rarity: value.rarity });
  return {
    id: value.id, name: value.name, image_url: value.image_url, animation_type: value.animation_type,
    rarity: value.rarity, animation_tier: presentation.tier,
    celebration_message: value.celebration_message ?? presentation.message,
  };
}

export async function GET(request: Request) {
  try {
    const userId = new URL(request.url).searchParams.get("userId");
    if (!userId || !UUID_PATTERN.test(userId)) throw new RequestError("Profil introuvable.", 404);

    const auth = await createClient();
    const { data: { user } } = await auth.auth.getUser();
    const service = createServiceClient();
    if (user?.id !== userId) {
      const { data: profile, error } = await service.from("profiles").select("id,profile_visible").eq("id", userId).maybeSingle();
      if (error || !profile?.profile_visible) throw new RequestError("Collection privée ou introuvable.", 404);
    }

    const [{ data: rawCollection, error: collectionError }, { data: rawEvents, error: eventsError }] = await Promise.all([
      service.from("gift_collection")
        .select("gift_id,quantity,last_received_at,gift:gift_catalog(id,name,image_url,animation_type,rarity,animation_tier,celebration_message,price_coins)")
        .eq("recipient_id", userId).order("last_received_at", { ascending: false }),
      service.from("gift_received_events")
        .select("id,batch_id,gift_id,quantity,created_at,gift:gift_catalog(id,name,image_url,animation_type,rarity,animation_tier,celebration_message,price_coins)")
        .eq("recipient_id", userId).order("created_at", { ascending: false }).limit(50),
    ]);
    if (collectionError || eventsError) throw new RequestError("Collection momentanément indisponible.", 503);

    const collection = (rawCollection ?? []) as unknown as CollectionRow[];
    const events = (rawEvents ?? []) as unknown as EventRow[];
    const batchIds = [...new Set(events.map(event => event.batch_id))];
    const { data: batches } = batchIds.length
      ? await service.from("gift_send_batches").select("id,sender_id").in("id", batchIds)
      : { data: [] as { id: string; sender_id: string | null }[] };
    const senderIds = [...new Set((batches ?? []).flatMap(batch => batch.sender_id ? [batch.sender_id] : []))];
    const { data: profiles } = senderIds.length
      ? await service.from("profiles").select("id,username,profile_visible").in("id", senderIds)
      : { data: [] as { id: string; username: string; profile_visible: boolean }[] };
    const batchSender = new Map((batches ?? []).map(batch => [batch.id, batch.sender_id]));
    const senderProfile = new Map((profiles ?? []).filter(profile => profile.profile_visible).map(profile => [profile.id, profile.username]));

    return Response.json({
      collection: collection.map(entry => ({ gift_id: entry.gift_id, quantity: entry.quantity,
        last_received_at: entry.last_received_at, gift: publicGift(one(entry.gift)) })),
      history: events.map(event => {
        const senderId = batchSender.get(event.batch_id);
        return { id: event.id, gift_id: event.gift_id, quantity: event.quantity, created_at: event.created_at,
          senderName: senderId ? senderProfile.get(senderId) ?? null : null, gift: publicGift(one(event.gift)) };
      }),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}
