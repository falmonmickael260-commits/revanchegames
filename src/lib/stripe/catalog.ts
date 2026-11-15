export const COIN_PACKS = {
  coins_1000: { name: "Découverte", coins: 1000, amount: 119 },
  coins_2000: { name: "Standard", coins: 2000, amount: 200 },
} as const;

export const STRIPE_PRODUCTS = {
  ...COIN_PACKS,
  bombshift_no_ads: { name: "BombShift sans publicité", coins: 0, amount: 99 },
} as const;
export type PackId = keyof typeof STRIPE_PRODUCTS;
export function isPackId(value: unknown): value is PackId {
  return typeof value === "string" && Object.hasOwn(STRIPE_PRODUCTS, value);
}

export function shopOrigin(env: Record<string, string | undefined> = process.env): string {
  const url = new URL(env.STRIPE_SITE_URL || "");
  if (url.username || url.password || url.pathname !== "/" || url.search || url.hash ||
      (url.protocol !== "https:" && !(env.NODE_ENV !== "production" && url.origin === "http://localhost:3000"))) {
    throw new Error("STRIPE_SITE_URL doit être une origine HTTPS.");
  }
  return url.origin;
}

export function stripeMode(env: Record<string, string | undefined> = process.env): boolean {
  if (!env.STRIPE_MODE || env.STRIPE_MODE === "test") return false;
  if (env.STRIPE_MODE === "live") return true;
  throw new Error("STRIPE_MODE invalide.");
}
