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
  animation_tier?: "small" | "medium" | "prestige";
  celebration_message?: string;
};

export type GiftEvent = {
  id: string;
  gift: Pick<Gift, "id" | "name" | "image_url" | "animation_type" | "rarity"> & {
    animation_tier?: "small" | "medium" | "prestige";
    celebration_message?: string;
  };
  quantity: number;
  senderId: string;
  senderName: string;
  senderAvatarUrl?: string | null;
  recipientId: string;
  recipientName: string;
  recipientAvatarUrl?: string | null;
  totalRev: number | null;
  totalReward: number | null;
  createdAt: string;
  context: "dm" | "voice";
  animationTier?: "small" | "medium" | "prestige";
  celebrationMessage?: string;
  demo?: boolean;
};

export function celebrateGift(gift: GiftEvent) {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("rg:gift-celebration", { detail: gift }));
}
