import type { Game } from "@/types/game";
import { GameArt } from "./GameArt";
import { StatusBadge } from "./StatusBadge";
import { PlayButton } from "./PlayButton";

export function FeaturedCarousel({ games }: { games: Game[] }) {
  return (
    <div className="rg-rail rg-rail-snap -mx-4 gap-4 px-4 pb-1 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      {games.map((game) => (
        <div
          key={game.id}
          className="rg-snap-item relative w-[86%] shrink-0 overflow-hidden rounded-2xl border-2 border-border-soft sm:w-[64%] lg:w-[44%] xl:w-[32%]"
          style={{ borderColor: `${game.theme.accent}40` }}
        >
          <div className="relative aspect-[16/10] w-full">
            <div className="absolute inset-0">
              <GameArt game={game} className="h-full w-full" />
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-void/90 via-void/10 to-transparent" />

            <div className="absolute inset-x-4 bottom-4 flex items-end justify-between gap-3">
              <div className="flex flex-col gap-1.5">
                <StatusBadge status={game.status} />
                <p className="font-display text-lg font-bold tracking-wide text-text drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]">
                  {game.name}
                </p>
              </div>

              <PlayButton game={game} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
