import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { stripeList, stripeRequest, type Charge, type CheckoutSession, type StripeEvent } from "./api";
import { COIN_PACKS, isPackId } from "./catalog";

export const STRIPE_EVENTS = new Set([
  "checkout.session.completed", "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed", "checkout.session.expired",
  "charge.refunded", "refund.created", "refund.updated", "refund.failed",
  "charge.dispute.created", "charge.dispute.updated", "charge.dispute.closed",
  "payment_intent.payment_failed", "payment_intent.canceled",
]);
type Order = {
  id: string; user_id: string; pack_id: string; coins: number; amount: number;
  livemode: boolean; session_id: string | null; payment_intent: string | null;
};
type Intent = { id: string; metadata: { order_id?: string }; latest_charge: string | null; status: string; livemode: boolean };
type Refund = { id: string; status: string; amount: number; currency: string; charge: string };
type Dispute = { id: string; status: string; amount: number };

export function validatePaidSession(session: CheckoutSession, order: Order): void {
  if (!isPackId(order.pack_id)) throw new Error("Pack inconnu.");
  const pack = COIN_PACKS[order.pack_id];
  if (session.mode !== "payment" || session.livemode !== order.livemode || session.currency !== "eur" ||
      session.amount_total !== pack.amount || order.amount !== pack.amount || Number(order.coins) !== pack.coins ||
      session.client_reference_id !== order.user_id || session.metadata?.order_id !== order.id ||
      session.metadata?.user_id !== order.user_id || session.metadata?.pack_id !== order.pack_id ||
      (order.session_id && order.session_id !== session.id) ||
      (order.payment_intent && order.payment_intent !== session.payment_intent)) {
    throw new Error("Le paiement ne correspond pas à la commande.");
  }
}

export function netEntitlement(coins: number, amount: number, refunded: number, disputed: boolean) {
  if (!Number.isSafeInteger(refunded) || refunded < 0 || refunded > amount) throw new Error("Remboursement invalide.");
  // Round revocations up: multiple partial refunds never leave an extra coin.
  return disputed ? 0 : coins - Math.ceil(coins * refunded / amount);
}

export async function fulfillStripeEvent(event: StripeEvent, db: SupabaseClient) {
  if (!STRIPE_EVENTS.has(event.type)) return;
  const object = event.data.object;
  let orderId: string | undefined;
  let sessionId: string | undefined;
  let paymentIntentId: string | undefined;
  if (event.type.startsWith("checkout.session.")) {
    // Use Stripe's current state, never the possibly stale event snapshot.
    const session = await stripeRequest<CheckoutSession>(`checkout/sessions/${encodeURIComponent(object.id)}`);
    orderId = session.metadata?.order_id;
    sessionId = session.id;
  } else {
    let intentId = event.type.startsWith("payment_intent.") ? object.id : object.payment_intent;
    if (!intentId && object.charge) {
      const charge = await stripeRequest<Charge>(`charges/${encodeURIComponent(object.charge)}`);
      intentId = charge.payment_intent;
    }
    if (!intentId) return;
    paymentIntentId = intentId;
    const intent = await stripeRequest<Intent>(`payment_intents/${encodeURIComponent(intentId)}`);
    orderId = intent.metadata?.order_id;
  }
  // Other businesses/integrations on the same Stripe account are ignored.
  if (!orderId) return;
  const { data: order, error } = await db.from("stripe_purchases").select("*").eq("id", orderId).maybeSingle<Order>();
  if (error) throw new Error("Lecture commande impossible.");
  if (!order) throw new Error("Commande introuvable.");
  if (order.livemode !== event.livemode) throw new Error("Mode Stripe incompatible.");
  sessionId ||= order.session_id || undefined;
  if (!sessionId) {
    const sessions = await stripeRequest<{ data: CheckoutSession[] }>(`checkout/sessions?payment_intent=${encodeURIComponent(paymentIntentId || "")}&limit=2`);
    sessionId = sessions.data.find((s) => s.metadata?.order_id === order.id)?.id;
  }
  if (!sessionId) throw new Error("Session encore indisponible.");
  const token = randomUUID();
  const locked = await db.rpc("lock_stripe_purchase", { p_id: order.id, p_token: token });
  if (locked.error || !locked.data) throw new Error("Commande en cours de traitement.");
  try {
    const session = await stripeRequest<CheckoutSession>(`checkout/sessions/${encodeURIComponent(sessionId)}`);
    // Expired sessions can have a null amount_total; validate the full binding only for paid ones.
    if (session.metadata?.order_id !== order.id || session.client_reference_id !== order.user_id || session.livemode !== order.livemode) {
      throw new Error("Identité de session incompatible.");
    }
    let state = session.status === "expired" ? "expired" : "pending";
    let refunded = 0, entitled = 0;
    let receipt: string | null = null;
    let method: string | null = null;
    if (session.payment_status === "paid" && session.status === "complete") {
      validatePaidSession(session, order);
      if (!session.payment_intent) throw new Error("PaymentIntent absent.");
      const intent = await stripeRequest<Intent>(`payment_intents/${encodeURIComponent(session.payment_intent)}`);
      if (intent.status !== "succeeded" || !intent.latest_charge || intent.livemode !== order.livemode || intent.metadata.order_id !== order.id) {
        throw new Error("Paiement non confirmé.");
      }
      const charge = await stripeRequest<Charge>(`charges/${encodeURIComponent(intent.latest_charge)}`);
      if (!charge.paid || !charge.captured || charge.amount !== order.amount || charge.currency !== "eur" ||
          charge.payment_intent !== intent.id || charge.livemode !== order.livemode) throw new Error("Encaissement incompatible.");
      const refunds = await stripeList<Refund>(`refunds?charge=${encodeURIComponent(charge.id)}`);
      refunded = refunds.filter((r) => r.status === "succeeded").reduce((sum, r) => sum + r.amount, 0);
      const disputes = await stripeList<Dispute>(`disputes?charge=${encodeURIComponent(charge.id)}`);
      const disputed = disputes.some((d) => !["won", "warning_closed", "prevented"].includes(d.status));
      entitled = netEntitlement(Number(order.coins), order.amount, refunded, disputed);
      state = disputed ? "disputed" : refunded === order.amount ? "refunded" : refunded ? "partially_refunded" : "paid";
      if (charge.receipt_url?.startsWith("https://pay.stripe.com/")) receipt = charge.receipt_url;
      const details = charge.payment_method_details;
      const candidate = details?.card?.wallet?.type || details?.type;
      // A method label only. Never persist card numbers, last4, fingerprints or billing details.
      if (candidate && /^[a-z_]{1,50}$/.test(candidate)) method = candidate;
    } else if (["checkout.session.async_payment_failed", "payment_intent.payment_failed", "payment_intent.canceled"].includes(event.type) && state !== "expired") {
      state = "failed";
    }
    const applied = await db.rpc("apply_stripe_purchase", {
      p_id: order.id, p_token: token, p_event: event.id, p_type: event.type,
      p_session: session.id, p_intent: session.payment_intent,
      p_state: state, p_refunded: refunded, p_entitled: entitled, p_receipt: receipt, p_method: method,
    });
    if (applied.error) throw new Error("Écriture du paiement impossible.");
  } finally {
    // Token predicate prevents an expired worker from releasing a successor's lease.
    await db.from("stripe_purchases").update({ lease_token: null, lease_until: null }).eq("id", order.id).eq("lease_token", token);
  }
}
