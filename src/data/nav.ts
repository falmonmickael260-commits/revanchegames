import type { LucideIcon } from "lucide-react";
import { Home, LayoutGrid, Heart, History, Sparkles, Coins, MessageCircle, Headphones, Users, User, Settings, Trophy } from "lucide-react";

export type NavItem = {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
};

export const NAV_ITEMS: NavItem[] = [
  { id: "home", label: "Accueil", href: "/", icon: Home },
  { id: "library", label: "Tous les jeux", href: "/library", icon: LayoutGrid },
  { id: "community", label: "Communauté", href: "/community", icon: Users },
  { id: "messages", label: "Messages", href: "/messages", icon: MessageCircle },
  { id: "favorites", label: "Mes favoris", href: "/favorites", icon: Heart },
  { id: "recent", label: "Récemment joués", href: "/recent", icon: History },
  { id: "new", label: "Nouveautés", href: "/new", icon: Sparkles },
  { id: "leaderboard", label: "Classement", href: "/classement", icon: Trophy },
  { id: "shop", label: "Boutique", href: "/shop", icon: Coins },
  { id: "chat", label: "Chat général", href: "/chat", icon: MessageCircle },
  { id: "voice", label: "Salons vocaux", href: "/voice", icon: Headphones },
  { id: "friends", label: "Amis", href: "/friends", icon: Users },
  { id: "profile", label: "Profil", href: "/profile", icon: User },
  { id: "settings", label: "Paramètres", href: "/settings", icon: Settings },
];

/** Five stable mobile destinations; all secondary spaces remain accessible. */
export const MOBILE_NAV_IDS = ["home", "library", "community", "messages", "profile"];
