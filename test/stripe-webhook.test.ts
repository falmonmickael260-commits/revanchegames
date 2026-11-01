import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { handleStripeWebhook } from "../src/lib/stripe/webhook";
import type { StripeEvent } from "../src/lib/stripe/api";

const secret = "whsec_local_request_test";
const event: StripeEvent = {
  id: "evt_request_test", type: "checkout.session.completed", livemode: false,
  data: { object: { id: "cs_test_request" } },
};
function signed(raw = JSON.stringify(event), timestamp = Math.floor(Date.now() / 1000)) {
  const signature = createHmac("sha256", secret).update(`${timestamp}.${raw}`).digest("hex");
  return new Request("https://shop.test/api/stripe/webhook", {
    method: "POST", headers: { "Stripe-Signature": `t=${timestamp},v1=${signature}` }, body: raw,
  });
}

test("Webhook HTTP : signature obligatoire avant tout accès au portefeuille", async () => {
  let calls = 0;
  const dependencies = { secret, liveMode: () => false, fulfill: async () => { calls++; } };
  const unsigned = new Request("https://shop.test/api/stripe/webhook", { method: "POST", body: JSON.stringify(event) });
  assert.equal((await handleStripeWebhook(unsigned, dependencies)).status, 400);
  const altered = signed();
  const forged = new Request(altered.url, { method: "POST", headers: altered.headers, body: JSON.stringify(event) + " " });
  assert.equal((await handleStripeWebhook(forged, dependencies)).status, 400);
  assert.equal((await handleStripeWebhook(signed(undefined, Math.floor(Date.now() / 1000) - 301), dependencies)).status, 400);
  assert.equal(calls, 0);
});

test("Webhook HTTP : corps brut UTF-8 et espaces conservés, 2xx après traitement", async () => {
  let received: StripeEvent | undefined;
  const raw = JSON.stringify({ ...event, note: "Pièces Revanche — été" }, null, 2) + "\n";
  const response = await handleStripeWebhook(signed(raw), {
    secret, liveMode: () => false, fulfill: async (value) => { received = value; },
  });
  assert.equal(response.status, 200);
  assert.equal(received?.id, event.id);
  assert.deepEqual(await response.json(), { received: true });
});

test("Webhook HTTP : séparation test/live et schéma invalide sans crédit", async () => {
  let calls = 0;
  const dependencies = { secret, liveMode: () => false, fulfill: async () => { calls++; } };
  assert.equal((await handleStripeWebhook(signed(JSON.stringify({ ...event, livemode: true })), dependencies)).status, 400);
  for (const value of [null, {}, { ...event, data: { object: { id: 1 } } }, { ...event, livemode: "false" }]) {
    assert.equal((await handleStripeWebhook(signed(JSON.stringify(value)), dependencies)).status, 400);
  }
  assert.equal(calls, 0);
});

test("Webhook HTTP : erreur Supabase réessayable et aucun faux acquittement", async () => {
  const response = await handleStripeWebhook(signed(), {
    secret, liveMode: () => false, fulfill: async () => { throw new Error("Supabase indisponible"); },
  });
  assert.equal(response.status, 500);
  assert.equal(await response.text(), "Traitement à réessayer");
});

test("Webhook HTTP : configuration manquante, corps excessif et événement hors périmètre", async () => {
  let calls = 0;
  const dependencies = { secret, liveMode: () => false, fulfill: async () => { calls++; } };
  for (const value of [undefined, "invalid", "whsec_"]) {
    assert.equal((await handleStripeWebhook(signed(), { ...dependencies, secret: value })).status, 503);
  }
  assert.equal((await handleStripeWebhook(signed("x".repeat(1048577)), dependencies)).status, 413);
  assert.equal((await handleStripeWebhook(signed(JSON.stringify({ ...event, type: "customer.created" })), dependencies)).status, 200);
  assert.equal(calls, 0);
});
