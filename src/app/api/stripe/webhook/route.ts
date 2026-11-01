import { createServiceClient } from "@/lib/supabase/server";
import { stripeMode } from "@/lib/stripe/catalog";
import { fulfillStripeEvent } from "@/lib/stripe/fulfillment";
import { handleStripeWebhook } from "@/lib/stripe/webhook";

export async function POST(request: Request) {
  return handleStripeWebhook(request, {
    secret: process.env.STRIPE_WEBHOOK_SECRET,
    liveMode: stripeMode,
    fulfill: (event) => fulfillStripeEvent(event, createServiceClient()),
  });
}
