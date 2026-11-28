"use client";
import Link from "next/link";
import { QuickMatchPanel } from "./QuickMatchPanel";
import { LiveVoicePreview } from "./LiveVoicePreview";
import { ClubGameButton } from "./ClubGameButton";
import { ArrowRight, Gift, Gamepad2, Zap, Radio, Trophy, Headphones, MessageCircle, Sparkles, Users, ShoppingBag, Heart } from "lucide-react";
import { useState, useEffect, type ReactNode } from "react";
import { GAMES } from "@/data/games";
import { Avatar } from "@/components/ui/Avatar";
import { useSocial } from "@/components/social/SocialProvider";
import { InviteFriendDialog } from "@/components/social/InviteFriendDialog";
import type { FriendEntry } from "@/lib/social/types";
import { useRecentGames } from "@/lib/use-recent-games";
import { useFavorites } from "@/lib/use-favorites";
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

  const [showAll,setShowAll]=useState(false);
  const [zone,setZone]=useState<"play"|"rooms"|"social"|"collection"|"quick"|"match">("play");
  const featured=[...new Set(["la-meute","quiz-master","kilomax","bombshift","camouflip","president","fortune-empire","10000",...popularIds,...available.map(g=>g.id)])].flatMap(id=>available.filter(game=>game.id===id));
  useEffect(()=>{const onHash=()=>{const hash=window.location.hash;if(hash==="#salons")setZone("rooms");else if(hash==="#partie-rapide")setZone("quick");else if(hash==="#matchmaking")setZone("match")};onHash();window.addEventListener("hashchange",onHash);return()=>window.removeEventListener("hashchange",onHash)},[]);
  return <div className="rg-party-home rg-premium-home">
    <h1 className="rg-visually-hidden">Revanche Games – Jeux multijoueurs en ligne entre amis</h1>
    <div className="rg-party-account"><div className="rg-launcher-account">{me && <div className="rg-home-player"><Link href="/profile" className="rg-home-player-profile"><span className="rg-home-avatar"><Avatar username={me.username} avatarUrl={me.avatarUrl} size="md" /></span><span className="rg-home-player-info"><strong>{me.username}</strong>{progress ? <><LevelBadge progress={progress} compact /><span className="rg-home-xp"><span style={{ width: `${progress.xpForLevel ? Math.max(0,Math.min(100,progress.xpIntoLevel/progress.xpForLevel*100)) : 0}%` }} /></span><small>{progress.xp.toLocaleString("fr-FR")} XP</small></> : <small>Mon espace joueur</small>}</span></Link><WalletPill /></div>}
    {ready && !me && <div className="rg-auth-strip"><p>Un compte pour jouer et retrouver tes amis.</p><div><Link href="/sign-in" className="rg-text-link">Connexion</Link><Link href="/sign-up" className="rg-primary-button">S’inscrire</Link></div></div>}</div></div>
    <nav className={`rg-party-tabs ${zone==="play"||zone==="quick"||zone==="match"?"rg-premium-tabs-home":""}`} aria-label="Espaces du hall">
      {([{id:"play",name:"Jeux",Icon:Gamepad2},{id:"rooms",name:"Salons",Icon:Users},{id:"social",name:"Amis",Icon:Headphones},{id:"collection",name:"Collection",Icon:Heart}] as const).map(({id,name,Icon})=><button key={id} type="button" aria-pressed={zone===id} onClick={()=>setZone(id)}><Icon/><span>{name}</span></button>)}
    </nav>
    <div className="rg-launcher-zone" hidden={zone!=="play"}>
      <div className="rg-premium-access">{me?<><Link href="/profile"><Avatar username={me.username} avatarUrl={me.avatarUrl} size="sm"/>{me.username}</Link>{progress&&<LevelBadge progress={progress} compact/>}</>:ready?<><Link href="/sign-in">Connexion</Link><Link href="/sign-up" className="rg-premium-register">S’inscrire</Link></>:null}<Link href="/messages"><MessageCircle/>Messages</Link></div>
      <section className="rg-premium-welcome" aria-label="Bienvenue">
        <div className="rg-premium-portrait" aria-hidden="true"/>
        <div className="rg-premium-welcome-copy"><h2>Bienvenue sur<br/><strong>Revanche Games !</strong></h2><p>Joue · Discute · Offre des cadeaux et défie tes amis !</p></div>
        <div className="rg-premium-shortcuts">
          <button type="button" onClick={()=>setZone("rooms")}><Gamepad2/><span>Parties<br/>publiques</span></button>
          <Link href="/voice"><Headphones/><span>Salons<br/>vocaux</span></Link>
          <Link href="/messages"><Gift/><span>Cadeaux</span></Link>
          <Link href="/shop"><ShoppingBag/><span>Boutique</span></Link>
        </div>
      </section>
      <section className="rg-play-hub" aria-label="Modes de jeu"><div className="rg-play-hub-head"><span>LE HALL</span><strong>Prêt à jouer ?</strong></div><button type="button" className="rg-play-quick" onClick={()=>setZone("quick")}><span className="rg-play-emblem"><Zap fill="currentColor"/></span><span><strong>PARTIE RAPIDE</strong><small>Rejoins une partie disponible</small></span><ArrowRight/></button><div className="rg-play-secondary"><button type="button" onClick={()=>setZone("match")}><Radio/><span><strong>Matchmaking</strong><small>Recherche automatique</small></span></button><button type="button" onClick={()=>setZone("rooms")}><Users/><span><strong>Salons</strong><small>Créer ou rejoindre</small></span></button></div></section>
      <div className="rg-party-title"><h2><Gamepad2/> Nos jeux</h2><button type="button" onClick={()=>setShowAll(v=>!v)}>{showAll?"Réduire":"Tout voir"} <ArrowRight/></button></div>
      <div className="rg-party-grid">{(showAll?featured:featured.slice(0,4)).map(game=><ClubGameButton key={game.id} game={game}/>)}</div>
      <LiveVoicePreview userId={me?.id}/>
      <div className="rg-premium-links"><button type="button" onClick={()=>setZone("rooms")}>Salons publics</button><button type="button" onClick={()=>setZone("collection")}>Mes jeux</button><Link href="/library">Catalogue complet</Link></div>
      <div className="rg-party-after"><button type="button" onClick={()=>setZone("social")}><Users/> {online.length} ami{online.length!==1?"s":""} en ligne <ArrowRight/></button><Link href="/classement"><Trophy/> Classements <ArrowRight/></Link></div>
    </div>
    {(zone==="quick"||zone==="match")&&<QuickMatchPanel key={zone} mode={zone} onBack={()=>setZone("play")}/>}
    <div className="rg-launcher-zone rg-party-panel rg-match-rooms" hidden={zone!=="rooms"}><button className="rg-premium-back" type="button" onClick={()=>setZone("play")}>‹ Retour à l’accueil</button><PublicGameRooms /></div>
    <div className="rg-launcher-zone rg-party-panel" hidden={zone!=="social"}><HomeSection title="Amis en ligne" href="/friends">{online.length > 0 ? <div className="rg-friend-rail">{online.map(friend => <button key={friend.id} type="button" onClick={() => setInviting(friend)} aria-label={`Inviter ${friend.username}`}><span className="rg-online-avatar"><Avatar username={friend.username} avatarUrl={friend.avatarUrl} /></span><strong>{friend.username}</strong><small>{friend.presence === "in_game" ? "En partie" : "En ligne"}</small></button>)}</div> : <div className="rg-inline-empty"><Users className="h-5 w-5" /><p>{me ? "Tes amis connectés apparaîtront ici." : "Connecte-toi pour retrouver tes amis et les inviter."}</p><Link href={me ? "/friends" : "/sign-in"}>Retrouver mes amis <ArrowRight className="h-4 w-4" /></Link></div>}</HomeSection><HomeSection title="La communauté" href="/community"><div className="rg-community-preview"><div className="rg-community-orbit"><MessageCircle /><Users /><Headphones /></div><div><h3>Une partie commence par une rencontre.</h3><p>Messages, groupes d’amis et salons vocaux : garde le lien, même entre deux parties.</p><Link className="rg-text-link" href="/community">Explorer la communauté <ArrowRight className="h-4 w-4" /></Link></div></div></HomeSection></div>
    <div className="rg-launcher-zone rg-party-panel" hidden={zone!=="collection"}><HomeSection title={popular.length ? "Jeux populaires" : "À découvrir"} href="/library" detail="Tes jeux, à portée de main."><div className="rg-party-grid">{(popular.length ? popular : available).slice(0,6).map(game => <ClubGameButton key={game.id} game={game} />)}</div></HomeSection>
    {selection.length > 0 && <HomeSection title="Mes jeux" href="/recent" detail="Tes parties récentes, jeux ouverts et favoris."><div className="rg-party-grid">{selection.map(game => <ClubGameButton key={game.id} game={game} />)}</div></HomeSection>}{popular.length > 0 && <HomeSection title="Tendances" href="/library" detail="D’après les participations réellement enregistrées."><div className="rg-party-grid">{popular.slice(0, 4).map(game => <ClubGameButton key={game.id} game={game} />)}</div></HomeSection>}{newGames.length > 0 && <HomeSection title="Nouveautés" href="/new" detail="Les jeux ajoutés au catalogue ces 30 derniers jours."><div className="rg-party-grid">{newGames.slice(0, 4).map(game => <ClubGameButton key={game.id} game={game} />)}</div></HomeSection>}<div className="rg-home-shortcuts"><Link href="/shop"><ShoppingBag /><span>Boutique</span><small>Pièces et achats</small></Link><Link href="/favorites"><Heart /><span>Mes favoris</span><small>Mes jeux préférés</small></Link><Link href="/voice"><Headphones /><span>Salons vocaux</span><small>Retrouver ses amis</small></Link></div></div>
    <details className="rg-party-about"><summary>À propos de Revanche Games</summary><section className="rg-home-section" aria-labelledby="rg-about-title"><div className="rg-section-heading"><div><h2 id="rg-about-title">Revanche Games : joue, défie tes amis et prends ta revanche !</h2></div></div><p>Revanche Games (RevancheGames) rassemble des jeux de cartes, des quiz de culture générale, des jeux de société et des jeux de stratégie dans une plateforme francophone. Retrouve tes amis, découvre les salons multijoueurs et discute dans les salons vocaux, depuis ton navigateur sur ordinateur ou mobile.</p><p className="mt-2">Découvre les jeux disponibles : <Link className="rg-text-link" href="/jeux">Tous nos jeux</Link>, <Link className="rg-text-link" href="/categories/cartes">jeux de cartes en ligne</Link>, <Link className="rg-text-link" href="/categories/quiz">quiz entre amis</Link> et <Link className="rg-text-link" href="/communaute-francophone">communauté francophone en France, Suisse et Belgique</Link> · <Link className="rg-text-link" href="/suisse">Revanche Games Suisse</Link>.</p></section><div className="rg-home-footer"><Sparkles className="h-4 w-4" /> Revanche Games · Le plaisir de se retrouver. <Link className="rg-text-link" href="/jeux">Découvrir tous nos jeux en ligne</Link></div></details>
    {inviting && <InviteFriendDialog friend={inviting} onClose={()=>setInviting(null)}/>}
  </div>;
}
