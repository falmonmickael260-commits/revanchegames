"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Play } from "lucide-react";
import { GAMES } from "@/data/games";

// Static artwork keeps the hub light. The catalog remains the source of truth
// for availability and the original /play routes handle all game launching.
const worlds = [
  { id: "la-meute", art: "/images/la-meute-hero-refonte.webp", chapter: "La nuit appartient aux audacieux", label: "Mystère", position: "center 42%" },
  { id: "kilomax", art: "/games/kilomax-cover.webp", chapter: "La route est à toi", label: "Course", position: "center 45%" },
  { id: "bombshift", art: "/games/bombshift-cover.webp", chapter: "Prêt pour le chaos ?", label: "Action", position: "center 46%" },
  { id: "quiz-master", art: "/games/quiz-master-cover.webp", chapter: "À toi de faire la différence", label: "Quiz", position: "center 42%" },
  { id: "president", art: "/games/president-cover.webp", chapter: "À toi de prendre le trône", label: "Cartes", position: "center 43%" },
].flatMap(world => GAMES.filter(game => game.id === world.id && game.enabled && game.url).map(game => ({ ...world, game })));

export function ArenaStage({ signedIn, onlineCount }: { signedIn: boolean; onlineCount: number }) {
  const [selected, setSelected] = useState(0);
  const world = worlds[selected] ?? worlds[0];
  return <section className="rg-world-stage" aria-label="Revanche Arena, jeux à la une">
    <div className="rg-world-cinema" aria-hidden="true">
      {world && <Image key={world.id} src={world.art} alt="" fill sizes="100vw" loading="eager" className="rg-world-backdrop" style={{ objectPosition: world.position }} />}
      <div className="rg-world-shade" />
      <div className="rg-world-horizon" />
      <div className="rg-world-embers">{Array.from({ length: 8 }, (_, i) => <i key={i} style={{ left: `${12 + i * 11}%`, bottom: `${13 + (i % 3) * 13}%`, animationDelay: `${i * -.83}s` }} />)}</div>
    </div>
    <div className="rg-world-topline"><span><i /> REVANCHE <b>ARENA</b></span><Link href="/library">Tous les univers <ArrowRight size={15} /></Link></div>
    <div className="rg-world-main">
      <div className="rg-world-copy" key={world?.id ?? "welcome"} aria-live="polite">
        <p className="rg-world-kicker">JEU À LA UNE <span /> {world?.label ?? "Découverte"}</p>
        <h2>{world?.game.name ?? "Entre dans l’arène"}</h2>
        <p className="rg-world-chapter">{world?.chapter ?? "Tes jeux, tes amis, tes défis."}</p>
        {world && <p className="rg-world-tagline">{world.game.tagline} <span>· {world.game.players}</span></p>}
        <div className="rg-world-actions">{world && <Link href={`/play/${world.game.id}`} className="rg-world-play"><Play size={18} fill="currentColor" /> Jouer maintenant</Link>}<Link className="rg-world-explore" href="/library">Explorer <ArrowRight size={15} /></Link></div>
      </div>
      <div className="rg-world-companion">
        <div className="rg-world-rev" aria-hidden="true"><div className="rg-world-platform" /><div className="rg-mascot-body" /></div>
        <div className="rg-world-message"><span>REV · TON ALLIÉ</span><p>{signedIn ? onlineCount > 0 ? `${onlineCount} ami${onlineCount === 1 ? "" : "s"} en ligne ou en partie. Prêt pour ta revanche ?` : "Prêt pour ta revanche ?" : "Bienvenue dans ton univers gaming !"}</p></div>
      </div>
    </div>
    {worlds.length > 0 && <div className="rg-world-picker" role="group" aria-label="Choisir le jeu à la une">
      {worlds.map((item, index) => <button key={item.id} type="button" onClick={() => setSelected(index)} aria-pressed={index === selected} className={index === selected ? "is-selected" : ""}>
        <span className="rg-world-thumb"><Image src={item.art} alt="" fill sizes="100px" className="object-cover" /></span><span className="rg-world-picker-copy"><small>{item.label}</small><strong>{item.game.name}</strong></span>
      </button>)}
    </div>}
  </section>;
}
