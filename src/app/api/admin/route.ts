import { adminSession } from "@/lib/admin-server";
import { apiError, readLimitedBody, requireSameOrigin, RequestError, UUID_PATTERN } from "@/lib/request-security";

export async function GET(request: Request) {
  try {
    const { user, service } = await adminSession();
    const params = new URL(request.url).searchParams;
    const search = (params.get("search") || "").trim();
    const page = Number(params.get("page") || 0);
    if (!Number.isSafeInteger(page) || page < 0 || page > 5000 || search.length > 60 || (search && !/^[\p{L}\p{N}_ -]+$/u.test(search))) throw new RequestError("Recherche ou page invalide.");
    let playersQuery = service.from("profiles").select("id,username,created_at", { count: "exact" });
    if (search) playersQuery = playersQuery.ilike("username", `%${search.replaceAll("_", "\\_")}%`);
    const [players, admins, tickets, reports, totalPlayers, games, audit] = await Promise.all([
      playersQuery.order("created_at", { ascending: false }).order("id").range(page * 20, page * 20 + 19),
      service.from("support_admins").select("user_id"),
      service.from("support_tickets").select("id", { count: "exact", head: true }).neq("status", "resolved"),
      service.from("reports").select("id,reporter_id,target_user_id,kind,details,context,status,created_at").in("status", ["open", "reviewing"]).order("created_at").limit(50),
      service.from("profiles").select("id", { count: "exact", head: true }),
      service.from("game_results").select("id", { count: "exact", head: true }),
      service.from("platform_admin_audit").select("id,actor_id,target_id,action,reason,created_at").order("created_at", { ascending: false }).limit(20),
    ]);
    if ([players, admins, tickets, reports, totalPlayers, games, audit].some(result => result.error)) throw new RequestError("Données indisponibles. Vérifiez les migrations de la base.", 503);
    const accounts = await Promise.all((players.data || []).map(async player => {
      const account = await service.auth.admin.getUserById(player.id);
      if (account.error || !account.data.user) throw new RequestError("État des comptes indisponible.", 503);
      return { ...player, suspended: !!account.data.user.banned_until && new Date(account.data.user.banned_until).getTime() > Date.now(), isAdmin: admins.data!.some(admin => admin.user_id === player.id) };
    }));
    return Response.json({ actorId: user.id, players: accounts, matchingPlayers: players.count, adminCount: admins.data!.length, openTickets: tickets.count, reports: reports.data, totalPlayers: totalPlayers.count, games: games.count, audit: audit.data }, { headers: { "Cache-Control": "no-store, private" } });
  } catch (error) { return apiError(error); }
}

export async function PATCH(request: Request) {
  try {
    requireSameOrigin(request);
    const { user, service } = await adminSession();
    let body;
    try { body = JSON.parse(new TextDecoder().decode(await readLimitedBody(request, 4096))); } catch { throw new RequestError("Demande invalide."); }
    if (!body || typeof body.targetId !== "string" || !UUID_PATTERN.test(body.targetId) || typeof body.reason !== "string" || body.reason.trim().length < 5 || body.reason.length > 500) throw new RequestError("Identifiant et motif de 5 à 500 caractères requis.");
    if (!["suspend", "restore", "reviewing", "resolved", "dismissed"].includes(body.action)) throw new RequestError("Action invalide.");
    const result = await service.rpc("platform_admin_action", { p_actor: user.id, p_target: body.targetId, p_action: body.action, p_reason: body.reason.trim() });
    if (result.error) {
      if (result.error.code === "42501") throw new RequestError("Action interdite sur ce compte.", 403);
      if (result.error.code === "P0002") throw new RequestError("Compte ou signalement introuvable.", 404);
      throw new RequestError("Action impossible. Actualisez puis réessayez.", 503);
    }
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store, private" } });
  } catch (error) { return apiError(error); }
}
