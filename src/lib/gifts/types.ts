export type Gift = {
  id: string;
  name: string;
  price_coins: number;
  rev_points: number;
  image_url: string;
  animation_type: string;
  rarity: "common" | "uncommon" | "rare" | "epic" | "legendary";
  active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  limited: boolean;
};

export type GiftEvent = {
  id: string;
  gift: Pick<Gift, "id" | "name" | "image_url" | "animation_type" | "rarity">;
  quantity: number;
  senderId: string;
  senderName: string;
  recipientId: string;
  recipientName: string;
  totalRev: number | null;
  totalReward: number | null;
  createdAt: string;
  context: "dm" | "voice";
};

export function celebrateGift(gift: GiftEvent) {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("rg:gift-celebration", { detail: gift }));
}
