"use client";

import { useState } from "react";
import Link from "next/link";
import { Gamepad2, Headphones, MessageCircle, Search, Users } from "lucide-react";
import { GAMES } from "@/data/games";
import { useSocial } from "@/components/social/SocialProvider";
import { Avatar } from "@/components/ui/Avatar";
import { GroupsSection } from "@/components/social/GroupsSection";
import { InviteFriendDialog } from "@/components/social/InviteFriendDialog";
import { DirectMessageDialog } from "@/components/social/DirectMessageDialog";
import type { FriendEntry } from "@/lib/social/types";
import { PageHeader } from "@/components/ui/PageHeader";

type CommunityTab = "friends" | "groups";

function FriendRows({
  people,
  dmUnread,
  onChat,
  onInvite,
}: {
  people: FriendEntry[];
  dmUnread: Map<string, number>;
  onChat: (friend: FriendEntry) => void;
  onInvite: (friend: FriendEntry) => void;
}) {
  if (!people.length) return <p className="rg-community-empty">Aucun ami dans cette liste pour le moment.</p>;
  return <ul className="rg-neon-friend-list">{people.map(friend => <li key={friend.friendshipId} className="rg-neon-friend-row">
    <Link href={`/profile/${friend.id}`} className="rg-neon-friend-avatar"><Avatar username={friend.username} avatarUrl={friend.avatarUrl} size="sm" /><i className={friend.presence === "online" || friend.presence === "in_game" ? "is-online" : ""} /></Link>
    <Link href={`/profile/${friend.id}`} className="rg-neon-friend-copy"><strong>{friend.username}</strong><small>{friend.gameSlug ? `En partie · ${GAMES.find(game => game.id === friend.gameSlug)?.name ?? friend.gameSlug}` : friend.presence === "online" || friend.presence === "in_game" ? "En ligne" : "Hors ligne"}</small></Link>
    <button type="button" className="rg-friend-icon-action" onClick={() => onChat(friend)} aria-label={`Écrire à ${friend.username}`}>{dmUnread.get(friend.id) ? <span className="rg-friend-unread">{dmUnread.get(friend.id)}</span> : null}<MessageCircle /></button>
    <button type="button" className="rg-friend-invite-action" onClick={() => onInvite(friend)}><Gamepad2 /><span>Inviter</span></button>
  </li>)}</ul>;
}

export function CommunityView() {
  const { me, ready, friends, incomingRequests, dmUnread } = useSocial();
  const [tab, setTab] = useState<CommunityTab>("friends");
  const [inviting, setInviting] = useState<FriendEntry | null>(null);
  const [chatting, setChatting] = useState<FriendEntry | null>(null);
  const online = friends.filter(friend => friend.presence === "online" || friend.presence === "in_game");
  const offline = friends.filter(friend => friend.presence !== "online" && friend.presence !== "in_game");

  return <div className="rg-page rg-community-page">
    <PageHeader eyebrow="Ta communauté" title="Communauté" subtitle="Retrouve tes amis et rejoins une partie." />
    <div className="rg-community-tabs" role="tablist" aria-label="Espaces de la communauté">
      <button type="button" role="tab" aria-selected={tab === "friends"} className={tab === "friends" ? "is-active" : ""} onClick={() => setTab("friends")}><Users />Amis <span>{friends.length}</span></button>
      <button type="button" role="tab" aria-selected={tab === "groups"} className={tab === "groups" ? "is-active" : ""} onClick={() => setTab("groups")}><MessageCircle />Groupes</button>
      <Link role="tab" href="/voice" aria-label="Ouvrir les salons vocaux"><Headphones />Salons</Link>
    </div>
    {tab === "friends" ? <section className="rg-community-roster" role="tabpanel">
      <div className="rg-roster-heading"><div><p>MES AMIS</p><h2>{ready && me ? `${friends.length} joueur${friends.length === 1 ? "" : "s"}` : "Joue avec tes amis"}</h2></div><Link href="/friends" aria-label="Rechercher et gérer mes amis"><Search /></Link></div>
      {!ready ? <div className="rg-skeleton h-28" /> : !me ? <div className="rg-community-empty"><p>Connecte-toi pour retrouver ta liste d’amis.</p><Link href="/sign-in?next=/community">Se connecter</Link></div> : <>
        {incomingRequests.length > 0 && <Link className="rg-friend-requests" href="/friends">{incomingRequests.length} demande{incomingRequests.length === 1 ? "" : "s"} d’amitié à traiter <span>Voir</span></Link>}
        <div className="rg-roster-group"><h3>En ligne <span>{online.length}</span></h3><FriendRows people={online} dmUnread={dmUnread} onChat={setChatting} onInvite={setInviting} /></div>
        {offline.length > 0 && <details className="rg-offline-list"><summary>Hors ligne <span>{offline.length}</span></summary><FriendRows people={offline} dmUnread={dmUnread} onChat={setChatting} onInvite={setInviting} /></details>}
        <Link className="rg-find-friends" href="/friends"><Users />Trouver des amis</Link>
      </>}
    </section> : <section className="rg-community-roster" role="tabpanel"><div className="rg-roster-heading"><div><p>TES CONVERSATIONS</p><h2>Groupes d’amis</h2></div></div>{me ? <GroupsSection /> : <div className="rg-community-empty"><p>Connecte-toi pour retrouver tes groupes.</p><Link href="/sign-in?next=/community">Se connecter</Link></div>}</section>}
    {inviting && <InviteFriendDialog friend={inviting} onClose={() => setInviting(null)} />}
    {chatting && me && <DirectMessageDialog me={me} friend={chatting} onClose={() => setChatting(null)} />}
  </div>;
}
