"use client";
import Link from "next/link";
import { ArrowRight, Headphones, MessageCircle, Search, Sparkles, Trophy, Users } from "lucide-react";
import { useState, type ReactNode } from "react";
import { GAMES } from "@/data/games";
import { GameArt } from "@/components/library/GameArt";
import { Avatar } from "@/components/ui/Avatar";
import { useSocial } from "@/components/social/SocialProvider";
import { InviteFriendDialog } from "@/components/social/InviteFriendDialog";
import type { FriendEntry } from "@/lib/social/types";
import { useRecentGames } from "@/lib/use-recent-games";
import { useFavorites } from "@/lib/use-favorites";
import { GameTile } from "./GameTile";
const available = GAMES.filter(game => game.enabled && game.url);
export function HomeSection({ title, href, children, detail }: { title: string; href?: string; children: ReactNode; detail?: string }) {
  return <section className="rg-home-section"><div className="rg-section-heading"><div><h2>{title}</h2>{detail && <p>{detail}</p>}</div>{href && <Link href={href} aria-label={`Tout voir : ${title}`}>Tout voir <ArrowRight className="h-3.5 w-3.5" /></Link>}</div>{children}</section>;
}
export function HomeView({ popularIds, newIds }: { popularIds: string[]; newIds: string[] }) {
  const { me, ready, friends } = useSocial();
  const recent = useRecentGames(me?.id);
  const { favorites } = useFavorites();
  const [inviting, setInviting] = useState<FriendEntry | null>(null);
  const online = friends.filter(friend => friend.presence === "online" || friend.presence === "in_game");
  const selection = [...new Set([...recent.map(game => game.id), ...favorites])].flatMap(id => available.filter(game => game.id === id)).slice(0, 4);
  const popular = popularIds.flatMap(id => available.filter(game => game.id === id));
  const feature = available.find(game => game.id === (selection[0]?.id || "president")) || available[0];
  const newGames = newIds.flatMap(id => available.filter(game => game.id === id));
  return <div className="rg-page rg-home-page">
    <div className="rg-home-welcome"><div><p className="rg-eyebrow">Ton prochain bon moment</p><h1>{me ? `On joue, ${me.username} ?` : "Le jeu nous rassemble."}</h1></div><Link href="/library?search=1" aria-label="Rechercher un jeu" className="rg-icon-button rg-search-circle"><Search className="h-5 w-5" /></Link></div>
    {ready && !me && <div className="rg-auth-strip"><p>Un compte pour jouer et retrouver tes amis.</p><div><Link href="/sign-in" className="rg-text-link">Connexion</Link><Link href="/sign-up" className="rg-primary-button">S’inscrire</Link></div></div>}
    {feature && <section className="rg-home-hero" aria-label="À l’affiche"><div className="rg-hero-art"><GameArt game={feature} className="h-full w-full" eager /></div><div className="rg-hero-shade" /><div className="rg-hero-content"><span className="rg-hero-kicker">À l’affiche</span><h2>{feature.name}</h2><p>{feature.tagline}</p><Link href={`/play/${feature.id}`} className="rg-primary-button">Jouer maintenant <ArrowRight className="h-4 w-4" /></Link></div><span className="rg-hero-player-count">{feature.players}</span></section>}
    <HomeSection title="Jouer maintenant" href="/library" detail="Choisis un jeu et retrouve tes amis en un toucher."><div className="rg-home-games rg-quick-games">{available.map(game => <GameTile key={game.id} game={game} />)}</div></HomeSection>
    {selection.length > 0 && <HomeSection title="Mes jeux" href="/recent" detail="Tes parties récentes, jeux ouverts et favoris."><div className="rg-home-games">{selection.map(game => <GameTile key={game.id} game={game} />)}</div></HomeSection>}
    <HomeSection title="Amis en ligne" href="/friends">{online.length > 0 ? <div className="rg-friend-rail">{online.map(friend => <button key={friend.id} type="button" onClick={() => setInviting(friend)} aria-label={`Inviter ${friend.username}`}><span className="rg-online-avatar"><Avatar username={friend.username} avatarUrl={friend.avatarUrl} /></span><strong>{friend.username}</strong><small>{friend.presence === "in_game" ? "En partie" : "En ligne"}</small></button>)}</div> : <div className="rg-inline-empty"><Users className="h-5 w-5" /><p>{me ? "Tes amis connectés apparaîtront ici." : "Connecte-toi pour retrouver tes amis et les inviter."}</p><Link href={me ? "/friends" : "/sign-in"}>Retrouver mes amis <ArrowRight className="h-4 w-4" /></Link></div>}</HomeSection>
    <div className="rg-home-shortcuts"><Link href="/voice"><Headphones /><span>Salons vocaux</span><small>Parlons ensemble</small></Link><Link href="/friends"><Users /><span>Retrouver mes amis</span><small>Inviter et rejoindre</small></Link><Link href="/classement"><Trophy /><span>Classement</span><small>Les résultats réels</small></Link></div>
    <HomeSection title={popular.length ? "Jeux populaires" : "À découvrir"} href="/library" detail={popular.length ? "D’après les participations réellement enregistrées." : "Une sélection de jeux disponibles."}><div className="rg-home-games">{(popular.length ? popular : available).slice(0, 4).map(game => <GameTile key={game.id} game={game} large />)}</div></HomeSection>
    <HomeSection title="La communauté" href="/community"><div className="rg-community-preview"><div className="rg-community-orbit"><MessageCircle /><Users /><Headphones /></div><div><h3>Une partie commence par une rencontre.</h3><p>Messages, groupes d’amis et salons vocaux : garde le lien, même entre deux parties.</p><Link className="rg-text-link" href="/community">Explorer la communauté <ArrowRight className="h-4 w-4" /></Link></div></div></HomeSection>
    {newGames.length > 0 && <HomeSection title="Nouveautés" href="/new" detail="Les jeux ajoutés au catalogue ces 30 derniers jours."><div className="rg-home-games">{newGames.slice(0, 4).map(game => <GameTile key={game.id} game={game} />)}</div></HomeSection>}
    <div className="rg-home-footer"><Sparkles className="h-4 w-4" /> Revanche Games · Le plaisir de se retrouver.</div>
    {inviting && <InviteFriendDialog friend={inviting} onClose={() => setInviting(null)} />}
  </div>;
}
