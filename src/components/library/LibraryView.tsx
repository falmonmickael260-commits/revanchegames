"use client";
import { Suspense } from "react";
import { useRouter,useSearchParams } from "next/navigation";
import { Search, SearchX } from "lucide-react";
import { GAMES } from "@/data/games";
import { PageHeader } from "@/components/ui/PageHeader";
import { CategoryFilter } from "./CategoryFilter";
import { GameGrid } from "./GameGrid";
import { EmptyState } from "./EmptyState";
function searchable(value:string) { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase(); }
function LibraryContent() {
  const params=useSearchParams(),router=useRouter();
  const query=(params.get("q")??"").trim(),category=params.get("category"),availability=params.get("availability")??"all";
  const filtered=GAMES.filter(game=>(!query||searchable(`${game.name} ${game.description}`).includes(searchable(query)))&&(!category||game.categories.some(value=>value===category))&&(availability==="all"||(availability==="playable"?game.enabled:!game.enabled))).sort((a,b)=>Number(b.enabled)-Number(a.enabled));
  const filter=(value:string)=>{const next=new URLSearchParams(params.toString());if(value==="all")next.delete("availability");else next.set("availability",value);router.push(`/library?${next}`);};
  return <div className="rg-page rg-library-page"><PageHeader eyebrow="À toi de choisir" title="Trouve ton prochain jeu." subtitle={`${GAMES.filter(game=>game.enabled).length} jeux disponibles, et d’autres aventures en préparation.`} />
    <form action="/library" method="get" className="rg-search-field" onSubmit={event=>{event.preventDefault();const next=new URLSearchParams(params.toString());const value=new FormData(event.currentTarget).get("q") as string;if(value.trim())next.set("q",value.trim());else next.delete("q");router.push(`/library?${next}`);}}><Search className="h-4 w-4" /><input key={query} name="q" aria-label="Rechercher un jeu" placeholder="Quel jeu te tente ?" defaultValue={query} /><button type="submit" className="rg-icon-button" aria-label="Lancer la recherche"><Search className="h-4 w-4" /></button></form>
    <div className="rg-social-tabs">{[["all","Tous"],["playable","Jouer maintenant"],["upcoming","À venir"]].map(([value,label])=><button key={value} type="button" aria-pressed={availability===value} onClick={()=>filter(value)}>{label}</button>)}</div>
    <CategoryFilter />
    <div className="rg-library-results"><p>{filtered.length} jeu{filtered.length>1?"x":""}{query?` pour « ${query} »`:""}</p>{query&&<button type="button" onClick={()=>router.push("/library")}>Effacer la recherche</button>}</div>
    {filtered.length?<GameGrid games={filtered} />:<EmptyState icon={SearchX} title="Pas de jeu trouvé" message="Essaie un autre nom ou une autre catégorie." />}
  </div>;
}
export function LibraryView(){return <Suspense fallback={<div className="rg-page"><div className="rg-skeleton h-60" /></div>}><LibraryContent /></Suspense>;}
