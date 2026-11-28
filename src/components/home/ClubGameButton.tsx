"use client";
import Link from "next/link";
import { GameArt } from "@/components/library/GameArt";
import { Heart, Info, Play } from "lucide-react";
import { useFavorites } from "@/lib/use-favorites";
import type { Game } from "@/types/game";
import type { CSSProperties } from "react";
export function ClubGameButton({game,onInfo}:{game:Game;onInfo?:()=>void}){
 const {isFavorite,toggleFavorite}=useFavorites();
 const active=isFavorite(game.id);
 return <article className="rg-club-game" style={{"--tile-accent":game.theme.accent} as CSSProperties}>
   {game.enabled?<Link className="rg-club-game-main" href={`/play/${game.id}`} aria-label={`Jouer à ${game.name}`}><GameArt game={game} className="rg-premium-game-art"/><div><h3>{game.name}</h3><span>{game.players}</span></div><i><Play fill="currentColor"/></i></Link>:<div className="rg-club-game-main is-upcoming"><GameArt game={game} className="rg-premium-game-art"/><div><h3>{game.name}</h3><span>{game.status==="coming-soon"?"Bientôt":"En création"}</span></div></div>}
   {game.newBadge&&<span className="rg-club-new">NEW</span>}
   <button type="button" className="rg-club-favorite" aria-label={`${active?"Retirer des":"Ajouter aux"} favoris : ${game.name}`} aria-pressed={active} onClick={()=>toggleFavorite(game.id)}><Heart fill={active?"currentColor":"none"}/></button>
   {onInfo&&<button type="button" className="rg-club-info" onClick={onInfo} aria-label={`À propos de ${game.name}`}><Info/></button>}
 </article>
}