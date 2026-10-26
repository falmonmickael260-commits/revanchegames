import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Redirections sûres derrière un proxy — et le bug que ce fichier corrige.
 *
 * En production (Railway), `request.nextUrl.origin` ne renvoie pas le domaine
 * public mais l'adresse interne du conteneur : `https://localhost:8080`
 * (schéma pris dans `x-forwarded-proto`, hôte pris dans l'adresse d'écoute).
 * Toute redirection absolue construite dessus envoyait le joueur sur une
 * adresse qui n'existe que dans le conteneur — d'où le « Safari ne peut pas
 * ouvrir la page, la connexion est impossible » au clic sur le lien de
 * confirmation d'e-mail, et le même échec sur la réinitialisation de mot de
 * passe. Vérifié avant correction :
 *
 *   GET https://revanchegames-production.up.railway.app/auth/callback
 *     → 307 Location: https://localhost:8080/sign-in
 *
 * La correction ne devine pas le domaine public : elle ne l'écrit pas du tout.
 * Un en-tête `Location` relatif est explicitement autorisé (RFC 7231 §7.1.2)
 * et chaque navigateur le résout contre l'URL qu'il a réellement demandée —
 * donc contre le vrai domaine public, quelle que soit la façon dont le proxy
 * réécrit `host`. Aucune variable d'environnement n'est requise pour que cela
 * fonctionne, sur n'importe quel hébergeur et sur n'importe quel domaine
 * (production, préproduction, aperçu de déploiement).
 *
 * `NEXT_PUBLIC_SITE_URL` reste un réglage optionnel : défini, il force un
 * domaine canonique absolu (utile si l'on veut qu'un lien ouvert sur une URL
 * d'aperçu atterrisse malgré tout sur le domaine officiel).
 */
export function redirectTo(request: NextRequest, path: string): NextResponse {
  const safePath = isSafeInternalPath(path) ? path : "/";
  const canonical = normalizeOrigin(process.env.NEXT_PUBLIC_SITE_URL);

  if (canonical) {
    return NextResponse.redirect(new URL(safePath, canonical));
  }

  // `NextResponse.redirect()` exige une URL absolue, ce qui est précisément ce
  // qu'on ne peut pas construire de façon fiable ici — on pose donc l'en-tête
  // nous-mêmes, en relatif.
  return new NextResponse(null, {
    status: 307,
    headers: { Location: safePath },
  });
}

/**
 * Un chemin interne : commence par un seul "/", jamais par "//" ni un schéma.
 *
 * `next` arrive par paramètre d'URL — donc d'une source non fiable, recopiée
 * dans le lien envoyé par e-mail. Sans ce filtre, `/auth/callback?next=//site`
 * ferait du parcours de confirmation une redirection ouverte.
 */
export function isSafeInternalPath(path: string): boolean {
  return path.startsWith("/") && !path.startsWith("//") && !path.includes("://");
}

function normalizeOrigin(value: string | undefined): string | null {
  if (!value) return null;
  try {
    // Tolère une valeur saisie sans schéma ou avec une barre oblique finale.
    return new URL(/^https?:\/\//.test(value) ? value : `https://${value}`).origin;
  } catch {
    return null;
  }
}
