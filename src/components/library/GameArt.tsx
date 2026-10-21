import Image from "next/image";
import type { Game } from "@/types/game";
import { GAME_ICON_MAP } from "@/lib/game-icon-map";

/**
 * Card illustration: the game's real cover art when one is set in games.ts,
 * otherwise a generated placeholder built from its accent theme + motif icon.
 * Decorative only (alt="") — the game name is already announced by the
 * heading that follows it in GameCard.
 */
export function GameArt({ game, className = "" }: { game: Game; className?: string }) {
  if (game.image) {
    return (
      <div className={`relative overflow-hidden ${className}`}>
        <Image
          src={game.image}
          alt=""
          fill
          sizes="(min-width: 1536px) 25vw, (min-width: 1280px) 33vw, (min-width: 640px) 50vw, 100vw"
          className="object-cover"
        />
        <div
          className="absolute inset-x-0 bottom-0 h-10"
          style={{ background: "linear-gradient(to top, var(--rg-surface), transparent)" }}
        />
      </div>
    );
  }

  return <GeneratedArt game={game} className={className} />;
}

/** Provisional illustration for games that don't have cover art yet. */
function GeneratedArt({ game, className }: { game: Game; className: string }) {
  const Icon = GAME_ICON_MAP[game.icon];
  const { accent, accentSoft } = game.theme;

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{ background: "linear-gradient(160deg, var(--rg-surface) 0%, var(--rg-abyss) 100%)" }}
    >
      <div
        className="absolute inset-0"
        style={{ background: `linear-gradient(155deg, ${accent}2e 0%, transparent 60%)` }}
      />

      <div
        className="absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
        style={{ background: accent, opacity: 0.3 }}
      />
      <div
        className="absolute -right-10 -top-10 h-28 w-28 rounded-full blur-2xl"
        style={{ background: accentSoft, opacity: 0.22 }}
      />

      <div
        className="absolute inset-0 opacity-[0.07] mix-blend-overlay"
        style={{
          backgroundImage: `repeating-linear-gradient(115deg, ${accent} 0px, ${accent} 1.5px, transparent 1.5px, transparent 20px)`,
        }}
      />

      <Icon
        className="absolute bottom-3 right-3 h-20 w-20 -rotate-6 opacity-[0.14]"
        style={{ color: accentSoft }}
        strokeWidth={1.3}
      />
      <Icon
        className="absolute left-1/2 top-1/2 h-9 w-9 -translate-x-1/2 -translate-y-1/2"
        style={{ color: accentSoft, filter: `drop-shadow(0 0 14px ${accent}cc)` }}
        strokeWidth={1.8}
      />

      <div
        className="absolute inset-x-0 bottom-0 h-10"
        style={{ background: "linear-gradient(to top, var(--rg-surface), transparent)" }}
      />
    </div>
  );
}
