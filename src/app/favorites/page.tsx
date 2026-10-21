"use client";

import Link from "next/link";
import { Heart } from "lucide-react";
import { GAMES } from "@/data/games";
import { PageHeader } from "@/components/ui/PageHeader";
import { GameGrid } from "@/components/library/GameGrid";
import { EmptyState } from "@/components/library/EmptyState";
import { useFavorites } from "@/lib/use-favorites";

export default function FavoritesPage() {
  const { favorites } = useFavorites();
  const games = GAMES.filter((g) => favorites.includes(g.id));

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="Collection"
        title="Mes favoris"
        subtitle="Les jeux que vous gardez à l'œil — même avant qu'ils soient jouables."
      />

      {games.length > 0 ? (
        <GameGrid games={games} />
      ) : (
        <EmptyState
          icon={Heart}
          title="Aucun favori pour l'instant"
          message="Cliquez sur le cœur d'une carte pour l'ajouter ici. Vos favoris restent sur cet appareil."
          action={
            <Link
              href="/library"
              className="rounded-full border border-border-soft bg-surface px-4 py-2 font-body text-sm text-text-dim transition-colors hover:border-border hover:text-text"
            >
              Parcourir la bibliothèque
            </Link>
          }
        />
      )}
    </div>
  );
}
