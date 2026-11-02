"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, MOBILE_NAV_IDS } from "@/data/nav";
import { useSocial } from "@/components/social/SocialProvider";
export function BottomNav() {
  const pathname = usePathname();
  const { dmUnread, unreadCount } = useSocial();
  const messages = [...dmUnread.values()].reduce((sum, count) => sum + count, 0);
  const community = unreadCount;
  return <nav aria-label="Navigation principale" className="rg-bottom-nav" style={{ height: "var(--rg-bottom-nav-h)", paddingBottom: "var(--rg-safe-bottom)" }}>
    {MOBILE_NAV_IDS.map(id => {
      const item = NAV_ITEMS.find(item => item.id === id)!;
      const active = id === "home" ? pathname === "/" : id === "community" ? ["/community","/voice","/friends","/chat"].some(route => pathname.startsWith(route)) : pathname.startsWith(item.href);
      const count = id === "messages" ? messages : id === "community" ? community : 0;
      const Icon = item.icon;
      return <Link key={id} href={item.href} aria-current={active ? "page" : undefined} className={active ? "is-active" : ""}>
        <span className="rg-nav-icon"><Icon strokeWidth={active ? 2.5 : 1.8} className="h-5 w-5" />{count > 0 && <span className="rg-count" aria-label={`${count} non lus`}>{count > 99 ? "99+" : count}</span>}</span>
        <span>{id === "library" ? "Jeux" : item.label}</span>
      </Link>;
    })}
  </nav>;
}
