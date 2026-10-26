import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Reached after an email-confirmation or password-reset link. Exchanges the
// one-time code for a real session, then continues to `next` (default:
// profile — signup confirmations pass `next=/auth/confirmed` explicitly).
// Any failure (expired/already-used code, or an error Supabase appends
// directly) lands on /auth/confirmed too, with a status it can explain —
// never a bare Supabase error page or a silent redirect.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/profile";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    // A code that fails to exchange is, in practice, almost always one
    // that's already been consumed (link-prescanning, a second click) or
    // has expired — both read the same to the person clicking it.
    return NextResponse.redirect(`${origin}/auth/confirmed?status=expired`);
  }

  const errorCode = searchParams.get("error_code") ?? searchParams.get("error");
  if (errorCode) {
    const status = errorCode === "otp_expired" ? "expired" : "error";
    return NextResponse.redirect(`${origin}/auth/confirmed?status=${status}`);
  }

  return NextResponse.redirect(`${origin}/sign-in`);
}
