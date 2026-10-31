import { NextResponse } from "next/server";
import { verifyPlatformToken } from "@/lib/platform-token";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * Point d'entrée public pour un jeu SANS serveur de confiance (Kilomax —
 * un client Unity WebGL qui parle directement à un projet Supabase externe,
 * sans aucun composant serveur à nous où garder une clé secrète). Voir
 * docs/PLATFORM.md, section Kilomax.
 *
 * La seule protection est la signature du jeton : n'importe qui peut
 * appeler cette route, mais seul un jeton signé par cette coquille (donc
 * émis pour un compte réellement connecté) sera accepté. C'est strictement
 * moins robuste que les quatre autres jeux, où un serveur de confiance
 * calcule lui-même le résultat — risque déjà documenté dans le dossier
 * d'audit, pas résolu ici, juste explicitement assumé pour ce cas précis.
 */

// La Meute publie ses résultats uniquement depuis son serveur de confiance.
const ALLOWED_GAME_SLUGS = new Set(["kilomax", "president", "quiz-master", "10000"]);
const ALLOWED_OUTCOMES = new Set(["win", "loss", "draw"]);

// Ouvert : la protection réelle est la signature du jeton, pas l'origine —
// un jeu client-only n'a pas de domaine fixe connu à l'avance.
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400, headers: CORS_HEADERS });
  }

  const { gameSlug, idempotencyKey, roomCode, rgToken, outcome, score } = body as Record<string, unknown>;

  if (typeof gameSlug !== "string" || !ALLOWED_GAME_SLUGS.has(gameSlug)) {
    return NextResponse.json({ error: "gameSlug inconnu." }, { status: 400, headers: CORS_HEADERS });
  }
  if (typeof idempotencyKey !== "string" || !idempotencyKey) {
    return NextResponse.json({ error: "idempotencyKey requis." }, { status: 400, headers: CORS_HEADERS });
  }
  if (typeof outcome !== "string" || !ALLOWED_OUTCOMES.has(outcome)) {
    return NextResponse.json({ error: "outcome invalide." }, { status: 400, headers: CORS_HEADERS });
  }
  const scoreValue = typeof score === "number" && Number.isFinite(score) ? score : null;

  const identity = verifyPlatformToken(rgToken);
  if (!identity) {
    // Jeton absent, invalide ou expiré : rien à attribuer, mais ce n'est pas
    // une erreur côté jeu — il n'avait aucune raison d'appeler cette route
    // sans jeton valide en premier lieu.
    return NextResponse.json({ ok: true, skipped: "no_valid_identity" }, { headers: CORS_HEADERS });
  }

  const supabase = createServiceClient();
  const { error } = await supabase.rpc("record_game_result", {
    p_game_slug: gameSlug,
    p_idempotency_key: idempotencyKey,
    p_room_code: typeof roomCode === "string" ? roomCode : null,
    p_raw_payload: null,
    p_players: [{ user_id: identity.uid, guest_label: null, outcome, score: scoreValue, position: null }],
  });

  if (error) {
    console.error("[report-result] record_game_result failed", error);
    return NextResponse.json({ error: "Échec de l'enregistrement." }, { status: 500, headers: CORS_HEADERS });
  }

  return NextResponse.json({ ok: true }, { headers: CORS_HEADERS });
}
