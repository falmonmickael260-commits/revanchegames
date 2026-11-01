/** Never accepts a live key. Never creates/confirms a PaymentIntent or refund. */
export async function checkStripePermissions({ key, origin = "", createSession = false, fetchImpl = fetch }) {
  if (!/^(rk|sk)_test_/.test(key || "")) throw new Error("Une clé Stripe de test rk_test_ ou sk_test_ est obligatoire. Aucune clé réelle n’est acceptée.");
  const headers = { Authorization: `Bearer ${key}`, "Stripe-Version": "2026-10-28.endive" };
  const results = [];
  for (const [resource, path] of [
    ["Checkout Sessions · lecture", "checkout/sessions"],
    ["Payment Intents · lecture", "payment_intents"],
    ["Charges · lecture", "charges"],
    ["Refunds · lecture", "refunds"],
    ["Disputes · lecture", "disputes"],
  ]) {
    const response = await fetchImpl(`https://api.stripe.com/v1/${path}?limit=1`, { headers, signal: AbortSignal.timeout(15000), redirect: "error" });
    // Discard objects: the audit outputs HTTP status only, no customer data or secrets.
    results.push({ resource, ok: response.ok, status: response.status });
    await response.arrayBuffer();
  }
  if (createSession) {
    const url = new URL(origin || "");
    if (url.protocol !== "https:" || url.origin !== origin) throw new Error("STRIPE_SITE_URL doit être une origine HTTPS sans barre finale.");
    const body = new URLSearchParams({
      mode: "payment", success_url: `${origin}/shop`, cancel_url: `${origin}/shop`,
      "line_items[0][quantity]": "1", "line_items[0][price_data][currency]": "eur",
      "line_items[0][price_data][unit_amount]": "119",
      "line_items[0][price_data][product_data][name]": "Validation technique Revanche Games — aucun achat",
      "metadata[validation_only]": "true",
    });
    const response = await fetchImpl("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST", headers: { ...headers, "Content-Type": "application/x-www-form-urlencoded" }, body,
      signal: AbortSignal.timeout(15000), redirect: "error",
    });
    results.push({ resource: "Checkout Sessions · écriture avec prix et produit inline", ok: response.ok, status: response.status });
    if (response.ok) {
      const session = await response.json();
      if (session.livemode !== false || !/^cs_test_[a-zA-Z0-9]+$/.test(session.id)) throw new Error("Mode de session inattendu.");
      const expired = await fetchImpl(`https://api.stripe.com/v1/checkout/sessions/${session.id}/expire`, {
        method: "POST", headers, signal: AbortSignal.timeout(15000), redirect: "error",
      });
      results.push({ resource: "Expiration immédiate de la session de test non payée", ok: expired.ok, status: expired.status });
      await expired.arrayBuffer();
    } else { await response.arrayBuffer(); }
  }
  return results;
}

async function main() {
  try {
    const results = await checkStripePermissions({
      key: process.env.STRIPE_SECRET_KEY, origin: process.env.STRIPE_SITE_URL,
      createSession: process.argv.includes("--create-test-session"),
    });
    for (const result of results) console.log(`${result.ok ? "OK" : "ÉCHEC"} — ${result.resource} : HTTP ${result.status}`);
    console.log("Aucun débit, remboursement ou crédit de pièces effectué. Les permissions non sondées restent non vérifiées.");
    if (results.some((r) => !r.ok)) process.exitCode = 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Audit impossible.");
    process.exitCode = 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) void main();
