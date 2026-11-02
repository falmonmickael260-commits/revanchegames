import { Lock, Play } from "lucide-react";
import Link from "next/link";
import type { Game } from "@/types/game";
export function PlayButton({game,compact=false}:{game:Game;compact?:boolean}) {
  const content=<><Play className="h-3.5 w-3.5" fill="currentColor" />Jouer</>;
  return game.enabled&&game.url?<Link href={`/play/${game.id}`} className={`rg-play-button ${compact?"is-compact":""}`} aria-label={`Jouer à ${game.name}`}>{content}</Link>:<button type="button" disabled className="rg-play-button" title="Ce jeu n’est pas encore disponible"><Lock className="h-3.5 w-3.5" />Bientôt</button>;
}
