import { createHmac, timingSafeEqual } from "node:crypto";

// Server-only: signs a short-lived proof of identity that a game's own
// server can verify (same shared secret) without ever trusting the browser.
// Format: "<base64url payload>.<base64url HMAC-SHA256 signature>" — a
// minimal JWT-shaped token, kept dependency-free on both ends.
export function createPlatformToken(
  user: {
    id: string;
    username: string;
    /**
     * Photo de profil du joueur — URL du bucket `avatars`, ou emoji choisi
     * dans la liste. Transmise pour que le jeu puisse afficher la vraie
     * tête du joueur à sa place autour de la table, au lieu d'un rond vide.
     *
     * Facultative : un compte sans photo n'empêche rien.
     */
    avatarUrl?: string | null;
  },
  // 30 min: a real player may sit in a lobby choosing an avatar, waiting for
  // friends, or reading the rules before actually creating/joining a room.
  ttlSeconds = 1800,
): string {
  const secret = process.env.PLATFORM_SHARED_SECRET;
  if (!secret) throw new Error("PLATFORM_SHARED_SECRET is not configured");

  const now = Math.floor(Date.now() / 1000);
  // `avatar` n'est ajouté que s'il existe : un jeton plus court pour les
  // comptes sans photo, et un champ absent plutôt que `null` côté jeu.
  const payload = {
    uid: user.id,
    username: user.username,
    ...(user.avatarUrl ? { avatar: user.avatarUrl } : {}),
    iat: now,
    exp: now + ttlSeconds,
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", secret).update(payloadB64).digest("base64url");

  return `${payloadB64}.${signature}`;
}

export interface PlatformIdentity {
  uid: string;
  username: string;
  /** Absente si le joueur n'a pas de photo de profil. */
  avatar?: string;
}

// The counterpart: used by this shell's own API routes (e.g. report-result,
// called directly by a client-only game with no trusted server of its own —
// see docs/PLATFORM.md, Kilomax). Each game's own server normally verifies
// the token itself; this one is for routes that run here instead.
export function verifyPlatformToken(token: unknown): PlatformIdentity | null {
  if (typeof token !== "string") return null;
  const secret = process.env.PLATFORM_SHARED_SECRET;
  if (!secret) return null;

  const [payloadB64, signature] = token.split(".");
  if (!payloadB64 || !signature) return null;

  const expected = createHmac("sha256", secret).update(payloadB64).digest("base64url");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8")) as {
      uid?: unknown;
      username?: unknown;
      avatar?: unknown;
      exp?: unknown;
    };
    if (typeof payload.exp !== "number" || payload.exp < Math.floor(Date.now() / 1000)) return null;
    if (typeof payload.uid !== "string" || typeof payload.username !== "string") return null;
    return {
      uid: payload.uid,
      username: payload.username,
      ...(typeof payload.avatar === "string" ? { avatar: payload.avatar } : {}),
    };
  } catch {
    return null;
  }
}
