"use client";

import { useEffect, useState } from "react";
import { GiftFireworkAnimation } from "./GiftFireworkAnimation";
import { GiftCinematicScene } from "./GiftCinematicScene";
import { giftAnimationPlan } from "@/lib/gifts/animation-plan";
import type { GiftEvent } from "@/lib/gifts/types";

export function GiftCelebrationLayer() {
  const [queue, setQueue] = useState<GiftEvent[]>([]);
  const active = queue[0];
  const plan = active
    ? giftAnimationPlan(active.gift.price_coins ?? (active.gift.animation_type === "firework" ? 520 : undefined), active.animationTier ?? "small")
    : null;
  const activeId = active?.id;
  const duration = plan?.duration;

  useEffect(() => {
    const receive = (event: Event) => {
      const gift = (event as CustomEvent<GiftEvent>).detail;
      if (gift?.id) setQueue(items => items.some(item => item.id === gift.id) ? items : [...items, gift].slice(-30));
    };
    window.addEventListener("rg:gift-celebration", receive);
    return () => window.removeEventListener("rg:gift-celebration", receive);
  }, []);

  useEffect(() => {
    if (!activeId || !duration) return;
    const actualDuration = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 1100 : duration;
    const timer = setTimeout(() => setQueue(items => items[0]?.id === activeId ? items.slice(1) : items), actualDuration);
    return () => clearTimeout(timer);
  }, [activeId, duration]);

  if (!active || !plan) return null;
  if (active.gift.animation_type === "firework") return <GiftFireworkAnimation key={active.id} event={active} />;

  return <GiftCinematicScene key={active.id} event={active} duration={plan.duration} level={plan.level} />;
}
