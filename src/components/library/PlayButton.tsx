import { Lock, Play } from "lucide-react";
import Link from "next/link";
import type { Game } from "@/types/game";

/** Angled, broadcast-style CTA — plays in-app via /play/<id>, inert otherwise. */
export function PlayButton({ game, compact = false }: { game: Game; compact?: boolean }) {
  const launchable = game.enabled && !!game.url;
  const padding = compact ? "px-3.5 py-1.5" : "px-4 py-2";

  if (launchable) {
    return (
      <Link
        href={`/play/${game.id}`}
        className={`inline-block -skew-x-6 bg-gradient-to-r from-cyan to-violet transition-transform hover:scale-[1.05] hover:-skew-x-3`}
      >
        <span className={`flex skew-x-6 items-center gap-1.5 ${padding} font-display text-xs font-bold uppercase tracking-wider text-void`}>
          <Play className="h-3 w-3" strokeWidth={2.5} fill="currentColor" />
          Jouer
        </span>
      </Link>
    );
  }

  return (
    <button
      type="button"
      disabled
      aria-disabled="true"
      tabIndex={-1}
      title="Ce jeu n'est pas encore disponible"
      className={`inline-block -skew-x-6 cursor-not-allowed bg-surface-raised`}
    >
      <span className={`flex skew-x-6 items-center gap-1.5 ${padding} font-display text-xs font-bold uppercase tracking-wider text-text-faint`}>
        <Lock className="h-3 w-3" strokeWidth={2.5} />
        Jouer
      </span>
    </button>
  );
}
