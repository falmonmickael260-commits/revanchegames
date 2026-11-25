import { categoryEditorial } from "@/data/seo-editorial";
import type { MetadataRoute } from "next";
import { SITE_URL, publicGames, gamePath } from "@/lib/seo";
export default function sitemap(): MetadataRoute.Sitemap {
  return ["/", "/library", "/jeux", ...publicGames().map(game => gamePath(game.id)), ...categoryEditorial.filter(c => publicGames().some(g => g.categories.includes(c.category))).map(c => "/categories/" + c.slug)].map(path => ({ url: SITE_URL + path }));
}
