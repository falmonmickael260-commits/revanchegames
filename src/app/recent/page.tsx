import Link from "next/link";
import { History } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/library/EmptyState";

export default function RecentPage() {
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="Historique"
        title="Récemment joués"
        subtitle="Vos dernières parties apparaîtront ici."
      />
      <EmptyState
        icon={History}
        title="Pas encore de partie"
        message="Le suivi des parties arrivera avec le compte joueur Revanche Games. En attendant, lancez un jeu disponible depuis la bibliothèque."
        action={
          <Link
            href="/library"
            className="rounded-full border border-border-soft bg-surface px-4 py-2 font-body text-sm text-text-dim transition-colors hover:border-border hover:text-text"
          >
            Voir la bibliothèque
          </Link>
        }
      />
    </div>
  );
}
