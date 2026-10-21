import { GAMES } from "@/data/games";
import { PageHeader } from "@/components/ui/PageHeader";
import { GameGrid } from "@/components/library/GameGrid";

export default function NewPage() {
  const sorted = [...GAMES].sort((a, b) => b.addedAt.localeCompare(a.addedAt));

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="Fraîchement ajouté"
        title="Nouveautés"
        subtitle="Toute la bibliothèque est nouvelle dans cette première version de Revanche Games — les 17 jeux viennent d'y entrer."
      />
      <GameGrid games={sorted} />
    </div>
  );
}
