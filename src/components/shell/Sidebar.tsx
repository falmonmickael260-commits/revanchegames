"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Logo } from "@/components/ui/Logo";
import { NAV_ITEMS } from "@/data/nav";
import { GAMES } from "@/data/games";

export function Sidebar() {
  const pathname = usePathname();
  const availableCount = GAMES.filter((g) => g.enabled).length;

  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-border-soft bg-abyss/60 px-4 py-6 lg:flex">
      <div className="px-2 pb-8">
        <Logo />
      </div>

      <nav className="flex flex-1 flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.id}
              href={item.href}
              className="group relative flex items-center gap-3 rounded-xl px-3 py-2.5 font-body text-sm transition-colors"
            >
              {active && (
                <motion.span
                  layoutId="rg-sidebar-active"
                  className="absolute inset-0 overflow-hidden rounded-xl border border-border bg-surface-raised"
                  transition={{ type: "spring", stiffness: 420, damping: 36 }}
                >
                  <span className="absolute inset-y-0 left-0 w-[3px] bg-gradient-to-b from-cyan to-violet" />
                </motion.span>
              )}
              <Icon
                className={`relative z-10 h-[18px] w-[18px] transition-colors ${
                  active ? "text-cyan" : "text-text-faint group-hover:text-text-dim"
                }`}
                strokeWidth={2}
              />
              <span
                className={`relative z-10 transition-colors ${
                  active ? "text-text" : "text-text-dim group-hover:text-text"
                }`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="rounded-xl border border-border-soft bg-surface/60 px-3 py-3 font-body text-xs text-text-faint">
        <p className="mb-1 font-display text-[11px] uppercase tracking-[0.2em] text-text-dim">
          Statut
        </p>
        {GAMES.length} jeux au catalogue · {availableCount} disponibles
      </div>
    </aside>
  );
}
