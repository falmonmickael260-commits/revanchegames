"use client";

import { useEffect, useState } from "react";
import { GiftArt } from "./GiftArt";
import type { GiftEvent } from "@/lib/gifts/types";

export function GiftMessageAttachment({ id }: { id: string }) {
  const [gift, setGift] = useState<GiftEvent | null>(null);
  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/gifts/events?id=${encodeURIComponent(id)}`, { cache: "no-store" }).then(async response => {
      if (!response.ok) return;
      const event = await response.json() as GiftEvent;
      if (!cancelled) setGift(event);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [id]);
  if (!gift) return null;
  return <div className="rg-gift-message" data-tier={gift.animationTier ?? "small"}>
    <GiftArt src={gift.gift.image_url} name={gift.gift.name} animation={gift.gift.animation_type} size={86} />
    <div><span className="rg-gift-message-eyebrow">CADEAU ENVOYÉ</span>
      <strong>{gift.gift.name}{gift.quantity > 1 ? ` ×${gift.quantity}` : ""}</strong>
      <span><b>{gift.senderName}</b> → <b>{gift.recipientName}</b></span>
      {gift.totalRev !== null && <small>+{gift.totalRev} REV{gift.totalReward !== null && gift.totalReward > 0 ? ` · +${gift.totalReward} pièces créditées` : ""}</small>}
    </div>
  </div>;
}
