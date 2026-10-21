import {
  MessageCircle,
  Flag,
  Ban,
  MoonStar,
  Castle,
  Users,
  BrainCircuit,
  Crown,
  Layers,
  Grid3x3,
  AlertTriangle,
  Bomb,
  Target,
  Drama,
  Wallet,
  Dices,
  CircleDot,
  type LucideIcon,
} from "lucide-react";
import type { GameIconKey } from "@/types/game";

/**
 * Resolves a game's icon key to its component. Kept as a lookup (rather than
 * storing component references on the game data itself) so game data stays
 * plain, serializable JSON that can cross the server/client boundary freely.
 */
export const GAME_ICON_MAP: Record<GameIconKey, LucideIcon> = {
  "message-circle": MessageCircle,
  flag: Flag,
  ban: Ban,
  "moon-star": MoonStar,
  castle: Castle,
  users: Users,
  "brain-circuit": BrainCircuit,
  crown: Crown,
  layers: Layers,
  grid: Grid3x3,
  "alert-triangle": AlertTriangle,
  bomb: Bomb,
  target: Target,
  drama: Drama,
  wallet: Wallet,
  dices: Dices,
  "circle-dot": CircleDot,
};
