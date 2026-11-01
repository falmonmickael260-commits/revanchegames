import { verifyStripeSignature, type StripeEvent } from "./api";
import { STRIPE_EVENTS } from "./fulfillment";
import { readLimitedBody, RequestError } from "../request-security";

type Dependencies = {
  secret: string | undefined;
  liveMode: () => boolean;
  fulfill: (event: StripeEvent) => Promise<void>;
};

// Shared by the Next.js route and request-level tests. Dependencies never come
// from the caller: production supplies server environment and Supabase clients.
export async function handleStripeWebhook(request: Request, dependencies: Dependencies): Promise<Response> {
  const { secret } = dependencies;
  if (!secret?.startsWith("whsec_") || secret.length <= 6) return new Response("Webhook non configuré", { status: 503 });
  let raw: string;
  try { raw = Buffer.from(await readLimitedBody(request, 1048576)).toString("utf8"); }
  catch (error) { return new Response("Corps illisible ou trop volumineux", { status: error instanceof RequestError ? error.status : 400 }); }
  let event: StripeEvent;
  try {
    // Signature covers the exact body, BEFORE parsing or invoking any database operation.
    verifyStripeSignature(raw, request.headers.get("stripe-signature"), secret);
    event = JSON.parse(raw);
    if (typeof event.id !== "string" || !/^evt_[A-Za-z0-9_]+$/.test(event.id) || event.id.length > 255 ||
        typeof event.type !== "string" || event.type.length > 200 || typeof event.livemode !== "boolean" ||
        typeof event.data?.object?.id !== "string" || !event.data.object.id || event.data.object.id.length > 255) {
      throw new Error("Événement invalide");
    }
  } catch {
    return new Response("Signature ou événement invalide", { status: 400 });
  }
  try {
    if (event.livemode !== dependencies.liveMode()) return new Response("Mode incompatible", { status: 400 });
    // A valid event outside this integration needs no service-role access.
    if (STRIPE_EVENTS.has(event.type)) await dependencies.fulfill(event);
    return Response.json({ received: true });
  } catch {
    // Never return 2xx for a credit/refund that failed to commit. Stripe can retry.
    console.error("stripe_webhook_failed", { eventId: event.id, type: event.type });
    return new Response("Traitement à réessayer", { status: 500 });
  }
}
