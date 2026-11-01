import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Refreshes the Supabase session cookie on every request. Renamed from
// `middleware.ts` in Next.js 16 — see node_modules/next/dist/docs/.../proxy.md.
export async function proxy(request: NextRequest) {
  // Stripe authenticates with its signature. No Supabase session refresh/network
  // request must prevent delivery or read/transform its raw request body.
  if (request.nextUrl.pathname === "/api/stripe/webhook") return NextResponse.next();
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icons|manifest.webmanifest).*)"],
};
