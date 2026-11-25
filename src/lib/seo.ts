import { GAMES } from "@/data/games";
export const SITE_URL = "https://www.revanchegames.com";
export const SITE_NAME = "Revanche Games";
export const SITE_DESCRIPTION = "Jeux multijoueurs en ligne : défie tes amis aux jeux de cartes, quiz, jeux de stratégie et d’action. Retrouve la communauté Revanche Games et ses salons vocaux.";
export const publicGames = () => GAMES.filter(game => game.enabled && game.status === "available" && Boolean(game.url));
export const gamePath = (slug: string) => "/jeux/" + slug;
export const jsonLd = (data: unknown) => JSON.stringify(data).replace(/</g, "\\u003c");
