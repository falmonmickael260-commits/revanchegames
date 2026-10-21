"use client";

import { Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { SearchX } from "lucide-react";
import { GAMES } from "@/data/games";
import type { GameCategory } from "@/types/game";
import { PageHeader } from "@/components/ui/PageHeader";
import { CategoryFilter } from "./CategoryFilter";
import { GameGrid } from "./GameGrid";
import { EmptyState } from "./EmptyState";

/**
 * The app's main screen: the full, searchable, filterable catalog.
 * Rendered directly on "/" (Accueil) and "/library" (Tous les jeux) — both
 * land here immediately, no landing-page detour before reaching real content.
 */
function LibraryContent() {
  const searchParams = useSearchParams();
  const query = (searchParams.get("q") ?? "").trim().toLowerCase();
  const category = searchParams.get("category") as GameCategory | null;

  const filtered = useMemo(() => {
    return GAMES.filter((game) => {
      const matchesQuery = query ? game.name.toLowerCase().includes(query) : true;
      const matchesCategory = category ? game.categories.includes(category) : true;
      return matchesQuery && matchesCategory;
    });
  }, [query, category]);

  const availableCount = useMemo(() => GAMES.filter((g) => g.enabled).length, []);

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="Revanche Games"
        title="Bibliothèque"
        subtitle={`${GAMES.length} jeux au catalogue — ${availableCount} disponibles, ${
          GAMES.length - availableCount
        } en développement.`}
      />

      <CategoryFilter />

      {filtered.length > 0 ? (
        <GameGrid games={filtered} />
      ) : (
        <EmptyState
          icon={SearchX}
          title="Aucun résultat"
          message={`Aucun jeu ne correspond à « ${searchParams.get("q") ?? ""} ». Essayez un autre terme ou une autre catégorie.`}
        />
      )}
    </div>
  );
}

export function LibraryView() {
  return (
    <Suspense>
      <LibraryContent />
    </Suspense>
  );
}
