"use client";

import { useEffect, useState } from "react";
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
};

export function usePlatformIdentity(): { me: PlatformIdentity | null; ready: boolean } {
  const [me, setMe] = useState<PlatformIdentity | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    async function load(userId: string | null) {
      if (!userId) {
        if (!cancelled) {
          setMe(null);
          setReady(true);
        }
        return;
      }

      const { data } = await supabase
        .from("profiles")
        .select("username, avatar_url, share_activity, allow_friend_requests")
        .eq("id", userId)
        .single();

      if (cancelled) return;
      setMe({
        id: userId,
        username: data?.username ?? "Joueur",
        avatarUrl: data?.avatar_url ?? null,
        // Par défaut on partage, comme la valeur par défaut en base ; mais si
        // la ligne n'a pas pu être lue on reste prudent sur l'activité.
        shareActivity: data?.share_activity ?? false,
        allowFriendRequests: data?.allow_friend_requests ?? true,
      });
      setReady(true);
    }

    supabase.auth.getUser().then(({ data }) => load(data.user?.id ?? null));

    // Connexion ou déconnexion depuis un autre onglet.
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      load(session?.user?.id ?? null);
    });

    return () => {
      cancelled = true;
      subscription.subscription.unsubscribe();
    };
  }, []);

  return { me, ready };
}
