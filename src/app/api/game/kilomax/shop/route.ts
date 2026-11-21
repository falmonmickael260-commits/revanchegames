import { createHmac } from "node:crypto";
import { readLimitedBody, RequestError, UUID_PATTERN } from "@/lib/request-security";
import { verifyPlatformToken } from "@/lib/platform-token";
import { createServiceClient } from "@/lib/supabase/server";

function cors(request: Request) {
  const origin = request.headers.get("origin");
  const allowed = ["https://www.kilomax.fr", "https://kilomax.fr", process.env.KILOMAX_SHOP_ORIGIN];
  return origin && allowed.includes(origin) ? {
    "access-control-allow-origin": origin, "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "content-type, authorization", "vary": "Origin",
    "cache-control": "no-store",
  } : null;
}

export function OPTIONS(request: Request) {
  const headers = cors(request);
  return new Response(null, { status: headers ? 204 : 403, headers: headers ?? undefined });
}

export async function POST(request: Request) {
  const headers = cors(request);
  if (!headers) return Response.json({ error: "Origine refusée." }, { status: 403 });
  try {
    const token = request.headers.get("authorization")?.match(/^Bearer ([A-Za-z0-9_.-]{1,4096})$/)?.[1];
    const identity = verifyPlatformToken(token);
    if (!identity || !UUID_PATTERN.test(identity.uid)) throw new RequestError("Ouvre Kilomax depuis ton compte Revanche Games.", 401);
    let input: unknown;
    try { input = JSON.parse(Buffer.from(await readLimitedBody(request, 2048)).toString()); }
    catch (error) { if (error instanceof RequestError) throw error; throw new RequestError("Requête invalide."); }
    const data = input as { action?: unknown; item?: unknown; match?: unknown; player?: unknown; price?: unknown; secret?: unknown } | null;
    const action = data?.action;
    if (action !== "catalog" && action !== "vehicle" && action !== "chest" && action !== "permit") throw new RequestError("Action invalide.");

    const signingKey = process.env.KILOMAX_COMMERCE_SECRET;
    if (action !== "catalog" && !signingKey) throw new RequestError("Boutique indisponible.", 503);
    if (action === "permit" && (typeof data?.match !== "string" || !/^ENR-[A-Z0-9]{4}$/.test(data.match) ||
        typeof data?.player !== "string" || !/^[A-Za-z0-9_-]{1,96}$/.test(data.player) ||
        typeof data?.secret !== "string" || !UUID_PATTERN.test(data.secret) ||
        typeof data?.item !== "string" || !/^[a-z-]{1,24}$/.test(data.item))) {
      throw new RequestError("Sélection invalide.");
    }

    const db = createServiceClient();
    const { data: account, error: authError } = await db.auth.admin.getUserById(identity.uid);
    if (authError || !account.user || account.user.is_anonymous || Date.parse(account.user.banned_until ?? "") > Date.now()) {
      throw new RequestError("Compte Revanche Games indisponible.", 401);
    }
    const { data: result, error } = await db.rpc("kilomax_shop", {
      p_user: identity.uid, p_action: action === "permit" ? "catalog" : action,
      p_item: typeof data?.item === "string" ? data.item : null,
      p_match: typeof data?.match === "string" ? data.match : null,
      p_player: typeof data?.player === "string" ? data.player : null,
      p_expected_price: data?.price === 300 || data?.price === 500 ? data.price : null,
    });
    if (error || !result) throw new RequestError("Portefeuille indisponible.", 503);
    if (result.error === "insufficient_balance") throw new RequestError("Solde de pièces insuffisant.", 409);
    if (result.error) throw new RequestError("Achat indisponible.");
    if (action === "permit") {
      if (!result.owned?.includes(data?.item)) throw new RequestError("Ce véhicule doit être acheté.", 403);
      const expires = Math.floor(Date.now() / 1000) + 90;
      const message = `kilomax-car-v1.${data?.match}.${data?.player}.${data?.secret}.${data?.item}.${expires}`;
      const signature = createHmac("sha256", signingKey!).update(message).digest("hex");
      return Response.json({ ...result, permit: { expires, signature } }, { headers });
    }
    if (result.receipt) {
      if (!signingKey) throw new RequestError("Coffre indisponible.", 503);
      const { id, match, player, reward } = result.receipt;
      const proof = createHmac("sha256", signingKey).update(`kilomax-chest-v1.${id}.${match}.${player}.${reward}`).digest("hex");
      return Response.json({ ...result, receipt: { ...result.receipt, proof } }, { headers });
    }
    return Response.json(result, { headers });
  } catch (error) {
    return Response.json({ error: error instanceof RequestError ? error.message : "Portefeuille indisponible." },
      { status: error instanceof RequestError ? error.status : 503, headers });
  }
}
