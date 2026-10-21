import type { Game } from "@/types/game";
import { GameCard } from "./GameCard";

/** A horizontally scrolling row of games — browsing by swipe, not by wrapping. */
export function Shelf({ games }: { games: Game[] }) {
  return (
    <div className="rg-rail rg-rail-snap -mx-4 gap-4 px-4 pb-1 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      {games.map((game, i) => (
        <div
          key={game.id}
          className="rg-snap-item w-[78%] shrink-0 sm:w-[46%] lg:w-[30%] xl:w-[23%]"
        >
          <GameCard game={game} index={i} />
        </div>
      ))}
    </div>
  );
}
