import type { MetadataRoute } from "next";
import { SITE_URL, publicGames, gamePath } from "@/lib/seo";
export default function sitemap(): MetadataRoute.Sitemap {
  return ["/", "/library", "/jeux", ...publicGames().map(game => gamePath(game.id))].map(path => ({ url: SITE_URL + path }));
}
