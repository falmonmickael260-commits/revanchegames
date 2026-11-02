"use client";
import Link from "next/link";
import { MessageCircle, Search, UserRound } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { useSocial } from "@/components/social/SocialProvider";
import { NotificationCenter } from "@/components/social/NotificationCenter";
import { WalletPill } from "./WalletPill";
export function Header() {
  const { me, ready, dmUnread } = useSocial();
  const unread = [...dmUnread.values()].reduce((sum, count) => sum + count, 0);
  return <header className="rg-app-header" style={{ height: "var(--rg-header-h)", paddingTop: "var(--rg-safe-top)" }}>
    <Link href={me ? "/profile" : "/sign-in"} aria-label={me ? `Profil de ${me.username}` : "Se connecter"} className="rg-player-heading">
      {me ? <Avatar username={me.username} avatarUrl={me.avatarUrl} size="sm" /> : <span className="rg-guest-avatar"><UserRound className="h-4 w-4" /></span>}
      <span className="min-w-0"><span className="block text-[9px] font-medium uppercase tracking-[.16em] text-text-faint">Revanche Games</span><span className="block truncate text-sm font-bold">{me?.username || (ready ? "À toi de jouer" : "Bienvenue")}</span></span>
    </Link>
    <div className="ml-auto flex shrink-0 items-center gap-0.5 sm:gap-2">
      <WalletPill />
      <Link href="/library?search=1" aria-label="Rechercher un jeu" className="rg-icon-button rg-header-search"><Search className="h-4 w-4" /></Link>
      <Link href="/messages" aria-label={`Messages${unread ? `, ${unread} non lus` : ""}`} className="rg-icon-button relative"><MessageCircle className="h-4 w-4" />{unread > 0 && <span className="rg-count">{unread > 99 ? "99+" : unread}</span>}</Link>
      <NotificationCenter />
    </div>
  </header>;
}
