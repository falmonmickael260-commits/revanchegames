import type { LucideIcon } from "lucide-react";
import { Home, LayoutGrid, Heart, History, Sparkles, Coins, MessageCircle, Users, User, Settings, Trophy } from "lucide-react";

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
  { id: "leaderboard", label: "Classement", href: "/classement", icon: Trophy },
  { id: "shop", label: "Boutique", href: "/shop", icon: Coins },
  { id: "chat", label: "Chat général", href: "/chat", icon: MessageCircle },
  { id: "friends", label: "Amis", href: "/friends", icon: Users },
  { id: "profile", label: "Profil", href: "/profile", icon: User },
  { id: "settings", label: "Paramètres", href: "/settings", icon: Settings },
];

/**
 * Ce que la barre d'onglets du bas montre sur mobile.
 *
 * Cinq entrées maximum : au-delà, les libellés se chevauchent sur un écran
 * de 375 px. « Amis » y figure parce que c'est de là que partent les
 * invitations, et que la barre latérale qui le proposait n'existe pas sur
 * mobile. Les paramètres, eux, sont atteignables depuis la page Profil —
 * c'est là qu'on active les notifications, qui ne servent que sur téléphone.
 */
export const MOBILE_NAV_IDS = ["home", "library", "friends", "chat", "profile"];
