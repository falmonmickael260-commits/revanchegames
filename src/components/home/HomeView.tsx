"use client";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Headphones, MessageCircle, Sparkles, Users, ShoppingBag, Heart } from "lucide-react";
import { useState, type ReactNode } from "react";
import { GAMES } from "@/data/games";
import { Avatar } from "@/components/ui/Avatar";
import { useSocial } from "@/components/social/SocialProvider";
import { InviteFriendDialog } from "@/components/social/InviteFriendDialog";
import type { FriendEntry } from "@/lib/social/types";
import { useRecentGames } from "@/lib/use-recent-games";
import { useFavorites } from "@/lib/use-favorites";
import { GameTile } from "./GameTile";
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
  return <div className="rg-page rg-home-page">
    <h1 className="rg-visually-hidden">Accueil Revanche Games</h1>
    {me && <div className="rg-home-player"><Link href="/profile" className="rg-home-player-profile"><span className="rg-home-avatar"><Avatar username={me.username} avatarUrl={me.avatarUrl} size="md" /></span><span className="rg-home-player-info"><strong>{me.username}</strong>{progress ? <><LevelBadge progress={progress} compact /><span className="rg-home-xp"><span style={{ width: `${progress.xpForLevel ? Math.max(0,Math.min(100,progress.xpIntoLevel/progress.xpForLevel*100)) : 0}%` }} /></span><small>{progress.xp.toLocaleString("fr-FR")} XP</small></> : <small>Mon espace joueur</small>}</span></Link><WalletPill /></div>}
    {ready && !me && <div className="rg-auth-strip"><p>Un compte pour jouer et retrouver tes amis.</p><div><Link href="/sign-in" className="rg-text-link">Connexion</Link><Link href="/sign-up" className="rg-primary-button">S’inscrire</Link></div></div>}
    <section className="rg-home-hero rg-home-feature" aria-label="Jeu à la une">
      <Image src="/images/la-meute-hero-refonte.webp" alt="" fill sizes="(min-width: 1024px) 920px, 100vw" loading="eager" className="rg-home-feature-art" />
      <div className="rg-home-feature-shade" aria-hidden="true" />
      <div className="rg-hero-content">
        <span className="rg-hero-kicker">À LA UNE · MULTIJOUEUR</span>
        <h2>La Meute<br />Noire</h2>
        <p>Entre dans la partie avec tes amis.</p>
        <Link href="/play/la-meute" className="rg-primary-button">Jouer maintenant <ArrowRight className="h-4 w-4" /></Link>
      </div>
    </section>
    <HomeSection title={popular.length ? "Jeux populaires" : "À découvrir"} href="/library" detail="Tes jeux, à portée de main."><div className="rg-home-games rg-quick-games">{(popular.length ? popular : available).slice(0,6).map(game => <GameTile key={game.id} game={game} />)}</div></HomeSection>
    {selection.length > 0 && <HomeSection title="Mes jeux" href="/recent" detail="Tes parties récentes, jeux ouverts et favoris."><div className="rg-home-games">{selection.map(game => <GameTile key={game.id} game={game} />)}</div></HomeSection>}
    <HomeSection title="Amis en ligne" href="/friends">{online.length > 0 ? <div className="rg-friend-rail">{online.map(friend => <button key={friend.id} type="button" onClick={() => setInviting(friend)} aria-label={`Inviter ${friend.username}`}><span className="rg-online-avatar"><Avatar username={friend.username} avatarUrl={friend.avatarUrl} /></span><strong>{friend.username}</strong><small>{friend.presence === "in_game" ? "En partie" : "En ligne"}</small></button>)}</div> : <div className="rg-inline-empty"><Users className="h-5 w-5" /><p>{me ? "Tes amis connectés apparaîtront ici." : "Connecte-toi pour retrouver tes amis et les inviter."}</p><Link href={me ? "/friends" : "/sign-in"}>Retrouver mes amis <ArrowRight className="h-4 w-4" /></Link></div>}</HomeSection>
    <div className="rg-home-shortcuts"><Link href="/shop"><ShoppingBag /><span>Boutique</span><small>Pièces et achats</small></Link><Link href="/favorites"><Heart /><span>Mes favoris</span><small>Mes jeux préférés</small></Link><Link href="/voice"><Headphones /><span>Salons vocaux</span><small>Retrouver ses amis</small></Link></div>
    {popular.length > 0 && <HomeSection title="Tendances" href="/library" detail="D’après les participations réellement enregistrées."><div className="rg-home-games">{popular.slice(0, 4).map(game => <GameTile key={game.id} game={game} large />)}</div></HomeSection>}
    <HomeSection title="La communauté" href="/community"><div className="rg-community-preview"><div className="rg-community-orbit"><MessageCircle /><Users /><Headphones /></div><div><h3>Une partie commence par une rencontre.</h3><p>Messages, groupes d’amis et salons vocaux : garde le lien, même entre deux parties.</p><Link className="rg-text-link" href="/community">Explorer la communauté <ArrowRight className="h-4 w-4" /></Link></div></div></HomeSection>
    {newGames.length > 0 && <HomeSection title="Nouveautés" href="/new" detail="Les jeux ajoutés au catalogue ces 30 derniers jours."><div className="rg-home-games">{newGames.slice(0, 4).map(game => <GameTile key={game.id} game={game} />)}</div></HomeSection>}
    <div className="rg-home-footer"><Sparkles className="h-4 w-4" /> Revanche Games · Le plaisir de se retrouver.</div>
    {inviting && <InviteFriendDialog friend={inviting} onClose={() => setInviting(null)} />}
  </div>;
}
