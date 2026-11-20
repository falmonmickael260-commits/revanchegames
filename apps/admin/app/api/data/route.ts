import { adminSession, failure, json, AdminError } from "../../../lib/server";
export async function GET(request: Request) {
  try {
    const { db } = await adminSession();
    const q = new URL(request.url).searchParams;
    const offset = Number(q.get("offset") || 0);
    if (!Number.isSafeInteger(offset) || offset < 0 || offset > 100000)
      throw new AdminError("Page invalide.", 400);
    const { data, error } = await db.rpc("admin_query", {
      p_section: q.get("section") || "dashboard",
      p_search: q.get("search") || "",
      p_target: q.get("target") || null,
      p_offset: offset,
    });
    if (error)
      throw new AdminError(
        error.code === "42501"
          ? "Permission refusée."
          : "Données indisponibles.",
        error.code === "42501" ? 403 : 503,
      );
    return json(data);
  } catch (error) {
    return failure(error);
  }
}
