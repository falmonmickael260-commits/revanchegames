import Image from "next/image";
import type { Game } from "@/types/game";
import { GAME_ICON_MAP } from "@/lib/game-icon-map";

/** Selected covers use decorative art with the exact game name rendered as live text. */
export function GameArt({ game, className = "", eager = false }: { game: Game; className?: string; eager?: boolean }) {
  const hasCustomCover = game.image?.endsWith("-cover.webp") ?? false;
  if (game.image) {
    return (
      <div className={`relative overflow-hidden ${className}`}>
        <Image
          src={game.image}
          alt=""
          loading={eager ? "eager" : "lazy"}
          fill
          sizes="(min-width: 1536px) 25vw, (min-width: 1280px) 33vw, (min-width: 640px) 50vw, 100vw"
          className="object-cover"
        />
        {hasCustomCover && <><div className="rg-game-art-vignette" aria-hidden="true" /><span className="rg-game-art-title" aria-hidden="true" style={{ borderColor: `${game.theme.accent}b8`, boxShadow: `0 0 24px ${game.theme.accent}45` }}>{game.name}</span></>}
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

    </div>
  );
}
