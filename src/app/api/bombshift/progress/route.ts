import { createClient, createServiceClient } from "@/lib/supabase/server";
import { apiError, readLimitedBody, RequestError, requireSameOrigin } from "@/lib/request-security";
import { mergeBombshiftSaves, sanitizeBombshiftSave } from "@/lib/bombshift-progress";

const noStore = { "Cache-Control": "no-store" };

async function signedInUser() {
  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();
  return user && !user.is_anonymous ? user : null;
}

export async function GET() {
  try {
    const user = await signedInUser();
    if (!user) return Response.json({ authenticated: false, progress: null }, { headers: noStore });
    const service = createServiceClient();
    const { data, error } = await service.from("bombshift_account_progress")
      .select("save_data,updated_at").eq("user_id", user.id).maybeSingle();
    if (error) throw new RequestError("Sauvegarde BombShift indisponible.", 503);
    return Response.json({ authenticated: true, progress: data?.save_data ?? null, updatedAt: data?.updated_at ?? null }, { headers: noStore });
  } catch (error) { return apiError(error); }
}

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const user = await signedInUser();
    if (!user) throw new RequestError("Compte Revanche Games confirmé requis.", 401);

    let body: unknown;
    try { body = JSON.parse(new TextDecoder().decode(await readLimitedBody(request, 64 * 1024))); }
    catch { throw new RequestError("Sauvegarde BombShift invalide."); }
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new RequestError("Sauvegarde BombShift invalide.");
    const progress = sanitizeBombshiftSave((body as Record<string, unknown>).progress);
    if (!progress) throw new RequestError("Format de sauvegarde BombShift invalide.");

    const service = createServiceClient();
    const { data: current, error: readError } = await service.from("bombshift_account_progress")
      .select("save_data").eq("user_id", user.id).maybeSingle();
    if (readError) throw new RequestError("Sauvegarde BombShift temporairement indisponible.", 503);
    const merged = mergeBombshiftSaves(current?.save_data, progress);
    if (!merged) throw new RequestError("Format de sauvegarde BombShift invalide.");
    const { data, error } = await service.from("bombshift_account_progress").upsert({
      user_id: user.id,
      save_data: merged,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" }).select("updated_at").single();
    if (error) throw new RequestError("Sauvegarde BombShift temporairement indisponible.", 503);
    return Response.json({ ok: true, updatedAt: data.updated_at }, { headers: noStore });
  } catch (error) { return apiError(error); }
}
