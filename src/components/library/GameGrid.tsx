import type { Game } from "@/types/game";
import { GameCard } from "./GameCard";

export function GameGrid({ games }: { games: Game[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {games.map((game, i) => (
        <GameCard key={game.id} game={game} index={i} />
      ))}
    </div>
  );
}
