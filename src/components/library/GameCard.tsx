"use client";
import Link from "next/link";
import { Users, Gamepad2 } from "lucide-react";
import type { Game } from "@/types/game";
import { GameArt } from "./GameArt";
import { FavoriteButton } from "./FavoriteButton";
import { PlayButton } from "./PlayButton";
import { useFavorites } from "@/lib/use-favorites";
export function GameCard({ game }: { game: Game; index?: number }) {
  const { isFavorite, toggleFavorite } = useFavorites();
  const art=<GameArt game={game} className="aspect-[4/3] w-full" />;
  return <article className={`rg-library-card ${game.enabled?"":"is-upcoming"}`}>
    <div className="relative">{game.enabled?<Link href={`/play/${game.id}`} aria-label={`Jouer à ${game.name}`}>{art}</Link>:art}<span className="rg-game-status">{game.enabled?"Disponible":game.status==="coming-soon"?"Bientôt":"En création"}</span>{game.newBadge && <span className="rg-new-badge" aria-label="Nouveau jeu">NEW</span>}<div className="absolute right-2 top-2"><FavoriteButton active={isFavorite(game.id)} onToggle={()=>toggleFavorite(game.id)} label={game.name} /></div></div>
    <div className="rg-library-card-body"><h3>{game.name}</h3><p className="rg-game-tagline">{game.tagline}</p><p className="rg-game-mode"><Users className="h-3.5 w-3.5" />{game.players}<span>{game.supportsRooms===false?"Solo":"Multijoueur"}</span></p><details className="rg-game-details"><summary>À propos du jeu</summary><p>{game.description}</p></details><div className="rg-game-card-action"><Gamepad2 className="h-4 w-4 text-text-faint" /><PlayButton game={game} /></div></div>
  </article>;
}
