"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, MOBILE_NAV_IDS } from "@/data/nav";

export function BottomNav() {
  const pathname = usePathname();
  const items = NAV_ITEMS.filter((item) => MOBILE_NAV_IDS.includes(item.id));

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border-soft bg-abyss/90 backdrop-blur-lg lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="flex items-stretch justify-around">
        {items.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <li key={item.id} className="flex-1">
              <Link
                href={item.href}
                className="flex min-h-[56px] flex-col items-center justify-center gap-1 px-2 py-2"
              >
                <Icon
                  className={`h-5 w-5 ${active ? "text-cyan" : "text-text-faint"}`}
                  strokeWidth={2}
                  fill={active ? "var(--rg-cyan)" : "none"}
                  fillOpacity={active ? 0.15 : 0}
                />
                <span
                  className={`font-body text-[10px] leading-none ${
                    active ? "text-text" : "text-text-faint"
                  }`}
                >
                  {item.label === "Tous les jeux" ? "Jeux" : item.label === "Mes favoris" ? "Favoris" : item.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
