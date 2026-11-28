"use client";
import Link from "next/link";
import { ClubGameButton } from "./ClubGameButton";
import { ArrowRight, Gamepad2, Trophy, Headphones, MessageCircle, Sparkles, Users, ShoppingBag, Heart } from "lucide-react";
import { useState, useEffect, type ReactNode } from "react";
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
  const featured=[...new Set(["la-meute","bombshift","kilomax","camouflip","quiz-master","president","fortune-empire","10000",...popularIds,...available.map(g=>g.id)])].flatMap(id=>available.filter(game=>game.id===id));
  useEffect(()=>{const onHash=()=>{if(window.location.hash==="#salons")setZone("rooms")};onHash();window.addEventListener("hashchange",onHash);return()=>window.removeEventListener("hashchange",onHash)},[]);
  return <div className="rg-party-home">
    <h1 className="rg-visually-hidden">Revanche Games – Jeux multijoueurs en ligne entre amis</h1>
    <div className="rg-party-account"><div className="rg-launcher-account">{me && <div className="rg-home-player"><Link href="/profile" className="rg-home-player-profile"><span className="rg-home-avatar"><Avatar username={me.username} avatarUrl={me.avatarUrl} size="md" /></span><span className="rg-home-player-info"><strong>{me.username}</strong>{progress ? <><LevelBadge progress={progress} compact /><span className="rg-home-xp"><span style={{ width: `${progress.xpForLevel ? Math.max(0,Math.min(100,progress.xpIntoLevel/progress.xpForLevel*100)) : 0}%` }} /></span><small>{progress.xp.toLocaleString("fr-FR")} XP</small></> : <small>Mon espace joueur</small>}</span></Link><WalletPill /></div>}
    {ready && !me && <div className="rg-auth-strip"><p>Un compte pour jouer et retrouver tes amis.</p><div><Link href="/sign-in" className="rg-text-link">Connexion</Link><Link href="/sign-up" className="rg-primary-button">S’inscrire</Link></div></div>}</div></div>
    <nav className="rg-party-tabs" aria-label="Espaces du hall">
      {([{id:"play",name:"Jeux",Icon:Gamepad2},{id:"rooms",name:"Salons",Icon:Users},{id:"social",name:"Amis",Icon:Headphones},{id:"collection",name:"Collection",Icon:Heart}] as const).map(({id,name,Icon})=><button key={id} type="button" aria-pressed={zone===id} onClick={()=>setZone(id)}><Icon/><span>{name}</span></button>)}
    </nav>
    <div className="rg-launcher-zone" hidden={zone!=="play"}>
      <div className="rg-party-welcome">
        <div><span className="rg-party-kicker">À toi de jouer !</span><h2>{me?`Salut, ${me.username} !`:"Bienvenue au club !"}</h2><p>Une partie, des amis, des fous rires.</p><Link href="/library" className="rg-party-welcome-cta">Tous les jeux <ArrowRight/></Link></div>
        <img src="/images/club/rev.svg" alt="REV, mascotte Revanche Games"/>
      </div>
      <div className="rg-party-social">
        <button type="button" onClick={()=>setZone("rooms")}><img src="/images/club/rooms.svg" alt=""/><span><strong>Parties</strong><small>Créer / rejoindre</small></span></button>
        <Link href="/voice"><img src="/images/club/voice.svg" alt=""/><span><strong>Vocal</strong><small>Salons entre amis</small></span></Link>
        <Link href="/shop"><img src="/images/club/gift.svg" alt=""/><span><strong>Boutique</strong><small>Pièces et achats</small></span></Link>
      </div>
      <div className="rg-party-title"><h2><Gamepad2/> Les jeux du club</h2><Link href="/library">Tout voir <ArrowRight/></Link></div>
      <div className="rg-party-grid">{featured.map(game=><ClubGameButton key={game.id} game={game}/>)}</div>
      <div className="rg-party-after"><button type="button" onClick={()=>setZone("social")}><Users/> {online.length} ami{online.length!==1?"s":""} en ligne <ArrowRight/></button><Link href="/classement"><Trophy/> Classements <ArrowRight/></Link></div>
    </div>
    <div className="rg-launcher-zone rg-party-panel" hidden={zone!=="rooms"}><PublicGameRooms /></div>
    <div className="rg-launcher-zone rg-party-panel" hidden={zone!=="social"}><HomeSection title="Amis en ligne" href="/friends">{online.length > 0 ? <div className="rg-friend-rail">{online.map(friend => <button key={friend.id} type="button" onClick={() => setInviting(friend)} aria-label={`Inviter ${friend.username}`}><span className="rg-online-avatar"><Avatar username={friend.username} avatarUrl={friend.avatarUrl} /></span><strong>{friend.username}</strong><small>{friend.presence === "in_game" ? "En partie" : "En ligne"}</small></button>)}</div> : <div className="rg-inline-empty"><Users className="h-5 w-5" /><p>{me ? "Tes amis connectés apparaîtront ici." : "Connecte-toi pour retrouver tes amis et les inviter."}</p><Link href={me ? "/friends" : "/sign-in"}>Retrouver mes amis <ArrowRight className="h-4 w-4" /></Link></div>}</HomeSection><HomeSection title="La communauté" href="/community"><div className="rg-community-preview"><div className="rg-community-orbit"><MessageCircle /><Users /><Headphones /></div><div><h3>Une partie commence par une rencontre.</h3><p>Messages, groupes d’amis et salons vocaux : garde le lien, même entre deux parties.</p><Link className="rg-text-link" href="/community">Explorer la communauté <ArrowRight className="h-4 w-4" /></Link></div></div></HomeSection></div>
    <div className="rg-launcher-zone rg-party-panel" hidden={zone!=="collection"}><HomeSection title={popular.length ? "Jeux populaires" : "À découvrir"} href="/library" detail="Tes jeux, à portée de main."><div className="rg-home-games rg-quick-games">{(popular.length ? popular : available).slice(0,6).map(game => <GameTile key={game.id} game={game} />)}</div></HomeSection>
    {selection.length > 0 && <HomeSection title="Mes jeux" href="/recent" detail="Tes parties récentes, jeux ouverts et favoris."><div className="rg-home-games">{selection.map(game => <GameTile key={game.id} game={game} />)}</div></HomeSection>}{popular.length > 0 && <HomeSection title="Tendances" href="/library" detail="D’après les participations réellement enregistrées."><div className="rg-home-games">{popular.slice(0, 4).map(game => <GameTile key={game.id} game={game} large />)}</div></HomeSection>}{newGames.length > 0 && <HomeSection title="Nouveautés" href="/new" detail="Les jeux ajoutés au catalogue ces 30 derniers jours."><div className="rg-home-games">{newGames.slice(0, 4).map(game => <GameTile key={game.id} game={game} />)}</div></HomeSection>}<div className="rg-home-shortcuts"><Link href="/shop"><ShoppingBag /><span>Boutique</span><small>Pièces et achats</small></Link><Link href="/favorites"><Heart /><span>Mes favoris</span><small>Mes jeux préférés</small></Link><Link href="/voice"><Headphones /><span>Salons vocaux</span><small>Retrouver ses amis</small></Link></div></div>
    <details className="rg-party-about"><summary>À propos de Revanche Games</summary><section className="rg-home-section" aria-labelledby="rg-about-title"><div className="rg-section-heading"><div><h2 id="rg-about-title">Revanche Games : joue, défie tes amis et prends ta revanche !</h2></div></div><p>Revanche Games (RevancheGames) rassemble des jeux de cartes, des quiz de culture générale, des jeux de société et des jeux de stratégie dans une plateforme francophone. Retrouve tes amis, découvre les salons multijoueurs et discute dans les salons vocaux, depuis ton navigateur sur ordinateur ou mobile.</p><p className="mt-2">Découvre les jeux disponibles : <Link className="rg-text-link" href="/jeux">Tous nos jeux</Link>, <Link className="rg-text-link" href="/categories/cartes">jeux de cartes en ligne</Link>, <Link className="rg-text-link" href="/categories/quiz">quiz entre amis</Link> et <Link className="rg-text-link" href="/communaute-francophone">communauté francophone en France, Suisse et Belgique</Link> · <Link className="rg-text-link" href="/suisse">Revanche Games Suisse</Link>.</p></section><div className="rg-home-footer"><Sparkles className="h-4 w-4" /> Revanche Games · Le plaisir de se retrouver. <Link className="rg-text-link" href="/jeux">Découvrir tous nos jeux en ligne</Link></div></details>
    {inviting && <InviteFriendDialog friend={inviting} onClose={()=>setInviting(null)}/>}
  </div>;
}
