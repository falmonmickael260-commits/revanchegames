"use client";
import { Suspense } from "react";
import { useEffect, useRef } from "react";
import { useRouter,useSearchParams } from "next/navigation";
import { Search, SearchX } from "lucide-react";
import { GAMES } from "@/data/games";
import { PageHeader } from "@/components/ui/PageHeader";
import { CategoryFilter } from "./CategoryFilter";
import { GameGrid } from "./GameGrid";
import { EmptyState } from "./EmptyState";
import { useFavorites } from "@/lib/use-favorites";
function searchable(value:string) { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase(); }
function LibraryContent() {
  const params=useSearchParams(),router=useRouter();
  const searchRef=useRef<HTMLInputElement>(null);
  const { favorites } = useFavorites();
  const query=(params.get("q")??"").trim(),category=params.get("category"),availability=params.get("availability")??"all",mode=params.get("mode")??"all";
  const focusSearch=params.get("search")==="1";
  useEffect(()=>{if(focusSearch){searchRef.current?.focus();searchRef.current?.scrollIntoView({block:"center",behavior:"smooth"});}},[focusSearch]);
  const filtered=GAMES.filter(game=>(!query||searchable(`${game.name} ${game.description}`).includes(searchable(query)))&&(!category||game.categories.some(value=>value===category))&&(availability==="all"||(availability==="playable"?game.enabled:!game.enabled))&&(mode==="all"||(mode==="multiplayer"&&game.enabled&&game.supportsRooms!==false)||(mode==="solo"&&game.supportsRooms===false)||(mode==="favorites"&&favorites.includes(game.id)))).sort((a,b)=>Number(b.enabled)-Number(a.enabled));
  const filter=(key:string,value:string)=>{const next=new URLSearchParams(params.toString());if(value==="all")next.delete(key);else next.set(key,value);router.push(`/library?${next}`);};
  return <div className="rg-page rg-library-page"><PageHeader eyebrow="À toi de choisir" title="Trouve ton prochain jeu." subtitle={`${GAMES.filter(game=>game.enabled).length} jeux disponibles, et d’autres aventures en préparation.`} />
    <form id="rg-game-search" action="/library" method="get" className="rg-search-field" onSubmit={event=>{event.preventDefault();const next=new URLSearchParams(params.toString());const value=new FormData(event.currentTarget).get("q") as string;if(value.trim())next.set("q",value.trim());else next.delete("q");router.push(`/library?${next}`);}}><Search className="h-4 w-4" /><input ref={searchRef} key={query} name="q" aria-label="Rechercher un jeu" placeholder="Rechercher un jeu…" defaultValue={query} /><button type="submit" className="rg-icon-button" aria-label="Lancer la recherche"><Search className="h-4 w-4" /></button></form>
    <div className="rg-library-modes" role="group" aria-label="Filtrer les jeux">{[["all","Tous"],["multiplayer","Multijoueur"],["solo","Solo"],["favorites","Mes favoris"]].map(([value,label])=><button key={value} type="button" aria-pressed={mode===value} onClick={()=>filter("mode",value)}>{label}</button>)}</div>
    <CategoryFilter />
    <div className="rg-library-availability" role="group" aria-label="Disponibilité des jeux">{[["all","Tout le catalogue"],["playable","Disponibles"],["upcoming","À venir"]].map(([value,label])=><button key={value} type="button" aria-pressed={availability===value} onClick={()=>filter("availability",value)}>{label}</button>)}</div>
    <div className="rg-library-results"><p>{filtered.length} jeu{filtered.length>1?"x":""}{query?` pour « ${query} »`:""}</p>{query&&<button type="button" onClick={()=>router.push("/library")}>Effacer la recherche</button>}</div>
    {filtered.length?<GameGrid games={filtered} />:<EmptyState icon={SearchX} title="Pas de jeu trouvé" message="Essaie un autre nom ou une autre catégorie." />}
  </div>;
}
export function LibraryView(){return <Suspense fallback={<div className="rg-page"><div className="rg-skeleton h-60" /></div>}><LibraryContent /></Suspense>;}
