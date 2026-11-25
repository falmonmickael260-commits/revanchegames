import { GAMES } from "@/data/games";
export const SITE_URL = "https://www.revanchegames.com";
export const SITE_NAME = "Revanche Games";
export const SITE_TITLE = "Revanche Games – Jeux en ligne entre amis";
export const SITE_DESCRIPTION = "Joue, défie tes amis et prends ta revanche ! Découvre nos jeux multijoueurs en ligne : cartes, quiz, jeux de société et salons vocaux en français.";
export const publicGames = () => GAMES.filter(game => game.enabled && game.status === "available" && Boolean(game.url));
export const gamePath = (slug: string) => "/jeux/" + slug;
export const jsonLd = (data: unknown) => JSON.stringify(data).replace(/</g, "\\u003c");
