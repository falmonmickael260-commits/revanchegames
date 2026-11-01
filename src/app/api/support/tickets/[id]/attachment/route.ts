import { createServiceClient } from "@/lib/supabase/server";
import { supportSession } from "@/lib/support-server";
import { apiError, RequestError, UUID_PATTERN } from "@/lib/request-security";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    if (!UUID_PATTERN.test(id)) throw new RequestError("Capture introuvable.", 404);
    const { db } = await supportSession();
    // RLS checks ownership or explicit administrator membership BEFORE service-role storage access.
    const ticket = await db.from("support_tickets").select("attachment_path").eq("id", id).maybeSingle();
    if (ticket.error) throw new Error("Lecture impossible.");
    if (!ticket.data?.attachment_path) throw new RequestError("Capture introuvable.", 404);
    const file = await createServiceClient().storage.from("support-attachments").download(ticket.data.attachment_path);
    if (file.error || !file.data) throw new Error("Lecture impossible.");
    return new Response(file.data, { headers: {
      "Content-Type": "image/webp", "Content-Disposition": 'inline; filename="capture.webp"',
      "Cache-Control": "no-store, private", "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    } });
  } catch (error) { return apiError(error); }
}
