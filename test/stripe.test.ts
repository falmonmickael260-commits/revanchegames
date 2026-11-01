import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import type { SupabaseClient } from "@supabase/supabase-js";
import { verifyStripeSignature, stripeRequest, type CheckoutSession, type StripeEvent } from "../src/lib/stripe/api";
import { checkoutParameters } from "../src/lib/stripe/checkout";
import { isPackId, shopOrigin, stripeMode } from "../src/lib/stripe/catalog";
import { fulfillStripeEvent, netEntitlement, validatePaidSession } from "../src/lib/stripe/fulfillment";
import { checkStripePermissions } from "../scripts/check-stripe-permissions.mjs";

test("Audit de permissions : clé live rejetée, lecture seule par défaut, session test jamais payée", async () => {
  let calls: { url: string; method: string }[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = String(input); calls.push({ url, method: init?.method || "GET" });
    if (url.endsWith("/checkout/sessions") && init?.method === "POST") {
      const body = new URLSearchParams(String(init.body));
      assert.equal(body.has("metadata[order_id]"), false);
      return Response.json({ id: "cs_test_AuditFixture", livemode: false });
    }
    return Response.json({ data: [] });
  };
  await assert.rejects(checkStripePermissions({ key: "rk_live_never_use", fetchImpl }), /clé Stripe de test/);
  assert.equal(calls.length, 0);
  const read = await checkStripePermissions({ key: "rk_test_fixture", fetchImpl });
  assert.equal(read.length, 5); assert.ok(calls.every((call) => call.method === "GET"));
  calls = [];
  const result = await checkStripePermissions({ key: "rk_test_fixture", origin: "https://shop.test", createSession: true, fetchImpl });
  assert.equal(result.length, 7);
  assert.deepEqual(calls.filter((c) => c.method === "POST").map((c) => new URL(c.url).pathname), ["/v1/checkout/sessions", "/v1/checkout/sessions/cs_test_AuditFixture/expire"]);
});

test("Stripe : signature brute, rotation, rejeu et modes", async () => {
  const raw = '{"id":"evt_test","value":1}';
  const secret = "whsec_local_fixture";
  const now = 1800000000000;
  const timestamp = String(now / 1000);
  const signature = createHmac("sha256", secret).update(`${timestamp}.${raw}`).digest("hex");
  const header = `t=${timestamp},v1=${"0".repeat(64)},v1=${signature}`;
  verifyStripeSignature(raw, header, secret, now);
  assert.throws(() => verifyStripeSignature(raw + " ", header, secret, now));
  assert.throws(() => verifyStripeSignature(raw, header, secret, now + 301000));
  assert.throws(() => verifyStripeSignature(raw, header, secret, now - 301000));
  assert.throws(() => verifyStripeSignature(raw, header + `,t=${timestamp}`, secret, now));
  assert.throws(() => verifyStripeSignature(raw, null, secret, now));
  assert.throws(() => verifyStripeSignature(raw, header, "whsec_wrong", now));
  assert.equal(stripeMode({} as NodeJS.ProcessEnv), false);
  assert.throws(() => stripeMode({ STRIPE_MODE: "oops" }));
  assert.throws(() => shopOrigin({ STRIPE_SITE_URL: "https://evil.test/path" }));
  assert.throws(() => shopOrigin({ STRIPE_SITE_URL: "https://user:pass@shop.test" }));
  assert.equal(shopOrigin({ STRIPE_SITE_URL: "https://shop.test/" }), "https://shop.test");
  assert.equal(isPackId("__proto__"), false);
});

