import { createHmac, timingSafeEqual } from "node:crypto";
import { stripeMode } from "./catalog";

// Small server-only REST adapter: no browser dependency, no secrets in logs.
export async function stripeRequest<T>(path: string, body?: URLSearchParams, idempotencyKey?: string): Promise<T> {
  const key = process.env.STRIPE_SECRET_KEY || "";
  const mode = stripeMode() ? "live" : "test";
  if (!new RegExp(`^(rk|sk)_${mode}_`).test(key)) throw new Error("Clé Stripe absente ou mode incompatible.");
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${key}`,
      "Stripe-Version": "2026-10-28.endive",
      ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    },
    body, cache: "no-store", signal: AbortSignal.timeout(15000), redirect: "error",
  });
  if (!response.ok) throw new Error(`Stripe HTTP ${response.status}`);
  return response.json() as Promise<T>;
}

export async function stripeList<T extends { id: string }>(path: string): Promise<T[]> {
  const result: T[] = [];
  for (let page = 0; page < 20; page++) {
    const cursor = result.length ? `&starting_after=${encodeURIComponent(result[result.length - 1].id)}` : "";
    const list = await stripeRequest<{ data: T[]; has_more: boolean }>(`${path}&limit=100${cursor}`);
    result.push(...list.data);
    if (!list.has_more) return result;
    if (!list.data.length) break;
  }
  throw new Error("Pagination Stripe incomplète.");
}

export function verifyStripeSignature(raw: string, header: string | null, secret: string, now = Date.now()): void {
  if (!secret.startsWith("whsec_") || !header) throw new Error("Signature absente.");
  const fields = header.split(",").map((part) => part.trim().split("="));
  const timestamps = fields.filter(([key]) => key === "t");
  const timestamp = timestamps[0]?.[1] || "";
  if (timestamps.length !== 1 || !/^\d+$/.test(timestamp) || Math.abs(now / 1000 - Number(timestamp)) > 300) {
    throw new Error("Signature expirée.");
  }
  const digest = createHmac("sha256", secret).update(`${timestamp}.${raw}`).digest();
  const valid = fields.some(([key, value]) => key === "v1" && /^[a-f0-9]{64}$/i.test(value || "") &&
    timingSafeEqual(digest, Buffer.from(value, "hex")));
  if (!valid) throw new Error("Signature invalide.");
}

export type CheckoutSession = {
  id: string; url: string | null; livemode: boolean; mode: string; status: string;
  payment_status: string; amount_total: number; currency: string;
  client_reference_id: string; payment_intent: string | null;
  metadata: { order_id?: string; user_id?: string; pack_id?: string };
};
export type Charge = {
  id: string; payment_intent: string; amount: number; currency: string; paid: boolean;
  captured: boolean; livemode: boolean; receipt_url: string | null;
  payment_method_details?: { type?: string; card?: { wallet?: { type?: string } | null } };
};
export type StripeEvent = {
  id: string; type: string; livemode: boolean; data: { object: {
    id: string; metadata?: { order_id?: string }; payment_intent?: string | null; charge?: string;
  } };
};
