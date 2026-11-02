import Link from "next/link";
import { ArrowUpRight, Play } from "lucide-react";
import { GameArt } from "@/components/library/GameArt";
import type { Game } from "@/types/game";
export function GameTile({ game, large = false }: { game: Game; large?: boolean }) {
  return <Link href={`/play/${game.id}`} className={`rg-game-tile ${large ? "rg-game-tile-large" : ""}`} aria-label={`Jouer à ${game.name}`}>
    <div className="rg-tile-image"><GameArt game={game} className="h-full w-full" /><span className="rg-tile-play"><Play className="h-4 w-4" fill="currentColor" /></span></div>
    <div className="rg-tile-info"><div className="min-w-0"><h3>{game.name}</h3><p>{game.players}</p></div><ArrowUpRight className="h-4 w-4 shrink-0 text-text-faint" /></div>
  </Link>;
}
