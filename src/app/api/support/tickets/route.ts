import { createServiceClient } from "@/lib/supabase/server";
import { supportSession, normalizeScreenshot } from "@/lib/support-server";
import { SUPPORT_CATEGORIES } from "@/lib/support";
import { apiError, readLimitedBody, requireSameOrigin, RequestError, UUID_PATTERN } from "@/lib/request-security";

export async function GET(request: Request) {
  try {
    const { db, user } = await supportSession();
    const params = new URL(request.url).searchParams;
    const offset = Number(params.get("offset") || 0);
    if (!Number.isSafeInteger(offset) || offset < 0 || offset > 100000) throw new RequestError("Page invalide.");
    const [admin, unread] = await Promise.all([
      db.rpc("is_support_admin"),
      db.from("support_notifications").select("id", { count: "exact", head: true }).is("read_at", null),
    ]);
    if (admin.error || unread.error) throw new Error("Lecture impossible.");
    const isAdmin = admin.data === true;
    const summary = { isAdmin, unreadCount: unread.count || 0 };
    if (params.get("summary") === "1") return Response.json(summary, { headers: { "Cache-Control": "no-store, private" } });
    if (params.get("scope") === "admin" && !isAdmin) throw new RequestError("Accès réservé aux administrateurs.", 403);
    let query = db.from("support_tickets").select("*").order("updated_at", { ascending: false }).order("id").range(offset, offset + 19);
    if (params.get("scope") !== "admin") query = query.eq("user_id", user.id);
    const tickets = await query;
    if (tickets.error) throw new Error("Lecture impossible.");
    return Response.json({ ...summary, tickets: tickets.data }, { headers: { "Cache-Control": "no-store, private" } });
  } catch (error) { return apiError(error); }
}

export async function POST(request: Request) {
  let uploadedPath: string | null = null;
  try {
    requireSameOrigin(request);
    const { db, user } = await supportSession();
    const bytes = await readLimitedBody(request, 5 * 1024 * 1024 + 65536);
    let form: FormData;
    try {
      form = await new Request(request.url, { method: "POST", headers: { "Content-Type": request.headers.get("content-type") || "" }, body: Buffer.from(bytes) }).formData();
    } catch { throw new RequestError("Formulaire illisible."); }
    const id = String(form.get("requestId") || "");
    const category = String(form.get("category") || "");
    const subject = String(form.get("subject") || "").trim();
    const description = String(form.get("description") || "").trim();
    const reference = String(form.get("transactionReference") || "").trim();
    if (!UUID_PATTERN.test(id) || !Object.hasOwn(SUPPORT_CATEGORIES, category) || subject.length < 3 || subject.length > 150 ||
        description.length < 20 || description.length > 5000 || reference.length > 160) throw new RequestError("Vérifie les champs de la demande.");
    const existing = await db.from("support_tickets").select("id").eq("id", id).eq("user_id", user.id).maybeSingle();
    if (existing.error) throw new Error("Lecture impossible.");
    if (existing.data) return Response.json({ id }, { headers: { "Cache-Control": "no-store" } });
    const recent = await db.from("support_tickets").select("id", { count: "exact", head: true }).eq("user_id", user.id)
      .gte("created_at", new Date(Date.now() - 3600000).toISOString());
    if (recent.error) throw new Error("Lecture impossible.");
    if ((recent.count || 0) >= 5) throw new RequestError("Maximum cinq demandes par heure.", 429);
    const file = form.get("screenshot");
    if (file instanceof File && file.size > 0) {
      const image = await normalizeScreenshot(file);
      const path = `${user.id}/${id}.webp`;
      const upload = await createServiceClient().storage.from("support-attachments").upload(path, image, { contentType: "image/webp", upsert: false, cacheControl: "0" });
      if (upload.error) throw new RequestError("La capture n’a pas pu être enregistrée. Réessaie.", 503);
      uploadedPath = path;
    }
    const created = await db.rpc("create_support_ticket", {
      p_id: id, p_category: category, p_subject: subject, p_description: description,
      p_reference: reference || null, p_attachment: !!uploadedPath,
    });
    if (created.error) {
      if (created.error.code === "54000") throw new RequestError("Maximum cinq demandes par heure.", 429);
      if (created.error.code === "23514") throw new RequestError("Vérifie les champs de la demande.");
      throw new Error("Création impossible.");
    }
    uploadedPath = null;
    return Response.json({ id: created.data }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (uploadedPath) {
      // An RPC can commit even when its response is lost. Never delete an image
      // already linked by a committed ticket; keep an orphan if the DB is unreachable.
      const admin = createServiceClient();
      const linked = await admin.from("support_tickets").select("id").eq("attachment_path", uploadedPath).limit(1);
      if (!linked.error && !linked.data?.length) await admin.storage.from("support-attachments").remove([uploadedPath]);
    }
    return apiError(error);
  }
}
