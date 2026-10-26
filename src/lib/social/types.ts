/**
 * Types du socle social, partagés entre serveur et navigateur.
 *
 * Sans directive "use client" : les pages serveur (profil, amis) rendent une
 * partie de ces données elles-mêmes et doivent pouvoir importer ces types et
 * les fonctions de conversion.
 */

export type PresenceStatus = "online" | "away" | "in_game" | "offline";

/** Les états de relation que `search_players` renvoie. */
export type Relationship = "none" | "friend" | "request_sent" | "request_received";

export type PlayerSummary = {
  id: string;
  username: string;
  avatarUrl: string | null;
};

export type SearchResult = PlayerSummary & {
  relationship: Relationship;
  acceptsRequests: boolean;
};

export type FriendEntry = PlayerSummary & {
  friendshipId: string;
  /** Statut de présence, résolu depuis Realtime (jamais inventé). */
  presence: PresenceStatus;
  /** Jeu en cours, seulement si l'ami partage son activité. */
  gameSlug: string | null;
};

export type FriendRequestEntry = PlayerSummary & {
  friendshipId: string;
  createdAt: string;
  /** "incoming" : on peut accepter ou refuser. "outgoing" : on peut annuler. */
  direction: "incoming" | "outgoing";
};

export type NotificationKind =
  | "friend_request"
  | "friend_accepted"
  | "game_invitation"
  | "invitation_accepted"
  | "invitation_declined"
  | "platform_invite"
  | "group_added"
  | "group_removed";

export type PlatformNotification = {
  id: string;
  kind: NotificationKind;
  actorId: string | null;
  actorUsername: string | null;
  actorAvatarUrl: string | null;
  gameSlug: string | null;
  invitationId: string | null;
  readAt: string | null;
  createdAt: string;
};

export type GameInvitation = {
  id: string;
  gameSlug: string;
  fromUserId: string;
  fromUsername: string;
  fromAvatarUrl: string | null;
  roomCode: string | null;
  expiresAt: string;
  createdAt: string;
};

/** Ce que les tables renvoient, avant conversion en types applicatifs. */
export type ProfileJoin = { username: string; avatar_url: string | null } | null;

export type NotificationRow = {
  id: string;
  kind: NotificationKind;
  actor_id: string | null;
  game_slug: string | null;
  invitation_id: string | null;
  read_at: string | null;
  created_at: string;
  actor: ProfileJoin;
};

export type InvitationRow = {
  id: string;
  game_slug: string;
  from_user_id: string;
  to_user_id: string;
  room_code: string | null;
  status: string;
  expires_at: string;
  created_at: string;
  from_user: ProfileJoin;
};

export type FriendshipRow = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: string;
  blocked_by: string | null;
  created_at: string;
  requester: ProfileJoin;
  addressee: ProfileJoin;
};

export function toNotification(row: NotificationRow): PlatformNotification {
  return {
    id: row.id,
    kind: row.kind,
    actorId: row.actor_id,
    actorUsername: row.actor?.username ?? null,
    actorAvatarUrl: row.actor?.avatar_url ?? null,
    gameSlug: row.game_slug,
    invitationId: row.invitation_id,
    readAt: row.read_at,
    createdAt: row.created_at,
  };
}

export function toInvitation(row: InvitationRow): GameInvitation {
  return {
    id: row.id,
    gameSlug: row.game_slug,
    fromUserId: row.from_user_id,
    fromUsername: row.from_user?.username ?? "Joueur",
    fromAvatarUrl: row.from_user?.avatar_url ?? null,
    roomCode: row.room_code,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  };
}

/** Une invitation encore utilisable : en attente et non expirée. */
export function isInvitationLive(invitation: { expiresAt: string }): boolean {
  return new Date(invitation.expiresAt).getTime() > Date.now();
}

/**
 * Sépare une ligne d'amitié en « l'autre joueur » + le sens de la demande.
 * Une amitié n'a pas de propriétaire : la même ligne se lit différemment
 * selon qui la regarde.
 */
export function readFriendship(row: FriendshipRow, meId: string) {
  const iAmRequester = row.requester_id === meId;
  const otherId = iAmRequester ? row.addressee_id : row.requester_id;
  const otherProfile = iAmRequester ? row.addressee : row.requester;
  return {
    otherId,
    username: otherProfile?.username ?? "Joueur",
    avatarUrl: otherProfile?.avatar_url ?? null,
    direction: (iAmRequester ? "outgoing" : "incoming") as "outgoing" | "incoming",
  };
}
