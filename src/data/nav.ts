import type { LucideIcon } from "lucide-react";
import { Home, LayoutGrid, Heart, History, Sparkles, Coins, MessageCircle, Users, User, Settings } from "lucide-react";

export type NavItem = {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
};

export const NAV_ITEMS: NavItem[] = [
  { id: "home", label: "Accueil", href: "/", icon: Home },
  { id: "library", label: "Tous les jeux", href: "/library", icon: LayoutGrid },
  { id: "favorites", label: "Mes favoris", href: "/favorites", icon: Heart },
  { id: "recent", label: "Récemment joués", href: "/recent", icon: History },
  { id: "new", label: "Nouveautés", href: "/new", icon: Sparkles },
  { id: "shop", label: "Boutique", href: "/shop", icon: Coins },
  { id: "chat", label: "Chat général", href: "/chat", icon: MessageCircle },
  { id: "friends", label: "Amis", href: "/friends", icon: Users },
  { id: "profile", label: "Profil", href: "/profile", icon: User },
  { id: "settings", label: "Paramètres", href: "/settings", icon: Settings },
];

/** Subset surfaced in the mobile bottom bar — kept short for thumb reach. */
export const MOBILE_NAV_IDS = ["home", "library", "chat", "profile"];
