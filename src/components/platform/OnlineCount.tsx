"use client";

import { useSocial } from "@/components/social/SocialProvider";

/**
 * Nombre de joueurs actuellement en ligne.
 *
 * Volontairement distinct du nombre d'inscrits : ce sont deux choses
 * différentes, et les confondre serait mentir. Ce chiffre vient de la présence
 * Realtime — donc de connexions réellement ouvertes à cet instant, jamais d'une
 * estimation ni d'un compteur qui monte tout seul.
 *
 * Affiché seulement pour un joueur connecté : un visiteur anonyme ne rejoint
 * pas le canal de présence (il n'a pas d'identité à y publier), il ne peut donc
 * pas compter. Plutôt que d'afficher « 0 en ligne », qui serait faux, on
 * n'affiche rien.
 */
export function OnlineCount() {
  const { me, presence } = useSocial();
  if (!me) return null;

  // La carte est indexée par identifiant de joueur : plusieurs appareils d'un
  // même compte comptent pour un seul joueur en ligne.
  const count = presence.size;
  if (count === 0) return null;

  return (
    <span className="flex items-center gap-1.5">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan opacity-70" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan" />
      </span>
      {count} en ligne
    </span>
  );
}
