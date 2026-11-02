import type { Game } from "@/types/game";
import { GameCard } from "./GameCard";

export function GameGrid({ games }: { games: Game[] }) {
  return (
    <div className="rg-library-grid">
      {games.map((game, i) => (
        <GameCard key={game.id} game={game} index={i} />
      ))}
    </div>
  );
}
