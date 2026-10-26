"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { createClient } from "@/lib/supabase/client";
import { usePlatformIdentity, type PlatformIdentity } from "@/lib/use-identity";
import { usePresence, type PresenceMap } from "@/lib/use-presence";
import { useGameSession } from "@/components/game/GameSessionProvider";
import { markNotificationsRead } from "@/lib/social/api";
import {
  readFriendship,
  toInvitation,
  toNotification,
  type FriendEntry,
  type FriendRequestEntry,
  type FriendshipRow,
  type GameInvitation,
  type InvitationRow,
  type NotificationRow,
  type PlatformNotification,
  type PlayerSummary,
} from "@/lib/social/types";

const NOTIFICATION_LIMIT = 30;

type SocialValue = {
  me: PlatformIdentity | null;
  ready: boolean;

  friends: FriendEntry[];
  incomingRequests: FriendRequestEntry[];
  outgoingRequests: FriendRequestEntry[];
  blocked: PlayerSummary[];

  notifications: PlatformNotification[];
  unreadCount: number;
  invitations: GameInvitation[];

  presence: PresenceMap;

  /** Recharge amis, demandes et invitations après une action. */
  refresh: () => Promise<void>;
  markAllRead: () => Promise<void>;
};

const SocialContext = createContext<SocialValue | null>(null);

/**
 * Le socle social commun à tous les jeux : une identité, une liste d'amis,
 * une présence, un flux d'invitations et un flux de notifications.
 *
 * Monté dans la coquille — donc jamais démonté d'une route à l'autre — pour
 * deux raisons : la présence ne doit pas clignoter quand le joueur navigue, et
 * une invitation reçue pendant une partie doit lui parvenir où qu'il soit.
 *
 * Rien n'est dupliqué par jeu : c'est volontairement un seul jeu de tables
 * (`friendships`, `game_invitations`, `notifications`) partagé par Kilomax,
 * Président, Quiz Master, La Meute et 10000.
 */
