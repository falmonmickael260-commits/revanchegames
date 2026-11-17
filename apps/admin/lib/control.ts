import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AdminError } from "./server";
// No platform, game, Stripe or service-role secret is copied to this service.
// The original platform independently authorizes the same user's signed JWT.
export async function forwardControl(
  db: SupabaseClient,
  path: string,
  body?: unknown,
) {
  const {
    data: { session },
  } = await db.auth.getSession();
  if (!session?.access_token) throw new AdminError("Session expirée.", 401);
  const origin = new URL(
    process.env.ADMIN_PLATFORM_ORIGIN ||
      "https://revanchegames-production.up.railway.app",
  );
  if (process.env.NODE_ENV === "production" && origin.protocol !== "https:")
    throw new AdminError("Connexion plateforme non configurée.", 503);
  const response = await fetch(`${origin.origin}${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(60000),
  });
  if (
    !(response.headers.get("content-type") || "").includes("application/json")
  )
    throw new AdminError(
      "Le serveur de contrôle de la plateforme n’est pas encore disponible.",
      503,
    );
  const data = await response.json();
  if (!response.ok)
    throw new AdminError(
      typeof data.error === "string" ? data.error : "Opération indisponible.",
      response.status,
    );
  return data;
}
