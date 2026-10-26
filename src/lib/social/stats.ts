/**
 * Classement et historique des parties.
 *
 * Sans directive "use client" : ces lectures sont faites côté serveur par les
 * pages, pour que le classement arrive déjà rempli plutôt qu'après un aller-
 * retour depuis le navigateur.
 *
 * Toutes les valeurs viennent de `game_results` — les parties réellement
 * déclarées par les jeux. Rien n'est estimé, arrondi ni gonflé : un
 * classement vide veut dire qu'aucune partie n'a encore été enregistrée.
 */

export type LeaderboardEntry = {
  rank: number;
  userId: string;
  username: string;
  avatarUrl: string | null;
  gamesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number | null;
};

export type MatchPlayer = {
  userId: string | null;
  /** Pseudonyme du compte, ou celui saisi dans le jeu par un invité. */
  label: string;
  avatarUrl: string | null;
  outcome: "win" | "loss" | "draw";
  score: number | null;
  position: number | null;
};

export type Match = {
  id: string;
  gameSlug: string;
  roomCode: string | null;
  finishedAt: string;
  players: MatchPlayer[];
};

type LeaderboardRow = {
  rank: number;
  user_id: string;
  username: string;
  avatar_url: string | null;
  games_played: number;
  wins: number;
  losses: number;
  draws: number;
  win_rate: number | null;
};

type MatchRow = {
  id: string;
  game_slug: string;
  room_code: string | null;
  finished_at: string;
  players: MatchPlayer[] | null;
};

export function toLeaderboard(rows: unknown): LeaderboardEntry[] {
  if (!Array.isArray(rows)) return [];
  return (rows as LeaderboardRow[]).map((row) => ({
    rank: Number(row.rank),
    userId: row.user_id,
    username: row.username,
    avatarUrl: row.avatar_url,
    gamesPlayed: Number(row.games_played),
    wins: Number(row.wins),
    losses: Number(row.losses),
    draws: Number(row.draws),
    winRate: row.win_rate === null ? null : Number(row.win_rate),
  }));
}

export function toMatches(rows: unknown): Match[] {
  if (!Array.isArray(rows)) return [];
  return (rows as MatchRow[]).map((row) => ({
    id: row.id,
    gameSlug: row.game_slug,
    roomCode: row.room_code,
    finishedAt: row.finished_at,
    players: row.players ?? [],
  }));
}
