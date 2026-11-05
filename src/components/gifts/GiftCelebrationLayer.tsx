"use client";

import { useEffect, useState } from "react";
import { GiftArt } from "./GiftArt";
import { GiftFireworkAnimation } from "./GiftFireworkAnimation";
import type { GiftEvent } from "@/lib/gifts/types";

function Avatar({ url, name }: { url?: string | null; name: string }) {
  return <span className="rg-gift-celebration-avatar" aria-label={name} style={url ? { backgroundImage: `url("${url.replaceAll('"', "")}")` } : undefined}>
    {!url && name.slice(0, 1).toLocaleUpperCase("fr-FR")}
  </span>;
}

export function GiftCelebrationLayer() {
  const [queue, setQueue] = useState<GiftEvent[]>([]);
  const active = queue[0];
  const tier = active?.animationTier ?? "small";
  const duration = active?.gift.animation_type === "firework" ? 6800 : tier === "prestige" ? 4700 : tier === "medium" ? 3500 : 2100;

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
    const id = active.id;
    const timer = setTimeout(() => setQueue(items => items[0]?.id === id ? items.slice(1) : items), duration);
    return () => clearTimeout(timer);
  }, [active, duration]);

  if (!active) return null;
  const close = () => setQueue(items => items[0]?.id === active.id ? items.slice(1) : items);
  if (active.gift.animation_type === "firework") return <GiftFireworkAnimation key={active.id} event={active} onClose={close} />;

  return <div className={`rg-gift-celebration rg-gift-celebration--${tier}`} aria-live="polite" role="status">
    {active.demo && <span className="rg-gift-demo-badge">APERÇU ADMIN · AUCUNE TRANSACTION</span>}
    <div className="rg-gift-celebration-people"><Avatar url={active.senderAvatarUrl} name={active.senderName} />
      <span aria-hidden="true">offre</span><Avatar url={active.recipientAvatarUrl} name={active.recipientName} /></div>
    <GiftArt src={active.gift.image_url} name={active.gift.name} animation={active.gift.animation_type} animated size={tier === "small" ? 100 : 140} />
    <p><strong>{active.senderName}</strong> offre <b>{active.gift.name}{active.quantity > 1 ? ` ×${active.quantity}` : ""}</b> à <strong>{active.recipientName}</strong></p>
    <blockquote>{active.celebrationMessage ? `« ${active.celebrationMessage} »` : null}</blockquote>
  </div>;
}
