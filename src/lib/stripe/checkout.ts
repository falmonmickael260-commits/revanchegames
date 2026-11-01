import { COIN_PACKS, type PackId } from "./catalog";

export function checkoutParameters(order: { id: string; user_id: string; pack_id: PackId; created_at: string }, origin: string) {
  const pack = COIN_PACKS[order.pack_id];
  const params = new URLSearchParams({
    mode: "payment", locale: "fr", client_reference_id: order.user_id,
    success_url: `${origin}/shop?payment=success`, cancel_url: `${origin}/shop?payment=cancelled`,
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": "eur",
    "line_items[0][price_data][unit_amount]": String(pack.amount),
    "line_items[0][price_data][product_data][name]": `${pack.coins.toLocaleString("fr-FR")} pièces Revanche Games`,
    "payment_method_options[card][request_three_d_secure]": "automatic",
    // Anchored to the persisted order: retries use exactly the same parameters.
    expires_at: String(Math.floor(new Date(order.created_at).getTime() / 1000) + 3600),
    "metadata[order_id]": order.id, "metadata[user_id]": order.user_id, "metadata[pack_id]": order.pack_id,
    "payment_intent_data[metadata][order_id]": order.id,
    "payment_intent_data[metadata][user_id]": order.user_id,
    "payment_intent_data[metadata][pack_id]": order.pack_id,
  });
  // Omit payment_method_types: Stripe dynamically selects enabled methods,
  // including card wallets and PayPal where the account/customer is eligible.
  return params;
}
