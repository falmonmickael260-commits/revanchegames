import { LibraryView } from "@/components/library/LibraryView";
import { PlatformPulse } from "@/components/platform/PlatformPulse";

export default function HomePage() {
  return (
    <>
      {/* Les chiffres réels de la plateforme, au-dessus du catalogue. Rendus
          côté serveur et derrière leur propre Suspense : la coquille de
          l'accueil reste statique, le comptage arrive en streaming. */}
      <div className="mx-auto w-full max-w-7xl px-4 pt-5 sm:px-6 lg:px-8">
        <PlatformPulse />
      </div>
      <LibraryView />
    </>
  );
}
