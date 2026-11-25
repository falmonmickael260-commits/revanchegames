import { GAMES } from "@/data/games";
export const SITE_URL = "https://www.revanchegames.com";
export const SITE_NAME = "Revanche Games";
export const SITE_DESCRIPTION = "Revanche Games, la plateforme francophone de jeux multijoueurs en ligne : jeux de cartes, quiz, jeux de société, parties entre amis et salons vocaux.";
export const publicGames = () => GAMES.filter(game => game.enabled && game.status === "available" && Boolean(game.url));
export const gamePath = (slug: string) => "/jeux/" + slug;
export const jsonLd = (data: unknown) => JSON.stringify(data).replace(/</g, "\\u003c");
