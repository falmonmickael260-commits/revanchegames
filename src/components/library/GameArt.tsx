import Image from "next/image";
import type { Game } from "@/types/game";
import { GAME_ICON_MAP } from "@/lib/game-icon-map";

/** Selected covers use decorative art with the exact game name rendered as live text. */
export function GameArt({ game, className = "", eager = false }: { game: Game; className?: string; eager?: boolean }) {
  const isAnimated = game.image?.endsWith("-animated.webp") ?? false;
  const hasCustomCover = isAnimated || (game.image?.endsWith("-cover.webp") ?? false) || (game.image?.endsWith("-motion-bg.webp") ?? false);
  const motionSprite = game.id === "10000"
    ? { src: "/games/10000-die-sprite.webp", width: 480, height: 439, className: "rg-game-motion-die" }
    : game.id === "bombshift"
      ? { src: "/games/bombshift-robot-sprite.webp", width: 480, height: 436, className: "rg-game-motion-robot" }
      : game.id === "quiz-master"
        ? { src: "/games/quiz-master-question-sprite.webp", width: 480, height: 600, className: "rg-game-motion-question" }
        : null;
  if (game.image) {
    return (
      <div className={`rg-game-art relative overflow-hidden ${className}`}>
        <Image
          src={game.image}
          alt=""
          unoptimized={isAnimated}
          loading={eager ? "eager" : "lazy"}
          fill
          sizes="(min-width: 1536px) 25vw, (min-width: 1280px) 33vw, (min-width: 640px) 50vw, 100vw"
          className="object-cover"
        />
        {game.id === "camouflip" && <Image src="/games/camouflip-logo.png" alt="" aria-hidden="true" width={1254} height={1254} className="rg-camouflip-cover-logo" />}
        {motionSprite && <Image
          src={motionSprite.src}
          alt=""
          aria-hidden="true"
          width={motionSprite.width}
          height={motionSprite.height}
          className={`rg-game-motion-sprite ${motionSprite.className}`}
        />}
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
