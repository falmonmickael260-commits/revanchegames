import { createServiceClient } from "@/lib/supabase/server";
import { supportSession, normalizeScreenshot } from "@/lib/support-server";
import {
  apiError,
  readLimitedBody,
  requireSameOrigin,
  RequestError,
  UUID_PATTERN,
} from "@/lib/request-security";

export async function GET(request: Request) {
  try {
    const { db, user } = await supportSession();
    const offset = Number(new URL(request.url).searchParams.get("offset") || 0);
    if (!Number.isSafeInteger(offset) || offset < 0 || offset > 100000)
      throw new RequestError("Page invalide.");
    const { data, error } = await db
      .from("reports")
      .select("id,kind,context,details,status,created_at,resolved_at")
      .eq("reporter_id", user.id)
      .order("created_at", { ascending: false })
      .order("id")
      .range(offset, offset + 49);
    if (error) throw new RequestError("Signalements indisponibles.", 503);
    return Response.json(data, {
      headers: { "Cache-Control": "no-store, private" },
    });
  } catch (error) {
    return apiError(error);
  }
}
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const { db, user } = await supportSession();
    const raw = await readLimitedBody(request, 6 * 1024 * 1024);
    const form = await new Request(request.url, {
      method: "POST",
      headers: { "Content-Type": request.headers.get("content-type") || "" },
      body: new Uint8Array(raw),
    }).formData();
    const id = String(form.get("id") || ""),
      kind = String(form.get("kind") || ""),
      target = String(form.get("target") || ""),
      message = String(form.get("message") || "");
    const context = String(form.get("context") || ""),
      details = String(form.get("details") || "");
    if (
      !UUID_PATTERN.test(id) ||
      ![
        "avatar",
        "signature",
        "username",
        "behaviour",
        "message",
        "bug",
        "other",
      ].includes(kind) ||
      (target && !UUID_PATTERN.test(target)) ||
      (message && !UUID_PATTERN.test(message)) ||
      details.length > 1000 ||
      context.length > 200
    )
      throw new RequestError("Signalement invalide.");
    const file = form.get("attachment");
    const image =
      file instanceof File && file.size
        ? await normalizeScreenshot(file)
        : null;
    const { error } = await db.rpc("submit_evidenced_report", {
      p_id: id,
      p_kind: kind,
      p_target: target || null,
      p_context: context,
      p_details: details,
      p_message: message || null,
      p_attachment: Boolean(image),
    });
    if (error)
      throw new RequestError(
        error.code === "23505"
          ? "Un signalement de ce type est déjà en cours."
          : error.code === "54000"
            ? "Trop de signalements. Réessaie plus tard."
            : "Envoi refusé. Vérifie le message, le joueur et ta connexion.",
        error.code === "54000" ? 429 : 409,
      );
    if (image) {
      const stored = await createServiceClient()
        .storage.from("report-evidence")
        .upload(`${user.id}/${id}.webp`, image, {
          contentType: "image/webp",
          upsert: false,
        });
      if (
        stored.error &&
        stored.error.message !== "The resource already exists" &&
        String((stored.error as { statusCode?: string }).statusCode) !== "409"
      )
        throw new RequestError(
          "Le signalement est enregistré, mais la capture n’a pas été reçue. Réessaie sans fermer le formulaire.",
          503,
        );
    }
    return Response.json(
      { id },
      { headers: { "Cache-Control": "no-store, private" } },
    );
  } catch (error) {
    return apiError(error);
  }
}
