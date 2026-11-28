"use client";
import Link from "next/link";
import {useEffect,useRef,useState} from "react";
import {useRouter} from "next/navigation";
import {Zap,Radio,Search,Users,ArrowRight,Plus,LoaderCircle,ShieldCheck} from "lucide-react";
import {GAMES} from "@/data/games";
import {PUBLIC_ROOM_GAMES} from "@/lib/game-connector/protocol";
import {matchingRooms} from "@/lib/game-connector/match-selection";
import type {PublicGameRoom} from "@/lib/game-connector/public-rooms";
import {useSocial} from "@/components/social/SocialProvider";
import {useGameSession} from "@/components/game/GameSessionProvider";
import {GameArt} from "@/components/library/GameArt";
type Mode="quick"|"match";
type Phase="idle"|"searching"|"joining"|"empty"|"error";
const games=GAMES.filter(g=>g.enabled&&g.url&&(PUBLIC_ROOM_GAMES as readonly string[]).includes(g.id));
const allowed=games.map(g=>g.id);
const preview=process.env.NEXT_PUBLIC_RG_VISUAL_PREVIEW==="1";
export function QuickMatchPanel({mode,onBack}:{mode:Mode;onBack:()=>void}){
 const router=useRouter(),{me,ready}=useSocial(),{active}=useGameSession();
 const [slug,setSlug]=useState("any"),[phase,setPhase]=useState<Phase>("idle"),[message,setMessage]=useState(""),[elapsed,setElapsed]=useState(0);
 const run=useRef<{cancelled:boolean;joining:boolean;request?:AbortController;timer?:ReturnType<typeof setTimeout>}|null>(null);
 const mounted=useRef(true);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;const task=run.current;if(task){task.cancelled=true;task.request?.abort();clearTimeout(task.timer)}}},[]);
 const cancel=()=>{const task=run.current;if(task?.joining)return;if(task){task.cancelled=true;task.request?.abort();clearTimeout(task.timer);run.current=null}setPhase("idle");setElapsed(0);setMessage("")};
 const start=()=>{
  if(run.current||!ready||active)return;
  if(preview){setPhase("error");setMessage("Aperçu graphique : les connexions aux parties réelles sont désactivées.");return}
  if(!me){router.push("/sign-in?next="+encodeURIComponent(mode==="quick"?"/#partie-rapide":"/#matchmaking"));return}
  const task:{cancelled:boolean;joining:boolean;request?:AbortController;timer?:ReturnType<typeof setTimeout>}={cancelled:false,joining:false};run.current=task;
  setPhase("searching");setMessage("");setElapsed(0);const started=Date.now();
  const valid=()=>mounted.current&&!task.cancelled&&run.current===task;
  const finish=(state:Phase,msg:string)=>{if(!valid())return;run.current=null;setPhase(state);setMessage(msg)};
  const retry=()=>{if(!valid())return;task.joining=false;setPhase("searching");if(mode==="quick"){finish("empty","Aucun salon disponible pour l’instant.");return}if(Date.now()-started>=90000){finish("empty","Aucun salon trouvé après 90 secondes.");return}task.timer=setTimeout(()=>void scan(),3000)};
  const scan=async()=>{
   if(!valid())return;
   if(Date.now()-started>=90000){finish("empty","Aucun salon trouvé après 90 secondes.");return}
   if(document.hidden&&mode==="match"){task.timer=setTimeout(()=>void scan(),3000);return}
   setElapsed(Math.floor((Date.now()-started)/1000));
   task.request=new AbortController();
   const timeout=setTimeout(()=>task.request?.abort(),8000);
   let rooms:PublicGameRoom[];
   try{const response=await fetch("/api/game/rooms/public",{cache:"no-store",signal:task.request.signal});if(!response.ok)throw Error("La liste des salons est momentanément indisponible.");const body=await response.json();if(!Array.isArray(body))throw Error("Réponse des salons invalide.");rooms=body;}catch(e){if(valid())finish("error",e instanceof Error&&e.name!=="AbortError"?e.message:"Le serveur ne répond pas. Réessaie.");return}finally{clearTimeout(timeout)}
   if(!valid())return;
   const candidate=matchingRooms(rooms,slug,allowed)[0];
   if(!candidate){retry();return}
   task.joining=true;setPhase("joining");
   try{
    // Do not abort admission: a successful POST may already have reserved a seat.
    const response=await fetch("/api/game/rooms/public",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:candidate.id})});
    if(response.status===401){if(valid()){run.current=null;router.push("/sign-in?next="+encodeURIComponent("/#matchmaking"))}return}
    const result=await response.json();
    if(!valid())return;
    if(response.status===409){retry();return}
    if(!response.ok)throw Error(result.error||"Connexion impossible.");
    if(result.game_slug!==candidate.game_slug)throw Error("Réponse de connexion inattendue.");
    run.current=null;router.push(`/play/${candidate.game_slug}?salon=${candidate.id}`);
   }catch(e){finish("error",e instanceof Error?e.message:"Connexion impossible.")}
  };
  void scan();
 };
 const busy=phase==="searching"||phase==="joining";
 const selected=games.find(g=>g.id===slug);
 return <section className="rg-match-panel" aria-label={mode==="quick"?"Partie rapide":"Matchmaking"}>
  <button type="button" className="rg-match-back" disabled={phase==="joining"} onClick={()=>{cancel();onBack()}}>‹ Retour au hall</button>
  <div className={`rg-match-stage ${mode==="match"?"is-match":""}`}><div className="rg-match-orbit" aria-hidden="true">{mode==="quick"?<Zap fill="currentColor"/>:<Radio/>}</div><span className="rg-match-eyebrow">REVANCHE · MULTIJOUEUR</span><h2>{mode==="quick"?"Partie rapide":"Matchmaking"}</h2><p>{mode==="quick"?"Rejoins immédiatement un salon ouvert.":"Recherche automatiquement une place dans un salon public compatible."}</p></div>
  <div className="rg-match-select"><h3>Choisis ton jeu</h3><button type="button" disabled={busy} className="rg-match-any" aria-pressed={slug==="any"} onClick={()=>setSlug("any")}><Zap/> Tous les jeux compatibles</button><div className="rg-match-games">{games.map(game=><button type="button" disabled={busy} key={game.id} aria-pressed={slug===game.id} onClick={()=>setSlug(game.id)}><GameArt game={game} className="rg-match-game-art"/><span>{game.name}</span></button>)}</div></div>
  {active?<div className="rg-match-status"><strong>Une partie est déjà ouverte.</strong><p>Reprends-la ou quitte-la avant de rechercher une autre partie.</p><Link href={`/play/${active.slug}`}>Reprendre ma partie <ArrowRight/></Link></div>:<div className="rg-match-status" aria-live="polite">
   {busy?<><div className="rg-match-searching"><LoaderCircle className="rg-match-spinner"/><strong>{phase==="joining"?"Connexion au salon…":"Recherche de joueurs…"}</strong></div><p>{phase==="searching"?`${elapsed} s · Recherche dans les salons publics`:"Vérification de la place par le serveur."}</p>{phase==="searching"&&<button type="button" className="rg-match-cancel" onClick={cancel}>Annuler</button>}</>:<><button type="button" className="rg-match-start" disabled={!ready||games.length===0} onClick={start}><Search/> {phase==="empty"||phase==="error"?"Réessayer":mode==="quick"?"Trouver une partie":"Lancer la recherche"}</button>{message&&<p role="status">{message}</p>}{phase==="empty"&&selected&&<Link className="rg-match-create" href={`/play/${selected.id}?public=1`}><Plus/> Créer un salon dans {selected.name}</Link>}{phase==="empty"&&!selected&&<button type="button" className="rg-match-cancel" onClick={onBack}>Retour pour créer un salon</button>}</>}
   <small><ShieldCheck/> Places réellement disponibles · Aucun faux joueur</small>
  </div>}
  {preview&&<p className="rg-match-preview-note">Mode aperçu : aucun compte ni salon de production connecté.</p>}
 </section>
}
