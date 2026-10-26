"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

export type ActiveGame = {
  slug: string;
  name: string;
  /** URL de l'iframe, jeton d'identité inclus. Figée pour la durée de la partie. */
  src: string;
  startedAt: number;
};

type GameSessionValue = {
  active: ActiveGame | null;
  /** Déclare la partie en cours. Sans effet si ce jeu est déjà celui qui tourne. */
  start: (game: Pick<ActiveGame, "slug" | "name" | "src">) => void;
  /** Termine la partie : démonte l'iframe et ferme ses connexions. */
  stop: () => void;
};

const GameSessionContext = createContext<GameSessionValue | null>(null);

/**
 * Garde la partie en cours vivante pendant que le joueur navigue ailleurs.
 *
 * Le problème résolu : l'iframe du jeu vivait dans la page `/play/[slug]`.
 * Dès que le joueur ouvrait son profil ou le chat, Next.js démontait cette
 * route — donc l'iframe, donc le moteur du jeu et sa connexion temps réel. Au
 * retour, l'iframe était recréée de zéro : partie perdue, salon quitté.
 *
 * La correction est structurelle, pas cosmétique : ce fournisseur est monté
 * dans la coquille (layout racine), qui n'est jamais démontée d'une route à
 * l'autre. L'iframe y est rendue une seule fois et seulement *masquée* quand
 * le joueur regarde une autre section — voir <GameViewport />. La page
 * `/play/[slug]` ne rend plus le jeu : elle se contente de déclarer quelle
 * partie doit tourner.
 *
 * Volontairement en mémoire seulement, jamais dans localStorage : une partie
 * ne survit pas à la fermeture de l'onglet, et il ne faut pas proposer de
 * « reprendre » une partie que le serveur du jeu a déjà abandonnée.
 */
export function GameSessionProvider({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState<ActiveGame | null>(null);

  const start = useCallback((game: Pick<ActiveGame, "slug" | "name" | "src">) => {
    setActive((previous) => {
      // Le point crucial de tout ce fichier. Revenir sur /play/<slug> fait
      // re-rendre la page côté serveur, qui re-signe un jeton et produit donc
      // une `src` *différente* à chaque fois. Si on l'appliquait, l'attribut
      // src de l'iframe changerait et le navigateur rechargerait le jeu — ce
      // qui est précisément ce qu'on veut éviter. Renvoyer `previous` à
      // l'identique : React ne re-rend pas, l'iframe n'est pas touchée.
      if (previous && previous.slug === game.slug) return previous;
      return { ...game, startedAt: Date.now() };
    });
  }, []);

  const stop = useCallback(() => setActive(null), []);

  const value = useMemo<GameSessionValue>(() => ({ active, start, stop }), [active, start, stop]);

  return <GameSessionContext.Provider value={value}>{children}</GameSessionContext.Provider>;
}

export function useGameSession(): GameSessionValue {
  const value = useContext(GameSessionContext);
  if (!value) throw new Error("useGameSession doit être utilisé dans <GameSessionProvider>");
  return value;
}
