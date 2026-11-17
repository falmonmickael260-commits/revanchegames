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

  const { data: { user } } = await supabase.auth.getUser();
  const path=request.nextUrl.pathname;
  // Support and reporting remain available to suspended players. Server-to-server
  // game/webhook requests have their own authentication and no player cookie.
  if(user && (path.startsWith('/play/') || (path.startsWith('/api/') &&
    !['/api/support/','/api/reports','/api/platform-status','/api/stripe/webhook'].some(prefix=>path.startsWith(prefix))))) {
    const access=await supabase.rpc('my_platform_access');
    if(access.error || access.data?.restricted) {
      const denied=NextResponse.json({error:access.error?'Vérification de l’accès indisponible.':'Accès suspendu.'},
        {status:access.error?503:403,headers:{'Cache-Control':'no-store, private'}});
      for(const cookie of response.cookies.getAll())denied.cookies.set(cookie);
      return denied;
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icons|manifest.webmanifest).*)"],
};
