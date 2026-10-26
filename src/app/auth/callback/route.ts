import type { NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { redirectTo, isSafeInternalPath } from "@/lib/site-url";

// Atteinte après un lien de confirmation d'e-mail ou de réinitialisation de
// mot de passe. Valide le jeton auprès de Supabase, ce qui pose les cookies de
// session, puis continue vers `next` (par défaut le profil — l'inscription
// passe explicitement `next=/auth/confirmed`).
//
// Deux formats de lien sont acceptés, parce que Supabase peut envoyer l'un ou
// l'autre selon le modèle d'e-mail configuré, et qu'ils ne se valident pas de
// la même façon :
//
//   • `?token_hash=…&type=signup` — vérification OTP. Ne dépend d'aucun état
//     stocké dans le navigateur, donc fonctionne même si le lien est ouvert
//     sur un autre appareil que celui de l'inscription. C'est le format du
//     modèle d'e-mail de ce dépôt (voir supabase/templates/confirmation.html).
//   • `?code=…` — échange d'un code PKCE. C'est ce que produit le
//     `{{ .ConfirmationURL }}` par défaut de Supabase. Le code ne peut être
//     échangé que par le navigateur qui a lancé l'inscription, puisque le
//     vérificateur PKCE y est stocké en cookie.
//
// Les deux flux ne sont jamais mélangés sur une même requête : on regarde quel
// paramètre est présent et on utilise la méthode qui correspond.
//
// Aucun échec ne laisse le joueur sur une page d'erreur Supabase brute ou une
// redirection silencieuse : tout atterrit sur /auth/confirmed avec un statut
// que cette page sait expliquer en français.
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const rawNext = searchParams.get("next");
  const next = rawNext && isSafeInternalPath(rawNext) ? rawNext : "/profile";

  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");

  // Supabase peut aussi rapporter l'échec directement dans le lien, sans
  // jeton à valider — on n'a alors rien à vérifier.
  const reported = searchParams.get("error_code") ?? searchParams.get("error");
  if (reported && !tokenHash && !code) {
    return fail(request, reported);
  }

  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return redirectTo(request, next);
    return fail(request, error.code ?? error.message);
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return redirectTo(request, next);
    return fail(request, error.code ?? error.message);
  }

  // Ni jeton, ni code, ni erreur rapportée : lien tronqué par un client de
  // messagerie, ou route ouverte à la main.
  return redirectTo(request, "/auth/confirmed?status=invalid");
}

/**
 * Traduit le code d'erreur de Supabase en un statut que /auth/confirmed sait
 * présenter. Volontairement conservateur : un code inconnu devient "error"
 * (« impossible de vérifier pour le moment »), jamais un faux diagnostic.
 */
function fail(request: NextRequest, rawCode: string) {
  const code = rawCode.toLowerCase();

  let status = "error";
  if (code.includes("expired")) {
    // otp_expired, flow_state_expired, email_link_expired…
    status = "expired";
  } else if (code.includes("flow_state_not_found") || code.includes("code_verifier")) {
    // Le vérificateur PKCE n'est pas dans ce navigateur : le lien a été ouvert
    // ailleurs que là où l'inscription a été faite (cas très courant — on
    // s'inscrit sur l'ordinateur, on relève ses e-mails sur le téléphone).
    status = "other_browser";
  } else if (
    code.includes("already") ||
    code.includes("used") ||
    code.includes("not_found") ||
    code.includes("access_denied")
  ) {
    // Jeton déjà consommé — y compris par le pré-chargement de lien que font
    // certains clients de messagerie. Le compte est alors souvent déjà confirmé.
    status = "used";
  } else if (code.includes("invalid")) {
    status = "invalid";
  }

  return redirectTo(request, `/auth/confirmed?status=${status}`);
}
