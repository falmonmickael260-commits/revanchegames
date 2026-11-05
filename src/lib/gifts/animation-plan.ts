export type GiftAnimationLevel = "small" | "medium" | "large" | "prestige";

export function giftAnimationPlan(price: number | undefined, fallback: GiftAnimationLevel = "small") {
  if (price !== undefined && Number.isFinite(price)) {
    if (price >= 500) return { level: "prestige" as const, duration: 7200 };
    if (price >= 250) return { level: "large" as const, duration: 5600 };
    if (price >= 100) return { level: "medium" as const, duration: 4400 };
    return { level: "small" as const, duration: 2500 };
  }

  if (fallback === "prestige") return { level: fallback, duration: 6000 };
  if (fallback === "large") return { level: fallback, duration: 5400 };
  if (fallback === "medium") return { level: fallback, duration: 4200 };
  return { level: fallback, duration: 2500 };
}
