"use client";

import { Heart } from "lucide-react";
import { useFavorites } from "@/lib/use-favorites";
import { StatTile } from "@/components/ui/StatTile";

export function FavoritesTile() {
  const { favorites } = useFavorites();
  return <StatTile icon={Heart} label="Favoris" value={favorites.length} />;
}
