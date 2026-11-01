import { createClient, createServiceClient } from "@/lib/supabase/server";
import { isPackId, shopOrigin, stripeMode } from "@/lib/stripe/catalog";
import { stripeRequest, type CheckoutSession } from "@/lib/stripe/api";
import { checkoutParameters } from "@/lib/stripe/checkout";
import { readLimitedBody, RequestError } from "@/lib/request-security";

export async function POST(request: Request) {
  try {
    if (!process.env.STRIPE_WEBHOOK_SECRET?.startsWith("whsec_")) throw new Error("Webhook non configuré.");
    const origin = shopOrigin();
    if (request.headers.get("origin") !== origin) return Response.json({ error: "Origine refusée." }, { status: 403 });
    const raw = Buffer.from(await readLimitedBody(request, 4096)).toString("utf8");
    let body;
    try { body = JSON.parse(raw); } catch { return Response.json({ error: "Demande invalide." }, { status: 400 }); }
    if (!body || !isPackId(body.packId) || typeof body.requestId !== "string" ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.requestId)) {
      return Response.json({ error: "Pack ou identifiant invalide." }, { status: 400 });
    }
    const auth = await createClient();
    const { data: { user }, error } = await auth.auth.getUser();
    if (error || !user || user.is_anonymous || !user.email || !user.email_confirmed_at) {
      return Response.json({ error: "Connecte-toi avec un compte dont l’e-mail est confirmé." }, { status: 401 });
    }
    // A live key cannot be used by accident while STRIPE_MODE defaults to test.
    const live = stripeMode();
    const db = createServiceClient();
    const orderResult = await db.rpc("begin_stripe_purchase", {
      p_id: body.requestId, p_user: user.id, p_pack: body.packId, p_live: live,
    });
    if (orderResult.error) {
      return Response.json({ error: "Achat indisponible. Réessaie dans quelques minutes." }, { status: orderResult.error.code === "54000" ? 429 : 409 });
    }
    const order = orderResult.data;
    let session: CheckoutSession;
    if (order.session_id) {
      session = await stripeRequest<CheckoutSession>(`checkout/sessions/${encodeURIComponent(order.session_id)}`);
    } else {
      if (new Date(order.created_at).getTime() < Date.now() - 25 * 60 * 1000) {
        return Response.json({ error: "Demande expirée. Lance un nouvel achat." }, { status: 409 });
      }
      session = await stripeRequest<CheckoutSession>("checkout/sessions",
        checkoutParameters(order, origin), `rg-checkout-${order.id}`);
      if (session.livemode !== live) throw new Error("Mode incompatible.");
      const saved = await db.from("stripe_purchases").update({ session_id: session.id }).eq("id", order.id).is("session_id", null);
      if (saved.error) throw new Error("Session non enregistrée.");
    }
    if (session.status !== "open" || !session.url?.startsWith("https://checkout.stripe.com/")) {
      return Response.json({ error: "Cette session est terminée. Consulte ton historique ou lance un nouvel achat." }, { status: 409 });
    }
    return Response.json({ url: session.url }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof RequestError) return Response.json({ error: error.message }, { status: error.status });
    return Response.json({ error: "Le paiement est temporairement indisponible." }, { status: 503 });
  }
}