test("Stripe : catalogue et prix serveur, paramètres stables", () => {
  const order = { id: randomUUID(), user_id: randomUUID(), pack_id: "coins_1000" as const, created_at: "2026-11-01T10:00:00Z" };
  const params = checkoutParameters(order, "https://shop.test");
  assert.equal(params.get("line_items[0][price_data][unit_amount]"), "119");
  assert.equal(params.get("line_items[0][quantity]"), "1");
  assert.equal(params.has("payment_method_types[0]"), false);
  assert.equal(params.get("metadata[user_id]"), order.user_id);
  assert.equal(params.get("payment_intent_data[metadata][order_id]"), order.id);
  assert.equal(params.toString(), checkoutParameters(order, "https://shop.test").toString());
  assert.equal(checkoutParameters({ ...order, pack_id: "coins_2000" }, "https://shop.test").get("line_items[0][price_data][unit_amount]"), "200");
  assert.equal(netEntitlement(1000, 119, 119, false), 0);
  assert.equal(netEntitlement(1000, 119, 1, false), 991);
  assert.equal(netEntitlement(2000, 200, 50, false), 1500);
  assert.equal(netEntitlement(1000, 119, 0, true), 0);
  assert.throws(() => netEntitlement(1000, 119, 120, false));
});

test("Stripe : paiement → webhook → portefeuille, remboursements, isolation et reprises", async (t) => {
  const db = new PGlite();
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.STRIPE_SECRET_KEY;
  const originalMode = process.env.STRIPE_MODE;
  process.env.STRIPE_SECRET_KEY = "rk_test_local_fixture";
  process.env.STRIPE_MODE = "test";
  const player = randomUUID(), other = randomUUID();
  const orderId = randomUUID();
  let refunded = 0, refundStatus = "succeeded", disputeStatus: string | null = null, apiFailure = false;
  let paymentStatus = "paid";
  const session = (): CheckoutSession => ({
    id: "cs_test_fixture", url: null, livemode: false, mode: "payment", status: "complete",
    payment_status: paymentStatus, amount_total: 119, currency: "eur", client_reference_id: player,
    payment_intent: "pi_fixture", metadata: { order_id: orderId, user_id: player, pack_id: "coins_1000" },
  });
  const intent = { id: "pi_fixture", status: "succeeded", latest_charge: "ch_fixture", livemode: false, metadata: { order_id: orderId } };
  const event = (id: string, type = "checkout.session.completed"): StripeEvent => ({
    id, type, livemode: false, data: { object: type.startsWith("checkout") ? { id: "cs_test_fixture" } : { id: "re_fixture", payment_intent: "pi_fixture" } },
  });
  globalThis.fetch = async (input, init) => {
    assert.equal(init?.headers && (init.headers as Record<string, string>).Authorization, "Bearer rk_test_local_fixture");
    if (apiFailure) return new Response("offline", { status: 503 });
    const url = new URL(String(input));
    assert.equal(url.origin, "https://api.stripe.com");
    if (url.pathname.startsWith("/v1/checkout/sessions/")) return Response.json(session());
    if (url.pathname === "/v1/checkout/sessions") return Response.json({ data: [session()] });
    if (url.pathname.startsWith("/v1/payment_intents/")) return Response.json(intent);
    if (url.pathname.startsWith("/v1/charges/")) return Response.json({ id: "ch_fixture", payment_intent: "pi_fixture", amount: 119, currency: "eur", paid: true, captured: true, livemode: false, receipt_url: "https://pay.stripe.com/receipts/fixture" });
    if (url.pathname === "/v1/refunds") return Response.json({ data: refunded ? [{ id: "re_fixture", status: refundStatus, amount: refunded, currency: "eur", charge: "ch_fixture" }] : [], has_more: false });
    if (url.pathname === "/v1/disputes") return Response.json({ data: disputeStatus ? [{ id: "du_fixture", status: disputeStatus, amount: 119 }] : [], has_more: false });
    throw new Error(`Unexpected Stripe path ${url.pathname}`);
  };
  // Real PostgreSQL functions and triggers, with the same API contract as Supabase.
  const adapter = {
    rpc: async (name: string, args: Record<string, unknown>) => {
      try {
        assert.ok(["lock_stripe_purchase", "apply_stripe_purchase"].includes(name));
        const keys = Object.keys(args);
        const result = await db.query<Record<string, unknown>>(`select public.${name}(${keys.map((k, i) => `${k} => $${i + 1}`).join(",")}) as result`, Object.values(args));
        return { data: result.rows[0].result, error: null };
      } catch (error) { return { data: null, error }; }
    },
    from: (table: string) => {
      assert.equal(table, "stripe_purchases");
      return {
        select: () => ({ eq: (_key: string, value: string) => ({ maybeSingle: async () => ({ data: (await db.query("select * from stripe_purchases where id=$1", [value])).rows[0], error: null }) }) }),
        update: () => ({ eq: (_key: string, id: string) => ({ eq: async (_tokenKey: string, token: string) => db.query("update stripe_purchases set lease_token=null,lease_until=null where id=$1 and lease_token=$2", [id, token]) }) }),
      };
    },
  } as unknown as SupabaseClient;
  const run = (id: string, type?: string) => fulfillStripeEvent(event(id, type), adapter);
  const balance = async () => Number((await db.query<{ balance_coins: number }>("select balance_coins from wallet_accounts where user_id=$1", [player])).rows[0]?.balance_coins || 0);
  const debt = async () => Number((await db.query<{ coins: number }>("select coins from stripe_wallet_debts where user_id=$1", [player])).rows[0]?.coins || 0);
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key, raw_user_meta_data jsonb default '{}');
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      create publication supabase_realtime;`);
    for (const file of ["20261025000000_platform_core.sql", "20261031000000_promo_codes.sql", "20261031020000_role_reservations.sql", "20261031030000_wallet_trigger_fix.sql", "20261031040000_role_selection_deferred_charge.sql", "20261101000000_stripe_shop.sql"]) {
      await db.exec(await readFile(new URL(`../supabase/migrations/${file}`, import.meta.url), "utf8"));
    }
    await db.query("insert into auth.users(id) values($1),($2)", [player, other]);
    await db.query("select begin_stripe_purchase($1,$2,'coins_1000',false)", [orderId, player]);
    await t.test("prix, compte, devise et mode falsifiés sont refusés", () => {
      const order = { id: orderId, user_id: player, pack_id: "coins_1000", coins: 1000, amount: 119, livemode: false, session_id: null, payment_intent: null };
      validatePaidSession(session(), order);
      for (const change of [{ amount_total: 1 }, { currency: "usd" }, { client_reference_id: other }, { livemode: true }, { metadata: {} }]) {
        assert.throws(() => validatePaidSession({ ...session(), ...change }, order));
      }
    });
    await t.test("commande idempotente, réutilisation par un autre joueur et pack rejetés", async () => {
      await db.query("select begin_stripe_purchase($1,$2,'coins_1000',false)", [orderId, player]);
      await assert.rejects(db.query("select begin_stripe_purchase($1,$2,'coins_1000',false)", [orderId, other]), /incompatible/);
      await assert.rejects(db.query("select begin_stripe_purchase($1,$2,'coins_2000',false)", [orderId, player]), /incompatible/);
      await assert.rejects(db.query("select begin_stripe_purchase($1,$2,'fake',false)", [randomUUID(), player]), /pack invalide/);
    });
    await t.test("session non payée : aucun crédit", async () => {
      paymentStatus = "unpaid";
      await run("evt_unpaid");
      assert.equal(await balance(), 0);
      paymentStatus = "paid";
    });
    await t.test("crédit 1000 puis doublon et événements distincts sans double crédit", async () => {
      await run("evt_paid");
      await run("evt_paid");
      await Promise.all([run("evt_repeat_1"), run("evt_repeat_2")].map((promise) => promise.catch(() => undefined)));
      await run("evt_repeat_1"); await run("evt_repeat_2");
      assert.equal(await balance(), 1000);
      assert.equal((await db.query("select * from wallet_ledger where reference like 'stripe:%'")).rows.length, 1);
    });
    await t.test("remboursement partiel, pending et failed ne retirent pas de pièces", async () => {
      refunded = 30; refundStatus = "pending";
      await run("evt_refund_pending", "refund.created"); assert.equal(await balance(), 1000);
      refundStatus = "failed";
      await run("evt_refund_failed", "refund.failed"); assert.equal(await balance(), 1000);
      refundStatus = "succeeded";
      await run("evt_refund_partial", "refund.updated"); assert.equal(await balance(), 747);
      await run("evt_old_paid"); assert.equal(await balance(), 747);
    });
    await t.test("litige puis victoire : retrait et restitution une seule fois", async () => {
      disputeStatus = "needs_response";
      await run("evt_dispute", "charge.dispute.created"); assert.equal(await balance(), 0);
      disputeStatus = "won";
      await run("evt_dispute_won", "charge.dispute.closed");
      await run("evt_dispute_won", "charge.dispute.closed");
      assert.equal(await balance(), 747);
    });
    await t.test("remboursement après dépense : dette suivie, solde jamais négatif", async () => {
      await db.query("insert into wallet_ledger(user_id,delta_coins,reason,reference) values($1,-700,'purchase','spent')", [player]);
      refunded = 119;
      await run("evt_refund_full", "charge.refunded");
      await run("evt_refund_full", "charge.refunded");
      assert.equal(await balance(), 0); assert.equal(await debt(), 700);
    });
    await t.test("nouveau crédit absorbe la dette avant les pièces disponibles", async () => {
      // Exercise the same atomic function for a different, independently confirmed order.
      const next = randomUUID(), token = randomUUID();
      await db.query("select begin_stripe_purchase($1,$2,'coins_2000',false)", [next, player]);
      await db.query("select lock_stripe_purchase($1,$2)", [next, token]);
      await db.query("select apply_stripe_purchase($1,$2,'evt_next','checkout.session.completed','cs_next','pi_next','paid',0,2000,null)", [next, token]);
      assert.equal(await balance(), 1300); assert.equal(await debt(), 0);
    });
    await t.test("panne Stripe : pas d’événement acquitté, reprise possible", async () => {
      apiFailure = true;
      await assert.rejects(run("evt_network"));
      assert.equal((await db.query("select * from stripe_events where id='evt_network'")).rows.length, 0);
      apiFailure = false; await run("evt_network"); assert.equal(await balance(), 1300);
    });
    await t.test("verrou expiré : ancien worker incapable de créditer", async () => {
      const token = randomUUID();
      await db.query("select lock_stripe_purchase($1,$2)", [orderId, token]);
      await db.query("update stripe_purchases set lease_until=now()-interval '1 second' where id=$1", [orderId]);
      await assert.rejects(db.query("select apply_stripe_purchase($1,$2,'evt_stale','checkout.session.completed','cs_test_fixture','pi_fixture','paid',0,1000,null)", [orderId, token]), /verrou expiré/);
      await db.query("update stripe_purchases set lease_until=null,lease_token=null where id=$1", [orderId]);
    });
    await t.test("RLS : historique privé, écritures et RPC interdites au client", async () => {
      await db.exec("grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated");
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [other]);
      await db.exec("set role authenticated");
      assert.equal((await db.query("select * from stripe_purchases")).rows.length, 0);
      await assert.rejects(db.query("select begin_stripe_purchase($1,$2,'coins_1000',false)", [randomUUID(), other]), /permission denied/);
      await assert.rejects(db.query("update stripe_purchases set entitled_coins=0"), /permission denied/);
      await assert.rejects(db.query("insert into stripe_events(id,purchase_id,event_type) values('evt_fake',$1,'fake')", [orderId]), /permission denied/);
      await db.exec("reset role");
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [player]);
      await db.exec("set role authenticated");
      assert.equal((await db.query("select * from stripe_purchases")).rows.length, 2);
      await db.exec("reset role");
    });
    await t.test("limite persistante de cinq achats par dix minutes", async () => {
      for (let i = 0; i < 3; i++) await db.query("select begin_stripe_purchase($1,$2,'coins_1000',false)", [randomUUID(), player]);
      await assert.rejects(db.query("select begin_stripe_purchase($1,$2,'coins_1000',false)", [randomUUID(), player]), /trop de tentatives/);
    });
    await t.test("clé réelle refusée avant tout appel réseau en mode test", async () => {
      process.env.STRIPE_SECRET_KEY = "rk_live_never_use";
      await assert.rejects(stripeRequest("checkout/sessions", new URLSearchParams()), /mode incompatible/);
    });
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.STRIPE_SECRET_KEY; else process.env.STRIPE_SECRET_KEY = originalKey;
    if (originalMode === undefined) delete process.env.STRIPE_MODE; else process.env.STRIPE_MODE = originalMode;
    await db.close();
  }
});
