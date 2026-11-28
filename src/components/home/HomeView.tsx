"use client";
import Link from "next/link";
import { GameArt } from "@/components/library/GameArt";
import { ArrowRight, Play, Gamepad2, ChevronLeft, ChevronRight, Trophy, Headphones, MessageCircle, Sparkles, Users, ShoppingBag, Heart } from "lucide-react";
import { useState, useEffect, type ReactNode, type CSSProperties } from "react";
import { GAMES } from "@/data/games";
import { Avatar } from "@/components/ui/Avatar";
import { useSocial } from "@/components/social/SocialProvider";
import { InviteFriendDialog } from "@/components/social/InviteFriendDialog";
import type { FriendEntry } from "@/lib/social/types";
import { useRecentGames } from "@/lib/use-recent-games";
import { useFavorites } from "@/lib/use-favorites";
import { GameTile } from "./GameTile";
import { PublicGameRooms } from "./PublicGameRooms";
import { WalletPill } from "@/components/shell/WalletPill";
import { LevelBadge, type PlayerProgress } from "@/components/stats/LevelBadge";
const available = GAMES.filter(game => game.enabled && game.url);
export function HomeSection({ title, href, children, detail }: { title: string; href?: string; children: ReactNode; detail?: string }) {
  return <section className="rg-home-section"><div className="rg-section-heading"><div><h2>{title}</h2>{detail && <p>{detail}</p>}</div>{href && <Link href={href} aria-label={`Tout voir : ${title}`}>Tout voir <ArrowRight className="h-3.5 w-3.5" /></Link>}</div>{children}</section>;
}
export function HomeView({ popularIds, newIds, progress }: { popularIds: string[]; newIds: string[]; progress: PlayerProgress | null }) {
  const { me, ready, friends } = useSocial();
  const recent = useRecentGames(me?.id);
  const { favorites } = useFavorites();
  const [inviting, setInviting] = useState<FriendEntry | null>(null);
  const online = friends.filter(friend => friend.presence === "online" || friend.presence === "in_game");
  const selection = [...new Set([...recent.map(game => game.id), ...favorites])].flatMap(id => available.filter(game => game.id === id)).slice(0, 4);
  const popular = popularIds.flatMap(id => available.filter(game => game.id === id));
  const newGames = newIds.flatMap(id => available.filter(game => game.id === id));

  const [zone,setZone]=useState<"play"|"rooms"|"social"|"collection">("play");
  const featured=[...new Set(["la-meute","bombshift","kilomax","camouflip","quiz-master","president",...popularIds])].flatMap(id=>available.filter(game=>game.id===id)).slice(0,8);
  const [chosen,setChosen]=useState(0);
  const game=featured[chosen]??featured[0]??available[0];
  useEffect(()=>{const onHash=()=>{if(window.location.hash==="#salons")setZone("rooms")};onHash();window.addEventListener("hashchange",onHash);return()=>window.removeEventListener("hashchange",onHash)},[]);
  const change=(delta:number)=>setChosen(value=>(value+delta+featured.length)%Math.max(1,featured.length));
  return <div className="rg-launcher-home">
    <h1 className="rg-visually-hidden">Revanche Games – Jeux multijoueurs en ligne entre amis</h1>
    <div className="rg-launcher-hud"><div className="rg-launcher-brand"><span className="rg-launcher-mark">R</span><div><strong>REVANCHE</strong><small>LE CLUB DE JEU</small></div></div><div className="rg-launcher-account">{me && <div className="rg-home-player"><Link href="/profile" className="rg-home-player-profile"><span className="rg-home-avatar"><Avatar username={me.username} avatarUrl={me.avatarUrl} size="md" /></span><span className="rg-home-player-info"><strong>{me.username}</strong>{progress ? <><LevelBadge progress={progress} compact /><span className="rg-home-xp"><span style={{ width: `${progress.xpForLevel ? Math.max(0,Math.min(100,progress.xpIntoLevel/progress.xpForLevel*100)) : 0}%` }} /></span><small>{progress.xp.toLocaleString("fr-FR")} XP</small></> : <small>Mon espace joueur</small>}</span></Link><WalletPill /></div>}
    {ready && !me && <div className="rg-auth-strip"><p>Un compte pour jouer et retrouver tes amis.</p><div><Link href="/sign-in" className="rg-text-link">Connexion</Link><Link href="/sign-up" className="rg-primary-button">S’inscrire</Link></div></div>}</div></div>
    <nav className="rg-launcher-tabs" aria-label="Espaces du hall">
      {([{id:"play",name:"Jouer",Icon:Gamepad2},{id:"rooms",name:"Parties publiques",Icon:Users},{id:"social",name:"Club social",Icon:Headphones},{id:"collection",name:"Ma collection",Icon:Heart}] as const).map(({id,name,Icon})=><button key={id} type="button" aria-pressed={zone===id} onClick={()=>setZone(id)}><Icon/><span>{name}</span></button>)}
    </nav>
    <div className="rg-launcher-zone" hidden={zone!=="play"}>
      {game&&<section className="rg-launcher-world" style={{"--world-accent":game.theme.accent} as CSSProperties} aria-label="Sélection de jeux">
        <div className="rg-launcher-scene" key={game.id}><GameArt game={game} className="rg-launcher-scene-art" eager/></div>
        <div className="rg-launcher-shade"/>
        <div className="rg-launcher-world-copy" key={game.id+"copy"}><span className="rg-launcher-eyebrow"><span/> SÉLECTION DU CLUB · {String(chosen+1).padStart(2,"0")} / {String(featured.length).padStart(2,"0")}</span><h2>{game.name}</h2><p>{game.tagline}</p><small><Users/> {game.players}</small><div className="rg-launcher-actions"><Link href={`/play/${game.id}`} className="rg-launcher-play"><Play fill="currentColor"/> JOUER</Link><Link href="/library" className="rg-launcher-secondary">Tous les jeux <ArrowRight/></Link></div></div>
        <div className="rg-launcher-rev"><img src="/images/rev-club.svg" alt="" /><span>REV · ton compagnon</span></div>
        <div className="rg-launcher-picker"><button type="button" onClick={()=>change(-1)} aria-label="Jeu précédent"><ChevronLeft/></button><div className="rg-launcher-reel" aria-label="Changer de jeu">{featured.map((item,i)=><button type="button" key={item.id} aria-pressed={game.id===item.id} onClick={()=>setChosen(i)}><GameArt game={item} className="rg-launcher-mini"/><span>{item.name}</span></button>)}</div><button type="button" onClick={()=>change(1)} aria-label="Jeu suivant"><ChevronRight/></button></div>
      </section>}
      <div className="rg-launcher-live"><button type="button" onClick={()=>setZone("rooms")}><Users/><span>Parties publiques<small>Créer ou rejoindre</small></span><ArrowRight/></button><button type="button" onClick={()=>setZone("social")}><Headphones/><span>{online.length} ami{online.length!==1?"s":""} en ligne<small>Retrouver le club</small></span><ArrowRight/></button><Link href="/classement"><Trophy/><span>Compétition<small>Classements</small></span><ArrowRight/></Link></div>
    </div>
    <div className="rg-launcher-zone rg-launcher-panel" hidden={zone!=="rooms"}><PublicGameRooms /></div>
    <div className="rg-launcher-zone rg-launcher-panel" hidden={zone!=="social"}><HomeSection title="Amis en ligne" href="/friends">{online.length > 0 ? <div className="rg-friend-rail">{online.map(friend => <button key={friend.id} type="button" onClick={() => setInviting(friend)} aria-label={`Inviter ${friend.username}`}><span className="rg-online-avatar"><Avatar username={friend.username} avatarUrl={friend.avatarUrl} /></span><strong>{friend.username}</strong><small>{friend.presence === "in_game" ? "En partie" : "En ligne"}</small></button>)}</div> : <div className="rg-inline-empty"><Users className="h-5 w-5" /><p>{me ? "Tes amis connectés apparaîtront ici." : "Connecte-toi pour retrouver tes amis et les inviter."}</p><Link href={me ? "/friends" : "/sign-in"}>Retrouver mes amis <ArrowRight className="h-4 w-4" /></Link></div>}</HomeSection><HomeSection title="La communauté" href="/community"><div className="rg-community-preview"><div className="rg-community-orbit"><MessageCircle /><Users /><Headphones /></div><div><h3>Une partie commence par une rencontre.</h3><p>Messages, groupes d’amis et salons vocaux : garde le lien, même entre deux parties.</p><Link className="rg-text-link" href="/community">Explorer la communauté <ArrowRight className="h-4 w-4" /></Link></div></div></HomeSection></div>
    <div className="rg-launcher-zone rg-launcher-panel" hidden={zone!=="collection"}><HomeSection title={popular.length ? "Jeux populaires" : "À découvrir"} href="/library" detail="Tes jeux, à portée de main."><div className="rg-home-games rg-quick-games">{(popular.length ? popular : available).slice(0,6).map(game => <GameTile key={game.id} game={game} />)}</div></HomeSection>
    {selection.length > 0 && <HomeSection title="Mes jeux" href="/recent" detail="Tes parties récentes, jeux ouverts et favoris."><div className="rg-home-games">{selection.map(game => <GameTile key={game.id} game={game} />)}</div></HomeSection>}{popular.length > 0 && <HomeSection title="Tendances" href="/library" detail="D’après les participations réellement enregistrées."><div className="rg-home-games">{popular.slice(0, 4).map(game => <GameTile key={game.id} game={game} large />)}</div></HomeSection>}{newGames.length > 0 && <HomeSection title="Nouveautés" href="/new" detail="Les jeux ajoutés au catalogue ces 30 derniers jours."><div className="rg-home-games">{newGames.slice(0, 4).map(game => <GameTile key={game.id} game={game} />)}</div></HomeSection>}<div className="rg-home-shortcuts"><Link href="/shop"><ShoppingBag /><span>Boutique</span><small>Pièces et achats</small></Link><Link href="/favorites"><Heart /><span>Mes favoris</span><small>Mes jeux préférés</small></Link><Link href="/voice"><Headphones /><span>Salons vocaux</span><small>Retrouver ses amis</small></Link></div></div>
    <details className="rg-launcher-about"><summary>À propos de Revanche Games</summary><section className="rg-home-section" aria-labelledby="rg-about-title"><div className="rg-section-heading"><div><h2 id="rg-about-title">Revanche Games : joue, défie tes amis et prends ta revanche !</h2></div></div><p>Revanche Games (RevancheGames) rassemble des jeux de cartes, des quiz de culture générale, des jeux de société et des jeux de stratégie dans une plateforme francophone. Retrouve tes amis, découvre les salons multijoueurs et discute dans les salons vocaux, depuis ton navigateur sur ordinateur ou mobile.</p><p className="mt-2">Découvre les jeux disponibles : <Link className="rg-text-link" href="/jeux">Tous nos jeux</Link>, <Link className="rg-text-link" href="/categories/cartes">jeux de cartes en ligne</Link>, <Link className="rg-text-link" href="/categories/quiz">quiz entre amis</Link> et <Link className="rg-text-link" href="/communaute-francophone">communauté francophone en France, Suisse et Belgique</Link> · <Link className="rg-text-link" href="/suisse">Revanche Games Suisse</Link>.</p></section><div className="rg-home-footer"><Sparkles className="h-4 w-4" /> Revanche Games · Le plaisir de se retrouver. <Link className="rg-text-link" href="/jeux">Découvrir tous nos jeux en ligne</Link></div></details>
    {inviting && <InviteFriendDialog friend={inviting} onClose={()=>setInviting(null)}/>}
  </div>;
}
