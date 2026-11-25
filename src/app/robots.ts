import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/auth/", "/admin/", "/chat", "/friends", "/profile", "/favorites", "/recent", "/voice", "/shop", "/sign-in", "/sign-up", "/play/"] }, sitemap: SITE_URL + "/sitemap.xml" };
}
