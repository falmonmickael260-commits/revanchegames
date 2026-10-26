"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createClient } from "./supabase/client";

/**
 * Le joueur connecté, tel que la plateforme le connaît.
 *
 * Une seule lecture d'identité pour toute la coquille — chat, amis, présence,
 * invitations et notifications s'appuient dessus, pour qu'un même compte ne
 * puisse pas apparaître sous deux identités selon le composant.
 *
 * `null` signifie visiteur : il n'y a pas de profil, donc pas de pseudonyme
 * de plateforme. Un visiteur qui saisit un pseudo dans un jeu reste un
 * visiteur — ce pseudo n'existe que dans ce jeu, n'alimente aucune
 * statistique, et ne lui donne accès à rien ici.
 */
export type PlatformIdentity = {
  id: string;
  username: string;
  avatarUrl: string | null;
  shareActivity: boolean;
  allowFriendRequests: boolean;
  /** Apparaît hors ligne pour ses amis, même connecté — voir use-presence.ts. */
  ghostMode: boolean;
  /** Statistiques et liste d'amis visibles par les amis sur /profile/<id>. */
  profileVisible: boolean;
};

export function usePlatformIdentity(): { me: PlatformIdentity | null; ready: boolean } {
  const [me, setMe] = useState<PlatformIdentity | null>(null);
  const [ready, setReady] = useState(false);
  // Lu par l'abonnement temps réel ci-dessous, qui ne doit pas se rouvrir à
  // chaque changement d'identité — seulement quand le compte change.
  const userIdRef = useRef<string | null>(null);
  // Ce hook est appelé par plusieurs composants à la fois (SocialProvider et
  // useChatIdentity, au moins) : sans suffixe propre à chaque instance, deux
  // d'entre elles ouvraient un canal du même nom, et Supabase Realtime refuse
  // d'y ajouter un second écouteur une fois le premier abonné ("cannot add
  // postgres_changes callbacks ... after subscribe()") — ce qui faisait
  // planter toute la page dès qu'une seconde instance se montait (typiquement
  // ChatDock, pendant une partie). `useId()` et non `Math.random()` : un tirage
  // aléatoire pendant le rendu est une E/S synchrone que le prérendu statique
  // (Next.js 16 Cache Components) refuse d'exécuter.
  const instanceId = useId();

  const load = useCallback(async (userId: string | null) => {
    userIdRef.current = userId;
    if (!userId) {
      setMe(null);
      setReady(true);
      return;
    }

    const supabase = createClient();
    const { data } = await supabase
      .from("profiles")
      .select("username, avatar_url, share_activity, allow_friend_requests, ghost_mode, profile_visible")
      .eq("id", userId)
      .single();

    // Le compte a pu changer pendant l'attente (déconnexion) : ne pas écraser
    // un état plus récent avec une réponse tardive.
    if (userIdRef.current !== userId) return;

    setMe({
      id: userId,
      username: data?.username ?? "Joueur",
      avatarUrl: data?.avatar_url ?? null,
      // Par défaut on partage, comme la valeur par défaut en base ; mais si
      // la ligne n'a pas pu être lue on reste prudent sur l'activité.
      shareActivity: data?.share_activity ?? false,
      allowFriendRequests: data?.allow_friend_requests ?? true,
      ghostMode: data?.ghost_mode ?? false,
      profileVisible: data?.profile_visible ?? true,
    });
    setReady(true);
  }, []);

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getUser().then(({ data }) => load(data.user?.id ?? null));

    // Connexion ou déconnexion depuis un autre onglet.
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      load(session?.user?.id ?? null);
    });

    return () => {
      subscription.subscription.unsubscribe();
    };
  }, [load]);

  // Reflète en direct un changement fait ailleurs sur *sa propre* ligne —
  // page Paramètres (mode fantôme, activité partagée…), ou un autre onglet.
  // Sans ça, les réglages de confidentialité ne prenaient effet qu'après un
  // rechargement complet : `me` restait figé sur sa valeur de départ, et
  // `usePresence` (qui en dépend) continuait de publier l'ancien choix.
  useEffect(() => {
    if (!me) return;
    const supabase = createClient();
    const userId = me.id;
    const channel = supabase
      // `useId()` contient des ":" (ex. ":r0:"), pas toujours bienvenus dans
      // un nom de canal — on ne garde que les caractères alphanumériques.
      .channel(`rg-own-profile-${userId}-${instanceId.replace(/[^a-zA-Z0-9]/g, "")}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${userId}` },
        () => {
          void load(userId);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // Volontairement indexé sur le seul id : l'abonnement ne doit pas se
    // rouvrir à chaque rechargement d'identité qu'il provoque lui-même.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.id, load]);

  return { me, ready };
}
