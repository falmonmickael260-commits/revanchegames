import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const db = await createClient();
  const { data: { user }, error } = await db.auth.getUser();
  if (error || !user || user.is_anonymous) return new Response(null, { status: 401 });
  const offset = Number(new URL(request.url).searchParams.get("offset") || 0);
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 100000) return new Response(null, { status: 400 });
  const [orders, debt] = await Promise.all([
    db.from("stripe_purchases").select("id,coins,amount,currency,state,refunded_amount,receipt_url,payment_intent,payment_method,created_at,livemode")
      .eq("user_id", user.id).order("created_at", { ascending: false }).order("id").range(offset, offset + 19),
    db.from("stripe_wallet_debts").select("coins").eq("user_id", user.id).maybeSingle(),
  ]);
  if (orders.error || debt.error) return new Response(null, { status: 503 });
  return Response.json({ purchases: orders.data, debtCoins: debt.data?.coins || 0 }, { headers: { "Cache-Control": "no-store, private" } });
}