export function SocialProvider({ children }: { children: React.ReactNode }) {
  const { me, ready } = usePlatformIdentity();
  const { active } = useGameSession();

  const [friendships, setFriendships] = useState<FriendshipRow[]>([]);
  const [notifications, setNotifications] = useState<PlatformNotification[]>([]);
  const [invitations, setInvitations] = useState<GameInvitation[]>([]);

  const presence = usePresence({
    meId: me?.id ?? null,
    shareActivity: me?.shareActivity ?? false,
    currentGameSlug: active?.slug ?? null,
  });

  const loadFriendships = useCallback(async () => {
    const supabase = createClient();
    // RLS limite déjà aux relations où l'on est impliqué : pas de filtre
    // `user_id` à écrire ici, et aucun moyen d'en lire d'autres.
    const { data } = await supabase
      .from("friendships")
      .select(
        "id, requester_id, addressee_id, status, blocked_by, created_at," +
          " requester:profiles!friendships_requester_id_fkey(username, avatar_url)," +
          " addressee:profiles!friendships_addressee_id_fkey(username, avatar_url)",
      )
      .order("created_at", { ascending: false });
    setFriendships((data ?? []) as unknown as FriendshipRow[]);
  }, []);

  const loadNotifications = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("notifications")
      .select(
        "id, kind, actor_id, game_slug, invitation_id, read_at, created_at," +
          " actor:profiles!notifications_actor_id_fkey(username, avatar_url)",
      )
      .order("created_at", { ascending: false })
      .limit(NOTIFICATION_LIMIT);
    setNotifications(((data ?? []) as unknown as NotificationRow[]).map(toNotification));
  }, []);

  const loadInvitations = useCallback(async (meId: string) => {
    const supabase = createClient();
    const { data } = await supabase
      .from("game_invitations")
      .select(
        "id, game_slug, from_user_id, to_user_id, room_code, status, expires_at, created_at," +
          " from_user:profiles!game_invitations_from_user_id_fkey(username, avatar_url)",
      )
      .eq("to_user_id", meId)
      .eq("status", "pending")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false });
    setInvitations(((data ?? []) as unknown as InvitationRow[]).map(toInvitation));
  }, []);

  const refresh = useCallback(async () => {
    if (!me) return;
    await Promise.all([loadFriendships(), loadNotifications(), loadInvitations(me.id)]);
  }, [me, loadFriendships, loadNotifications, loadInvitations]);

  // Chargement initial. Rien à vider à la déconnexion : les valeurs
  // exposées plus bas sont filtrées sur `me`, ce qui évite un `setState`
  // dans un effet (et un rendu en cascade).
  useEffect(() => {
    if (!me) return;
    let cancelled = false;
    (async () => {
      await Promise.all([loadFriendships(), loadNotifications(), loadInvitations(me.id)]);
      if (cancelled) return;
    })();
    return () => {
      cancelled = true;
    };
  }, [me, loadFriendships, loadNotifications, loadInvitations]);

  // Temps réel. Les charges utiles de Realtime n'embarquent pas les jointures
  // de profil, donc on recharge la liste concernée plutôt que de reconstituer
  // une ligne partielle — c'est une requête courte et toujours cohérente.
  useEffect(() => {
    if (!me) return;
    const supabase = createClient();

    const channel = supabase
      .channel("rg-social")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${me.id}` },
        () => {
          void loadNotifications();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "game_invitations" },
        () => {
          void loadInvitations(me.id);
        },
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "friendships" }, () => {
        void loadFriendships();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [me, loadFriendships, loadNotifications, loadInvitations]);

  // Les invitations expirent sans événement en base : on réévalue
  // périodiquement pour retirer de l'écran celles qui ne sont plus valides.
  useEffect(() => {
    if (invitations.length === 0) return;
    const timer = setInterval(() => {
      setInvitations((previous) =>
        previous.filter((invitation) => new Date(invitation.expiresAt).getTime() > Date.now()),
      );
    }, 20_000);
    return () => clearInterval(timer);
  }, [invitations.length]);

  const markAllRead = useCallback(async () => {
    if (!me) return;
    const result = await markNotificationsRead();
    if (result.ok) await loadNotifications();
  }, [me, loadNotifications]);

  const { friends, incomingRequests, outgoingRequests, blocked } = useMemo(() => {
    const friendList: FriendEntry[] = [];
    const incoming: FriendRequestEntry[] = [];
    const outgoing: FriendRequestEntry[] = [];
    const blocked: PlayerSummary[] = [];

    if (!me) return { friends: friendList, incomingRequests: incoming, outgoingRequests: outgoing, blocked };

    for (const row of friendships) {
      const { otherId, username, avatarUrl, direction } = readFriendship(row, me.id);

      if (row.status === "blocked") {
        // On ne liste que les blocages qu'on a posés soi-même : être bloqué
        // par quelqu'un ne doit pas le lui révéler.
        if (row.blocked_by === me.id) blocked.push({ id: otherId, username, avatarUrl });
        continue;
      }

      if (row.status === "accepted") {
        const live = presence.get(otherId);
        friendList.push({
          id: otherId,
          username,
          avatarUrl,
          friendshipId: row.id,
          // Absent de la carte de présence = aucune connexion active.
          presence: live?.status ?? "offline",
          gameSlug: live?.gameSlug ?? null,
        });
        continue;
      }

      const entry: FriendRequestEntry = {
        id: otherId,
        username,
        avatarUrl,
        friendshipId: row.id,
        createdAt: row.created_at,
        direction,
      };
      if (direction === "incoming") incoming.push(entry);
      else outgoing.push(entry);
    }

    // En ligne d'abord, puis par pseudonyme — la liste reste lisible même
    // avec beaucoup d'amis.
    const order: Record<string, number> = { in_game: 0, online: 1, away: 2, offline: 3 };
    friendList.sort(
      (a, b) =>
        (order[a.presence] ?? 9) - (order[b.presence] ?? 9) ||
        a.username.localeCompare(b.username, "fr"),
    );

    return { friends: friendList, incomingRequests: incoming, outgoingRequests: outgoing, blocked };
  }, [friendships, me, presence]);

  const unreadCount = useMemo(
    () => notifications.filter((notification) => notification.readAt === null).length,
    [notifications],
  );

  const value = useMemo<SocialValue>(
    () => ({
      me,
      ready,
      friends,
      incomingRequests,
      outgoingRequests,
      blocked,
      // Filtrés sur la session : un état chargé avant une déconnexion ne
      // doit pas rester visible.
      notifications: me ? notifications : [],
      unreadCount: me ? unreadCount : 0,
      invitations: me ? invitations : [],
      presence,
      refresh,
      markAllRead,
    }),
    [
      me,
      ready,
      friends,
      incomingRequests,
      outgoingRequests,
      blocked,
      notifications,
      unreadCount,
      invitations,
      presence,
      refresh,
      markAllRead,
    ],
  );

  return <SocialContext.Provider value={value}>{children}</SocialContext.Provider>;
}

export function useSocial(): SocialValue {
  const value = useContext(SocialContext);
  if (!value) throw new Error("useSocial doit être utilisé dans <SocialProvider>");
  return value;
}
