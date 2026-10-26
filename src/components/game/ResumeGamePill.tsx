"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Gamepad2, Play } from "lucide-react";
import { useGameSession } from "./GameSessionProvider";

/**
 * Accès permanent à la partie en cours, depuis n'importe quelle section.
 *
 * Ne s'affiche que lorsqu'une partie tourne réellement en arrière-plan — donc
 * jamais après un « Quitter la partie », et jamais après un rechargement
 * complet de la page : l'état de session vit en mémoire, et il serait
 * malhonnête de proposer de reprendre une partie que le serveur du jeu
 * considère comme terminée.
 */
export function ResumeGamePill() {
  const { active } = useGameSession();
  const [elapsed, setElapsed] = useState("");

  useEffect(() => {
    if (!active) return;

    function tick() {
      const seconds = Math.floor((Date.now() - active!.startedAt) / 1000);
      const minutes = Math.floor(seconds / 60);
      setElapsed(minutes < 1 ? "à l'instant" : `depuis ${minutes} min`);
    }

    tick();
    const timer = setInterval(tick, 30_000);
    return () => clearInterval(timer);
  }, [active]);

  if (!active) return null;

  return (
    <Link
      href={`/play/${active.slug}`}
      // Calé à gauche : le chat flottant occupe le coin droit.
      // `--rg-bottom-nav-h` inclut déjà la zone de sécurité du bas, donc la
      // pastille se place au-dessus de la barre d'onglets sur mobile et en bas
      // à gauche sur ordinateur, où cette barre n'existe pas.
      className="fixed left-3 z-50 flex items-center gap-2.5 rounded-full border border-cyan/35 bg-surface-raised/95 py-2 pl-2.5 pr-3.5 shadow-[0_6px_24px_rgba(0,0,0,0.45)] backdrop-blur transition-colors hover:border-cyan/60 sm:left-4"
      style={{ bottom: "calc(0.75rem + var(--rg-bottom-nav-h))" }}
    >
      <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan/25 to-violet/25">
        <Gamepad2 className="h-4 w-4 text-cyan" />
        {/* Témoin de partie active. */}
        <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-surface-raised bg-cyan" />
      </span>

      <span className="flex min-w-0 flex-col">
        <span className="truncate font-display text-xs font-semibold leading-tight text-text">
          {active.name}
        </span>
        <span className="truncate font-body text-[10px] leading-tight text-text-faint">
          Partie en cours {elapsed}
        </span>
      </span>

      <Play className="h-3.5 w-3.5 shrink-0 fill-cyan text-cyan" />
    </Link>
  );
}
