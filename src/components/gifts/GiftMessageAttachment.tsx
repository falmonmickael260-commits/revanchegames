"use client";

import { useEffect, useState } from "react";
import { GiftArt } from "./GiftArt";
import type { GiftEvent } from "@/lib/gifts/types";
import { celebrateGift } from "@/lib/gifts/types";

export function GiftMessageAttachment({ id, own = false, animate = false }: { id: string; own?: boolean; animate?: boolean }) {
  const [gift, setGift] = useState<GiftEvent | null>(null);
  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/gifts/events?id=${encodeURIComponent(id)}`, { cache: "no-store" }).then(async response => {
      if (!response.ok) return;
      const event = await response.json() as GiftEvent;
      if (!cancelled) {
        setGift(event);
        if (animate) celebrateGift(event);
      }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [id, animate]);
  if (!gift) return <span className="rg-gift-inline-loading">Chargement du cadeau…</span>;
  const quantity = gift.quantity > 1 ? ` ×${gift.quantity}` : "";
  const title = own
    ? <><strong>{gift.gift.name}{quantity}</strong> offert à <b>{gift.recipientName}</b></>
    : <><strong>{gift.gift.name}{quantity}</strong> reçu de <b>{gift.senderName}</b></>;
  const reward = gift.totalRev !== null
    ? `${own ? `${gift.recipientName} a reçu` : "Vous avez reçu"} +${gift.totalRev} REV${gift.totalReward !== null && gift.totalReward > 0 ? ` et +${gift.totalReward} pièces` : ""}.`
    : null;
  return <span className="rg-gift-inline" data-tier={gift.animationTier ?? "small"}>
    <GiftArt src={gift.gift.image_url} name={gift.gift.name} animation={gift.gift.animation_type} size={34} />
    <span className="rg-gift-inline-copy"><span>{title}</span>{reward && <small>{reward}</small>}</span>
  </span>;
}
