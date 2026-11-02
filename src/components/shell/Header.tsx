"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageCircle, Search, Settings, SquarePen, UserPlus, UserRound } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Logo } from "@/components/ui/Logo";
import { useSocial } from "@/components/social/SocialProvider";
import { NotificationCenter } from "@/components/social/NotificationCenter";
import { WalletPill } from "./WalletPill";

const TITLES: Record<string, string> = {
  "/library": "Jeux",
  "/community": "Communauté",
  "/messages": "Messages",
  "/profile": "Profil",
  "/friends": "Mes amis",
  "/voice": "Salons vocaux",
  "/shop": "Boutique",
  "/settings": "Paramètres",
  "/classement": "Classement",
};

function pageTitle(pathname: string) {
  if (pathname.startsWith("/profile/")) return "Profil joueur";
  if (pathname.startsWith("/settings")) return "Paramètres";
  if (pathname === "/favorites") return "Mes favoris";
  if (pathname === "/recent") return "Récemment joués";
  if (pathname === "/new") return "Nouveautés";
  if (pathname === "/chat") return "Chat général";
  return TITLES[pathname] ?? "Revanche Games";
}

export function Header() {
  const pathname = usePathname();
  const { me, dmUnread } = useSocial();
  const unread = [...dmUnread.values()].reduce((sum, count) => sum + count, 0);

  return (
    <header className="rg-app-header" style={{ height: "var(--rg-header-h)", paddingTop: "var(--rg-safe-top)" }}>
      <div className="rg-header-brand">
        {pathname === "/" ? <Logo /> : <h1>{pageTitle(pathname)}</h1>}
      </div>
      <div className="rg-header-tools">
        {pathname === "/community" && <Link href="/friends" className="rg-icon-button" aria-label="Ajouter un ami"><UserPlus /></Link>}
        {pathname === "/messages" && <Link href="/friends" className="rg-icon-button" aria-label="Nouvelle conversation"><SquarePen /></Link>}
        {pathname === "/profile" && <Link href="/settings" className="rg-icon-button" aria-label="Paramètres"><Settings /></Link>}
        {pathname === "/library" && <Link href="/library?search=1" className="rg-icon-button" aria-label="Rechercher un jeu"><Search /></Link>}
        {me && <Link href="/profile" className="rg-header-player" aria-label={`Profil de ${me.username}`}>
          <Avatar username={me.username} avatarUrl={me.avatarUrl} size="sm" />
          <span>{me.username}</span>
        </Link>}
        <div className="rg-desktop-wallet"><WalletPill /></div>
        <Link href="/messages" aria-label={`Messages${unread ? `, ${unread} non lus` : ""}`} className="rg-icon-button rg-desktop-message">
          <MessageCircle className="h-4 w-4" />{unread > 0 && <span className="rg-count">{unread > 99 ? "99+" : unread}</span>}
        </Link>
        {!me && <Link href="/sign-in" aria-label="Se connecter" className="rg-header-login"><UserRound /></Link>}
        <NotificationCenter />
      </div>
    </header>
  );
}
