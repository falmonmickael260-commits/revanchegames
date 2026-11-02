"use client";
import Link from "next/link";
import { ArrowUpRight, Headphones, MessageCircle, Users, UserPlus } from "lucide-react";
import { useSocial } from "@/components/social/SocialProvider";
import { PageHeader } from "@/components/ui/PageHeader";
import { GroupsSection } from "@/components/social/GroupsSection";
import { Avatar } from "@/components/ui/Avatar";
export function CommunityView() {
  const {me,friends,incomingRequests}=useSocial();
  const online=friends.filter(friend=>friend.presence==="online"||friend.presence==="in_game");
  return <div className="rg-page"><PageHeader eyebrow="Ensemble, c’est mieux" title="Communauté" subtitle="Des amis, des voix, des jeux. Trouve ta prochaine équipe." />
    <div className="rg-community-tiles"><Link href="/voice" className="rg-community-tile rg-community-voice"><Headphones /><span><strong>Salons vocaux</strong><small>Prends un siège. Lance la conversation.</small></span><ArrowUpRight /></Link><Link href="/friends" className="rg-community-tile"><Users /><span><strong>Mes amis</strong><small>{me?`${friends.length} ami${friends.length>1?"s":""}${incomingRequests.length?` · ${incomingRequests.length} demande${incomingRequests.length>1?"s":""}`:""}`:"Retrouve les personnes avec qui jouer."}</small></span><ArrowUpRight /></Link><Link href="/chat" className="rg-community-tile"><MessageCircle /><span><strong>Chat global</strong><small>Le point de rencontre de la communauté.</small></span><ArrowUpRight /></Link><Link href="/messages" className="rg-community-tile"><UserPlus /><span><strong>Messages et invitations</strong><small>Rejoins tes amis en un appui.</small></span><ArrowUpRight /></Link></div>
    {online.length>0&&<section className="rg-home-section"><div className="rg-section-heading"><h2>Ils sont là</h2><Link href="/friends">Voir mes amis<ArrowUpRight className="h-4 w-4" /></Link></div><div className="rg-friend-rail">{online.map(friend=><Link key={friend.id} href={`/profile/${friend.id}`}><span className="rg-online-avatar"><Avatar username={friend.username} avatarUrl={friend.avatarUrl} /></span><strong>{friend.username}</strong><small>{friend.presence==="in_game"?"En partie":"En ligne"}</small></Link>)}</div></section>}
    {me?<section className="rg-home-section"><GroupsSection /></section>:<div className="rg-signin-card"><Users /><h2>Ta communauté t’attend.</h2><p>Un compte pour tes amis, tes groupes et toutes tes conversations.</p><Link href="/sign-up" className="rg-primary-button">Rejoindre Revanche</Link></div>}
  </div>;
}
