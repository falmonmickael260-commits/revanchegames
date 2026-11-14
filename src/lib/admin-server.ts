import { createClient, createServiceClient } from "@/lib/supabase/server";
import { RequestError } from "@/lib/request-security";

export async function adminSession() {
  const db = await createClient();
  const { data: { user }, error } = await db.auth.getUser();
  if (error || !user || user.is_anonymous || !user.email_confirmed_at) throw new RequestError("Connexion avec un compte confirmé requise.", 401);
  const membership = await db.rpc("is_support_admin");
  if (membership.error) throw new RequestError("Vérification des droits indisponible.", 503);
  if (membership.data !== true) throw new RequestError("Accès réservé aux administrateurs.", 403);
  return { user, service: createServiceClient() };
}
