"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { NativeSession } from '@/lib/game-connector/protocol';

export type ActiveGame = {
  slug: string;
  name: string;
  /** URL de l'iframe, jeton d'identité inclus. Figée pour la durée de la partie. */
  src: string;
  identity?: { username: string; avatarUrl: string | null } | null;
  /**
   * Salon visé, quand la partie a été ouverte via une invitation.
   * Fait partie de l'identité de la session : changer de salon est une
   * nouvelle partie, même sur le même jeu.
   */
  roomCode: string | null;
  launchRoom?: string | null;
  admission?: { id: string; session: NativeSession };
  startedAt: number;
};

type GameSessionValue = {
  active: ActiveGame | null;
  /** Déclare la partie en cours. Sans effet si ce jeu est déjà celui qui tourne. */
  start: (game: Pick<ActiveGame, "slug" | "name" | "src" | "roomCode" | "admission" | "identity">) => void;
  reportRoom: (slug: string, code: string | null) => void;
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

  const start = useCallback((game: Pick<ActiveGame, "slug" | "name" | "src" | "roomCode" | "admission" | "identity">) => {
    setActive((previous) => {
      // Le point crucial de tout ce fichier. Revenir sur /play/<slug> fait
      // re-rendre la page côté serveur, qui re-signe un jeton et produit donc
      // une `src` *différente* à chaque fois. Si on l'appliquait, l'attribut
      // src de l'iframe changerait et le navigateur rechargerait le jeu — ce
      // qui est précisément ce qu'on veut éviter. Renvoyer `previous` à
      // l'identique : React ne re-rend pas, l'iframe n'est pas touchée.
      // Le salon compte autant que le jeu : accepter une invitation vers un
      // autre salon du même jeu doit bien recharger la partie, alors qu'un
      // simple retour sur /play/<slug> ne doit rien toucher.
      if (previous && previous.slug === game.slug && (!game.admission || previous.admission?.id === game.admission.id) &&
          (!game.roomCode || previous.launchRoom === game.roomCode)) {
        const identityChanged = previous.identity?.username !== game.identity?.username ||
          previous.identity?.avatarUrl !== game.identity?.avatarUrl;
        // Refresh the account avatar/name without changing the iframe URL or
        // restarting the game session.
        return identityChanged ? { ...previous, identity: game.identity } : previous;
      }
      return { ...game, launchRoom: game.roomCode, startedAt: Date.now() };
    });
  }, []);

  const stop = useCallback(() => setActive(null), []);
  const reportRoom = useCallback((slug: string, code: string | null) => setActive(previous =>
    previous?.slug === slug && previous.roomCode !== code ? { ...previous, roomCode: code } : previous), []);

  const value = useMemo<GameSessionValue>(() => ({ active, start, stop, reportRoom }), [active, start, stop, reportRoom]);

  return <GameSessionContext.Provider value={value}>{children}</GameSessionContext.Provider>;
}

export function useGameSession(): GameSessionValue {
  const value = useContext(GameSessionContext);
  if (!value) throw new Error("useGameSession doit être utilisé dans <GameSessionProvider>");
  return value;
}
