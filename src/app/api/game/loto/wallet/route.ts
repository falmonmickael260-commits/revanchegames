import { createHash, timingSafeEqual } from "node:crypto";
import { verifyPlatformToken } from "@/lib/platform-token";
import { UUID_PATTERN } from "@/lib/request-security";
import { createServiceClient } from "@/lib/supabase/server";

const STAKES = new Set([50, 100, 500, 1000]);
const ACTIONS = new Set(["identity", "balance", "create", "buy", "leave", "start", "settle", "cancel", "sweep"]);
const digest = (value: string) => createHash("sha256").update(value).digest();
const isUuid = (value: unknown): value is string => typeof value === "string" && UUID_PATTERN.test(value);
const failure = (error: string, status: number) => Response.json({ ok: false, error }, { status });

export async function POST(request: Request) {
  const secret = process.env.LOTO_WALLET_SECRET;
  const provided = request.headers.get("authorization") ?? "";
  if (!secret || !timingSafeEqual(digest(provided), digest(`Bearer ${secret}`))) {
    return failure("Service non autorisé.", 403);
  }

  const raw = await request.text();
  if (raw.length > 8192) return failure("Requête trop longue.", 413);

  let data: Record<string, unknown>;
  try {
    const body: unknown = JSON.parse(raw);
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error();
    data = body as Record<string, unknown>;
  } catch {
    return failure("Requête invalide.", 400);
  }

  if (typeof data.action !== "string" || !ACTIONS.has(data.action)) {
    return failure("Opération invalide.", 400);
  }
  const action = data.action;
  const identity = action === "identity" ? verifyPlatformToken(data.token) : null;
  const uid = identity?.uid ?? data.uid;
  if (action === "identity" && (!identity || !isUuid(identity.uid))) {
    return failure("Ouvre le loto depuis ton compte Revanche Games.", 401);
  }
  if (["balance", "create", "buy", "leave"].includes(action) && !isUuid(uid)) {
    return failure("Joueur invalide.", 400);
  }
  if (["create", "buy", "leave", "start", "settle", "cancel"].includes(action) && !isUuid(data.round)) {
    return failure("Salon invalide.", 400);
  }
  if (action === "create" && !STAKES.has(Number(data.price))) return failure("Mise invalide.", 400);
  if (action === "create" || action === "buy") {
    if (!Number.isSafeInteger(data.quantity) || Number(data.quantity) < 1 ||
        Number(data.quantity) > 2147483647 || !isUuid(data.request)) {
      return failure("Commande invalide.", 400);
    }
  }
  if (action === "settle" && (!Array.isArray(data.winners) || data.winners.length !== 3 ||
      !data.winners.every((value) => value === null || isUuid(value)))) {
    return failure("Résultat invalide.", 400);
  }

  const db = createServiceClient();
  if (identity) {
    const { data: profile } = await db.from("profiles").select("username").eq("id", identity.uid).maybeSingle();
    if (!profile) return failure("Compte Revanche Games indisponible.", 401);
    const { data: account, error } = await db.auth.admin.getUserById(identity.uid);
    if (error || !account.user || account.user.is_anonymous ||
        Date.parse(account.user.banned_until ?? "") > Date.now()) {
      return failure("Compte Revanche Games indisponible.", 403);
    }
  }

  const { data: result, error } = await db.rpc("loto_wallet", {
    p_action: action === "identity" ? "balance" : action,
    p_round: isUuid(data.round) ? data.round : null,
    p_uid: isUuid(uid) ? uid : null,
    p_price: action === "create" ? Number(data.price) : null,
    p_quantity: action === "create" || action === "buy" ? Number(data.quantity) : null,
    p_request: isUuid(data.request) ? data.request : null,
    p_winners: action === "settle" ? data.winners : null,
  });
  if (error) {
    console.error("[loto] wallet operation failed", action, error.code);
    if (error.message.includes("solde insuffisant")) return failure("Solde insuffisant.", 409);
    return failure("Portefeuille indisponible.", 503);
  }
  return Response.json(identity && result?.ok ? { ...result, uid: identity.uid, username: identity.username } : result, {
    headers: { "cache-control": "no-store" },
  });
}
