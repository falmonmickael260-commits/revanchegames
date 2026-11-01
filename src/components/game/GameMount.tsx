"use client";

import { useEffect } from "react";
import { useGameSession } from "./GameSessionProvider";
import type { NativeSession } from '@/lib/game-connector/protocol';

/**
 * Déclare auprès de la coquille quelle partie doit tourner.
 *
 * Ne rend rien : le jeu lui-même est affiché par <GameViewport />, monté bien
 * plus haut dans l'arbre pour survivre aux changements de route. Cette page
 * ne fait que calculer la cible (côté serveur, avec le jeton d'identité) et la
 * transmettre.
 */
export function GameMount({
  slug,
  name,
  src,
  roomCode = null,
  admission,
}: {
  slug: string;
  name: string;
  src: string;
  roomCode?: string | null;
  admission?: { id: string; session: NativeSession };
}) {
  const { start } = useGameSession();

  useEffect(() => {
    // `start` ignore un couple (slug, salon) déjà actif, donc ni le double
    // appel du mode strict de React, ni un retour sur cette page, ne
    // rechargent la partie.
    start({ slug, name, src, roomCode, admission });
  }, [start, slug, name, src, roomCode, admission]);

  return null;
}
