import { createClient, createServiceClient } from "@/lib/supabase/server";
import { stripeMode } from "@/lib/stripe/catalog";

export async function GET() {
  const headers = { "Cache-Control": "no-store" };
  try {
    const auth = await createClient();
    const { data: { user }, error: authError } = await auth.auth.getUser();
    if (authError || !user || user.is_anonymous || !user.email_confirmed_at) {
      return Response.json({ authenticated: false, noAds: false }, { headers });
    }
    const { data, error } = await createServiceClient().from("stripe_purchases")
      .select("id").eq("user_id", user.id).eq("pack_id", "bombshift_no_ads")
      .eq("livemode", stripeMode()).eq("state", "paid").eq("refunded_amount", 0).limit(1);
    if (error) throw error;
    return Response.json({ authenticated: true, noAds: !!data?.length }, { headers });
  } catch {
    return Response.json({ error: "Vérification de l’achat indisponible." }, { status: 503, headers });
  }
}
