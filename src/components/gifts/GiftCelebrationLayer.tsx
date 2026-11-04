"use client";

import { useEffect, useState } from "react";
import { GiftArt } from "./GiftArt";
import type { GiftEvent } from "@/lib/gifts/types";

export function GiftCelebrationLayer() {
  const [queue, setQueue] = useState<GiftEvent[]>([]);
  const active = queue[0];
  useEffect(() => {
    const receive = (event: Event) => {
      const gift = (event as CustomEvent<GiftEvent>).detail;
      if (gift?.id) setQueue(items => items.some(item => item.id === gift.id) ? items : [...items, gift].slice(-30));
    };
    window.addEventListener("rg:gift-celebration", receive);
    return () => window.removeEventListener("rg:gift-celebration", receive);
  }, []);
  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(() => setQueue(items => items.slice(1)), 2200);
    return () => clearTimeout(timer);
  }, [active]);
  if (!active) return null;
  return <div className="rg-gift-celebration" aria-live="polite" role="status">
    <GiftArt src={active.gift.image_url} name={active.gift.name} animation={active.gift.animation_type} animated size={116} />
    <p><strong>{active.senderName}</strong> offre {active.gift.name}{active.quantity > 1 ? ` ×${active.quantity}` : ""} à <strong>{active.recipientName}</strong></p>
    {active.totalRev !== null && <small>+{active.totalRev} REV{active.totalReward !== null && active.totalReward > 0 ? ` · +${active.totalReward} pièces` : ""}</small>}
  </div>;
}
