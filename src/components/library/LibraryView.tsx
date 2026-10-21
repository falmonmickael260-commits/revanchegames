"use client";

import { Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { SearchX } from "lucide-react";
import { GAMES } from "@/data/games";
import type { GameCategory } from "@/types/game";
import { PageHeader } from "@/components/ui/PageHeader";
import { SectionBanner } from "@/components/ui/SectionBanner";
import { CategoryFilter } from "./CategoryFilter";
import { GameGrid } from "./GameGrid";
import { EmptyState } from "./EmptyState";
import { FeaturedCarousel } from "./FeaturedCarousel";
import { Shelf } from "./Shelf";

const FEATURED_IDS = ["president", "neon-hockey", "la-meute", "fortune-empire", "kilomax", "quiz-master"];

/**
 * The app's main screen: the full, searchable, filterable catalog.
 * Rendered directly on "/" (Accueil) and "/library" (Tous les jeux) — both
 * land here immediately, no landing-page detour before reaching real content.
 */
function LibraryContent() {
  const searchParams = useSearchParams();
  const query = (searchParams.get("q") ?? "").trim().toLowerCase();
  const category = searchParams.get("category") as GameCategory | null;
  const browsing = !query && !category;

  const filtered = useMemo(() => {
    return GAMES.filter((game) => {
      const matchesQuery = query ? game.name.toLowerCase().includes(query) : true;
      const matchesCategory = category ? game.categories.includes(category) : true;
      return matchesQuery && matchesCategory;
    });
  }, [query, category]);

  const availableCount = useMemo(() => GAMES.filter((g) => g.enabled).length, []);
  const featured = useMemo(
    () => FEATURED_IDS.map((id) => GAMES.find((g) => g.id === id)).filter((g): g is (typeof GAMES)[number] => !!g),
    [],
  );
  const availableGames = useMemo(() => GAMES.filter((g) => g.enabled), []);

  return (
    <div className="flex flex-col gap-7 overflow-x-hidden py-6">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          eyebrow="Revanche Games"
          title="Bibliothèque"
          subtitle={`${GAMES.length} jeux au catalogue — ${availableCount} disponibles, ${
            GAMES.length - availableCount
          } en développement.`}
        />
      </div>

      {browsing && (
        <>
          <section className="relative mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
            <div
              className="pointer-events-none absolute -inset-x-10 -top-16 -bottom-10 -z-10 opacity-60"
              style={{
                background:
                  "radial-gradient(ellipse 50% 60% at 15% 20%, rgba(178,75,255,0.16), transparent 70%), radial-gradient(ellipse 45% 55% at 85% 60%, rgba(47,230,255,0.14), transparent 70%)",
              }}
            />
            <div className="mb-3">
              <SectionBanner label="En vedette" color="#b24bff" />
            </div>
            <FeaturedCarousel games={featured} />
          </section>

          <section className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mb-3">
              <SectionBanner label="Disponibles maintenant" color="#2fe6ff" />
            </div>
            <Shelf games={availableGames} />
          </section>
        </>
      )}

      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 sm:px-6 lg:px-8">
        <SectionBanner
          label={browsing ? "Toute la bibliothèque" : "Résultats"}
          color={browsing ? "#f2994a" : "#2fe6ff"}
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
