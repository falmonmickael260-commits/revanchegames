import Link from "next/link";
import { Zap } from "lucide-react";

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      href="/"
      className="group flex items-center gap-2 font-display tracking-[0.12em]"
      aria-label="Revanche Games — Accueil"
    >
      <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border-soft bg-surface">
        <Zap
          className="h-[18px] w-[18px] text-cyan transition-transform duration-300 group-hover:scale-110"
          strokeWidth={2.5}
          fill="var(--rg-cyan)"
        />
      </span>
      {!compact && (
        <span className="flex items-baseline gap-1.5 text-sm font-semibold sm:text-base">
          <span className="text-text">REVANCHE</span>
          <span className="rg-glow-text">GAMES</span>
        </span>
      )}
    </Link>
  );
}
