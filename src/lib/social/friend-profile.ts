/**
 * Le profil d'un ami — type et conversion partagés entre serveur et
 * navigateur, sans directive "use client" : la page /profile/<id> (serveur)
 * et un éventuel composant client doivent tous deux pouvoir mapper la ligne
 * renvoyée par `get_friend_profile`, ce qu'un module client interdirait au
 * premier (même erreur que chat-shared.ts pour `rowsToMessages`).
 */

export type FriendProfile = {
  username: string;
  avatarUrl: string | null;
  playerTag: string | null;
  /** Phrase de présentation. Visible même si le profil est masqué. */
  signature: string | null;
  memberSince: string;
  profileVisible: boolean;
  gamesPlayed: number | null;
  wins: number | null;
  losses: number | null;
  draws: number | null;
  winRate: number | null;
  perGame:
    | { gameSlug: string; gamesPlayed: number; wins: number; losses: number; winRate: number | null }[]
    | null;
  friends: { id: string; username: string; avatarUrl: string | null }[] | null;
};

export type FriendProfileRow = {
  username: string;
  avatar_url: string | null;
  player_tag: string | null;
  signature: string | null;
  member_since: string;
  profile_visible: boolean;
  games_played: number | null;
  wins: number | null;
  losses: number | null;
  draws: number | null;
  win_rate: number | null;
  per_game: FriendProfile["perGame"];
  friends: FriendProfile["friends"];
};

export function toFriendProfile(row: FriendProfileRow): FriendProfile {
  return {
    username: row.username,
    avatarUrl: row.avatar_url,
    playerTag: row.player_tag,
    signature: row.signature,
    memberSince: row.member_since,
    profileVisible: row.profile_visible,
    gamesPlayed: row.games_played,
    wins: row.wins,
    losses: row.losses,
    draws: row.draws,
    winRate: row.win_rate,
    perGame: row.per_game,
    friends: row.friends,
  };
}
