"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "./supabase/client";
import type { PresenceStatus } from "./social/types";

/** Sans interaction pendant ce délai, le joueur passe en « absent ». */
const IDLE_AFTER_MS = 5 * 60 * 1000;
/** Fréquence de réévaluation de l'inactivité. */
const IDLE_TICK_MS = 30 * 1000;

const PRESENCE_CHANNEL = "rg-presence";

type PresencePayload = {
  status: Exclude<PresenceStatus, "offline">;
  game_slug: string | null;
};

export type PresenceMap = Map<string, { status: PresenceStatus; gameSlug: string | null }>;

/**
 * Présence des joueurs, via Realtime Presence de Supabase.
 *
 * Pourquoi Presence et pas une colonne `last_seen` : c'est le mécanisme temps
 * réel déjà utilisé par le chat de la plateforme, et il règle gratuitement
 * trois choses qu'un simple horodatage en base fait mal.
 *
 *  • **Fermeture d'onglet.** La présence est attachée à la connexion
 *    WebSocket : elle disparaît quand la connexion tombe, sans qu'il faille
 *    deviner un délai d'expiration. Pas de faux « en ligne » après fermeture.
 *  • **Coupure réseau passagère.** Le client Realtime se reconnecte seul et
 *    se re-déclare ; ce n'est qu'une déconnexion durable qui retire la
 *    présence. Un joueur dans l'ascenseur ne « sort » pas de la liste à la
 *    première seconde. Ce délai appartient à Realtime — nous ne le réglons
 *    pas, et nous ne prétendons donc pas en garantir la durée exacte.
 *  • **Plusieurs appareils.** La clé de présence est l'identifiant du joueur,
 *    donc ses connexions sont regroupées sous cette clé. On fusionne leurs
 *    états en gardant le plus actif : être en partie sur le téléphone gagne
 *    sur un onglet inactif resté ouvert sur l'ordinateur.
 *
 * Confidentialité : `game_slug` n'est diffusé que si le joueur a laissé
 * `share_activity` actif. Sinon il apparaît simplement « en ligne ».
 *
 * La présence est indépendante de la partie : ce hook est monté dans la
 * coquille, donc naviguer d'une section à l'autre ne fait pas disparaître le
 * joueur de la liste de ses amis.
 */
export function usePresence({
  meId,
  shareActivity,
  currentGameSlug,
  ghostMode = false,
}: {
  meId: string | null;
  shareActivity: boolean;
  currentGameSlug: string | null;
  /** En mode fantôme, on rejoint quand même le canal (pour voir les autres),
   * mais on n'y publie jamais sa propre présence — les amis le voient donc
   * "hors ligne", sans rien à démasquer côté serveur. */
  ghostMode?: boolean;
}): PresenceMap {
  const [raw, setRaw] = useState<Record<string, PresencePayload[]>>({});
  const [idle, setIdle] = useState(false);
  // Initialisé à 0 et renseigné dans l'effet : `Date.now()` pendant le rendu
  // est un appel impur, que React peut rejouer ou abandonner.
  const lastActiveRef = useRef(0);

  // Détection d'inactivité : « absent » veut dire connecté mais sans
  // interaction depuis un moment, ou onglet caché.
  useEffect(() => {
    if (!meId) return;

    // Première mesure au montage de l'effet, pas pendant le rendu.
    lastActiveRef.current = Date.now();

    function markActive() {
      lastActiveRef.current = Date.now();
      setIdle(false);
    }

    const events: (keyof WindowEventMap)[] = ["pointerdown", "keydown", "focus", "touchstart"];
    events.forEach((event) => window.addEventListener(event, markActive, { passive: true }));

    function onVisibility() {
      if (document.visibilityState === "visible") markActive();
      else setIdle(true);
    }
    document.addEventListener("visibilitychange", onVisibility);

    const timer = setInterval(() => {
      setIdle(Date.now() - lastActiveRef.current > IDLE_AFTER_MS);
    }, IDLE_TICK_MS);

    return () => {
      events.forEach((event) => window.removeEventListener(event, markActive));
      document.removeEventListener("visibilitychange", onVisibility);
      clearInterval(timer);
    };
  }, [meId]);

  // Ce que ce joueur déclare. En partie l'emporte sur l'inactivité : on ne
  // veut pas afficher « absent » pour quelqu'un qui regarde sa main de cartes
  // sans toucher l'écran.
  const myStatus: PresencePayload["status"] = currentGameSlug ? "in_game" : idle ? "away" : "online";
  const myGameSlug = shareActivity ? currentGameSlug : null;

  useEffect(() => {
    // Déconnecté : aucun canal à ouvrir. On ne remet pas `raw` à zéro ici —
    // le calcul final ci-dessous renvoie déjà une carte vide sans `meId`,
    // ce qui évite un `setState` dans un effet.
    if (!meId) return;

    const supabase = createClient();
    const channel = supabase.channel(PRESENCE_CHANNEL, {
      config: { presence: { key: meId } },
    });

    function sync() {
      setRaw(channel.presenceState() as unknown as Record<string, PresencePayload[]>);
    }

    channel
      .on("presence", { event: "sync" }, sync)
      .on("presence", { event: "join" }, sync)
      .on("presence", { event: "leave" }, sync)
      .subscribe((status) => {
        // Fantôme : on reste abonné (pour continuer de voir les autres),
        // mais on ne publie jamais notre propre entrée.
        if (status === "SUBSCRIBED" && !ghostMode) {
          channel.track({ status: myStatus, game_slug: myGameSlug } satisfies PresencePayload);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
    // Volontairement indexé sur le seul `meId` : l'abonnement doit survivre
    // aux changements de statut, qui sont republiés par l'effet suivant.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meId]);

  // Republie le statut sans rouvrir le canal.
  useEffect(() => {
    if (!meId) return;
    const supabase = createClient();
    const channel = supabase.getChannels().find((c) => c.topic === `realtime:${PRESENCE_CHANNEL}`);
    if (!channel) return;

    // Passage en mode fantôme pendant la session (pas seulement au montage) :
    // retirer l'entrée déjà publiée, plutôt que de la laisser traîner jusqu'à
    // la fermeture de l'onglet.
    if (ghostMode) {
      channel.untrack();
      return;
    }
    channel.track({ status: myStatus, game_slug: myGameSlug } satisfies PresencePayload);
  }, [meId, myStatus, myGameSlug, ghostMode]);

  return useMemo(() => {
    const map: PresenceMap = new Map();
    // Sans identité, pas d'abonnement, donc rien à afficher — y compris si
    // un état antérieur traîne encore après une déconnexion.
    if (!meId) return map;
    // Du plus actif au moins actif : c'est l'ordre de priorité quand un même
    // compte est connecté depuis plusieurs appareils.
    const rank: Record<string, number> = { in_game: 3, online: 2, away: 1 };

    for (const [userId, entries] of Object.entries(raw)) {
      if (!Array.isArray(entries) || entries.length === 0) continue;
      let best: PresencePayload | null = null;
      for (const entry of entries) {
        if (!entry?.status) continue;
        if (!best || (rank[entry.status] ?? 0) > (rank[best.status] ?? 0)) best = entry;
      }
      if (!best) continue;
      map.set(userId, { status: best.status, gameSlug: best.game_slug ?? null });
    }
    return map;
  }, [raw, meId]);
}
