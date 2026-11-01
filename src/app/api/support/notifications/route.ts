import { supportSession } from "@/lib/support-server";
import { apiError, requireSameOrigin } from "@/lib/request-security";

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const { db } = await supportSession();
    const result = await db.rpc("read_support_notifications");
    if (result.error) throw new Error("Lecture impossible.");
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}
