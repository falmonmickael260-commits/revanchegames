import { validateReportCaptures } from "@/lib/report-evidence";
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
    const { db, user } = await supportSession("Connecte-toi avec un compte confirmé pour envoyer un signalement.");
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
    const { db, user } = await supportSession("Connecte-toi avec un compte confirmé pour envoyer un signalement.");
    const raw = await readLimitedBody(request, 16 * 1024 * 1024);
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
    if (target === user.id) throw new RequestError("Tu ne peux pas signaler ton propre profil.");
    const files = form.getAll("attachment").filter((file): file is File => file instanceof File);
    const invalid = validateReportCaptures(files);
    if (invalid) throw new RequestError(invalid, 413);
    const images: Buffer[] = [];
    for (const file of files) images.push(await normalizeScreenshot(file));
    const { error } = await db.rpc("submit_evidenced_report", {
      p_id: id,
      p_kind: kind,
      p_target: target || null,
      p_context: context,
      p_details: details,
      p_message: message || null,
      p_attachment: images.length > 0,
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
    const service = images.length ? createServiceClient() : null;
    for (let position = 0; position < images.length; position++) {
      const path = `${user.id}/${id}${position ? `-${position + 1}` : ""}.webp`;
      const stored = await service!.storage.from("report-evidence").upload(path, images[position], { contentType: "image/webp", upsert: false });
      if (stored.error && stored.error.message !== "The resource already exists" && String((stored.error as { statusCode?: string }).statusCode) !== "409")
        throw new RequestError("Le signalement est enregistré, mais une capture n’a pas été reçue. Réessaie sans fermer le formulaire.", 503);
      const metadata = await service!.from("report_attachments").upsert({ report_id: id, position, storage_path: path }, { onConflict: "report_id,position", ignoreDuplicates: true });
      if (metadata.error) throw new RequestError("La capture est reçue, mais sa confirmation a échoué. Réessaie sans fermer le formulaire.", 503);
    }

    return Response.json(
      { id },
      { headers: { "Cache-Control": "no-store, private" } },
    );
  } catch (error) {
    return apiError(error);
  }
}
