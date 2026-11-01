import { supportSession } from "@/lib/support-server";
import { apiError, readLimitedBody, requireSameOrigin, RequestError, UUID_PATTERN } from "@/lib/request-security";

type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) {
  try {
    const { id } = await context.params;
    if (!UUID_PATTERN.test(id)) throw new RequestError("Demande introuvable.", 404);
    const { db } = await supportSession();
    const offset = Number(new URL(request.url).searchParams.get("offset") || 0);
    if (!Number.isSafeInteger(offset) || offset < 0 || offset > 100000) throw new RequestError("Page invalide.");
    const ticket = await db.from("support_tickets").select("*").eq("id", id).maybeSingle();
    if (ticket.error) throw new Error("Lecture impossible.");
    if (!ticket.data) throw new RequestError("Demande introuvable.", 404);
    const [messages, events] = await Promise.all([
      db.from("support_messages").select("*").eq("ticket_id", id).order("created_at").order("id").range(offset, offset + 49),
      db.from("support_ticket_events").select("id,status,created_at").eq("ticket_id", id).order("created_at", { ascending: false }).limit(50),
    ]);
    if (messages.error || events.error) throw new Error("Lecture impossible.");
    return Response.json({ ticket: ticket.data, messages: messages.data, events: events.data }, { headers: { "Cache-Control": "no-store, private" } });
  } catch (error) { return apiError(error); }
}

export async function POST(request: Request, context: Context) {
  try {
    requireSameOrigin(request);
    const { id } = await context.params;
    if (!UUID_PATTERN.test(id)) throw new RequestError("Demande introuvable.", 404);
    const { db } = await supportSession();
    const raw = await readLimitedBody(request, 24000);
    let body;
    try { body = JSON.parse(Buffer.from(raw).toString("utf8")); } catch { throw new RequestError("Demande illisible."); }
    if (!body || typeof body.message !== "string" || body.message.trim().length > 5000 ||
        (!body.message.trim() && !body.status) || (body.status && !["received", "in_progress", "resolved"].includes(body.status))) {
      throw new RequestError("Réponse ou statut invalide.");
    }
    const result = await db.rpc("reply_support_ticket", { p_id: id, p_message: body.message.trim(), p_status: body.status || null });
    if (result.error) {
      if (result.error.code === "42501") throw new RequestError("Action non autorisée.", 403);
      if (result.error.code === "54000") throw new RequestError("Trop de réponses. Réessaie plus tard.", 429);
      throw new Error("Réponse impossible.");
    }
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}
