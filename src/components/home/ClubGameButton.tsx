"use client";
import Link from "next/link";
import { GameArt } from "@/components/library/GameArt";
import { Heart, Info, Play } from "lucide-react";
import { useFavorites } from "@/lib/use-favorites";
import type { Game } from "@/types/game";
import type { CSSProperties } from "react";
const palettes:Record<string,string[]>={"la-meute":["#d9c6ff","#977acb"],"bombshift":["#b8cbff","#7294de"],"kilomax":["#ffcbb2","#f08c76"],"camouflip":["#c8f2bf","#81bc82"],"quiz-master":["#ffe6a3","#e8b957"],"president":["#f8c7ed","#ca8bd1"],"fortune-empire":["#c8eed2","#81bd9e"],"10000":["#e5cfff","#b493e7"],"loto":["#ffe5bc","#e5aa66"],"neon-hockey":["#baeef5","#70c0da"],"bacrush":["#f2d5ff","#c59ce6"],"dominorush":["#baf1dd","#7bc4af"],"devine":["#ffd0e2","#e99cb8"],"tabou":["#ffd4c6","#e8a08e"],"top-famille":["#ffe9b0","#eac477"],"rami":["#d9d4ff","#aaa0e2"],"qui-va-tomber":["#e6d5ff","#b49bdc"],"worms":["#ffc9df","#dd95b5"],"le-mytho":["#ffe0ad","#dda96d"],"la-bonne-paye":["#c7efd3","#83bc98"]};
export function ClubGameButton({game,onInfo}:{game:Game;onInfo?:()=>void}){
 const {isFavorite,toggleFavorite}=useFavorites();
 const [top,bottom]=palettes[game.id]??["#e9dcff","#bfa9e1"];
 const active=isFavorite(game.id);
 return <article className="rg-club-game" style={{"--tile-top":top,"--tile-bottom":bottom} as CSSProperties}>
   {game.enabled?<Link className="rg-club-game-main" href={`/play/${game.id}`} aria-label={`Jouer à ${game.name}`}>{palettes[game.id]?<img src={`/images/club/${game.id}.svg`} alt="" loading="lazy"/>:<GameArt game={game} className="rg-club-fallback-art"/>}<div><h3>{game.name}</h3><span>{game.players}</span></div><i><Play fill="currentColor"/></i></Link>:<div className="rg-club-game-main is-upcoming">{palettes[game.id]?<img src={`/images/club/${game.id}.svg`} alt="" loading="lazy"/>:<GameArt game={game} className="rg-club-fallback-art"/>}<div><h3>{game.name}</h3><span>{game.status==="coming-soon"?"Bientôt":"En création"}</span></div></div>}
   {game.newBadge&&<span className="rg-club-new">NEW</span>}
   <button type="button" className="rg-club-favorite" aria-label={`${active?"Retirer des":"Ajouter aux"} favoris : ${game.name}`} aria-pressed={active} onClick={()=>toggleFavorite(game.id)}><Heart fill={active?"currentColor":"none"}/></button>
   {onInfo&&<button type="button" className="rg-club-info" onClick={onInfo} aria-label={`À propos de ${game.name}`}><Info/></button>}
 </article>
}