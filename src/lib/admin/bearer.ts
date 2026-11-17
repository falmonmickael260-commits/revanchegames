import "server-only";
import { createClient } from "@supabase/supabase-js";
import { RequestError } from "@/lib/request-security";
export async function adminBearer(
  request: Request,
  permission: "credit" | "moderate",
) {
  const header = request.headers.get("authorization") || "";
  if (!header.startsWith("Bearer ") || header.length > 16384)
    throw new RequestError("Session administrateur requise.", 401);
  const token = header.slice(7);
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: header } },
    },
  );
  const {
    data: { user },
    error,
  } = await db.auth.getUser(token);
  if (error || !user || user.is_anonymous || !user.email_confirmed_at)
    throw new RequestError("Session administrateur requise.", 401);
  const allowed = await db.rpc("admin_allowed", { p_permission: permission });
  if (allowed.error || allowed.data !== true)
    throw new RequestError(
      "Permission et double authentification requises.",
      403,
    );
  return { db, user };
}
