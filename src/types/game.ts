export type GameCategory =
  | "cartes"
  | "plateau"
  | "quiz"
  | "ambiance"
  | "strategie"
  | "action"
  | "des"
  | "sport";

export type GameStatus = "development" | "coming-soon" | "available";

export type GameIconKey =
  | "message-circle"
  | "flag"
  | "ban"
  | "moon-star"
  | "castle"
  | "users"
  | "brain-circuit"
  | "crown"
  | "layers"
  | "grid"
  | "alert-triangle"
  | "bomb"
  | "target"
  | "drama"
  | "wallet"
  | "dices"
  | "circle-dot";

export type GameTheme = {
  /** Primary accent used for this game's card and detail treatments. */
  accent: string;
  /** Secondary accent for gradients. */
  accentSoft: string;
};

export type Game = {
  id: string;
  name: string;
  tagline: string;
  description: string;
  categories: GameCategory[];
  status: GameStatus;
  enabled: boolean;
  url?: string;
  theme: GameTheme;
  /** Decorative motif icon for the generated fallback illustration — resolved via GAME_ICON_MAP. */
  icon: GameIconKey;
  /** Path under /public to this game's cover art (1200×750, 16:10). Falls back to the generated illustration when absent. */
  image?: string;
  /** ISO date this entry joined the catalog — drives the "Nouveautés" view. */
  addedAt: string;
  /** Factual descriptor of supported player count, e.g. "3 à 6 joueurs". */
  players: string;
};
