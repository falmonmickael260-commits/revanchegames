"use client";

import { useRef, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Search, User, Settings, X } from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { NotificationCenter } from "@/components/social/NotificationCenter";
import { WalletPill } from "./WalletPill";

export function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // "/" (Accueil) and "/library" (Tous les jeux) both render the full catalog —
  // search filters whichever of the two is already on screen, in place.
  const onLibraryRoute = pathname === "/" || pathname === "/library";
  // Lazy init only — the header stays mounted across client navigations, so
  // this captures the URL's `q` once rather than re-syncing from an effect.
  const [value, setValue] = useState(() => (onLibraryRoute ? searchParams.get("q") ?? "" : ""));
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleChange(next: string) {
    setValue(next);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const params = new URLSearchParams(onLibraryRoute ? searchParams.toString() : "");
      if (next) params.set("q", next);
      else params.delete("q");
      const target = onLibraryRoute ? pathname : "/";
      router.push(`${target}${params.toString() ? `?${params.toString()}` : ""}`);
    }, 220);
  }

  return (
    <header
      className="sticky top-0 z-30 flex shrink-0 items-center gap-3 border-b border-border-soft bg-void/80 px-4 backdrop-blur-lg sm:px-6"
      // Hauteur portee par la variable partagee plutot que deduite du padding :
      // les pages qui reservent la place de l'en-tete lisent la meme valeur.
      // `--rg-safe-top` ne vaut 0 qu'en navigateur ; en PWA installee sur iOS,
      // la vue s'etend sous la barre d'etat et il faut la compenser.
      style={{ height: "var(--rg-header-h)", paddingTop: "var(--rg-safe-top)" }}
    >
      <div className="lg:hidden">
        <Logo compact />
      </div>

      <div className="relative flex w-full max-w-md flex-1 items-center">
        <Search className="pointer-events-none absolute left-3.5 h-4 w-4 text-text-faint" strokeWidth={2} />
        <input
          type="text"
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="Rechercher un jeu…"
          aria-label="Rechercher un jeu"
          className="w-full rounded-full border border-border-soft bg-surface py-2.5 pl-10 pr-9 font-body text-sm text-text placeholder:text-text-faint focus:border-cyan/50 focus:outline-none focus:ring-2 focus:ring-cyan/20"
        />
        {value && (
          <button
            type="button"
            onClick={() => handleChange("")}
            aria-label="Effacer la recherche"
            className="absolute right-3 text-text-faint hover:text-text-dim"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* La cloche est visible a toutes les tailles, contrairement aux liens
          Parametres/Profil que la barre d'onglets du bas reprend sur mobile :
          une demande d'ami ou une invitation ne doit pas etre atteignable
          seulement sur ordinateur. */}
      <div className="ml-auto flex shrink-0 items-center gap-2">
        <WalletPill />
        <NotificationCenter />
      </div>

      <div className="hidden items-center gap-1 lg:flex">
        <Link
          href="/settings"
          aria-label="Paramètres"
          className="rounded-lg p-2 text-text-faint transition-colors hover:bg-surface hover:text-text-dim"
        >
          <Settings className="h-[18px] w-[18px]" strokeWidth={2} />
        </Link>
        <Link
          href="/profile"
          aria-label="Profil"
          className="rounded-lg p-2 text-text-faint transition-colors hover:bg-surface hover:text-text-dim"
        >
          <User className="h-[18px] w-[18px]" strokeWidth={2} />
        </Link>
      </div>
    </header>
  );
}
