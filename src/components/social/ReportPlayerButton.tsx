"use client";

import { useState } from "react";
import { Flag } from "lucide-react";
import { ReportDialog } from "./ReportDialog";

/**
 * Bouton « Signaler » d'une fiche de profil.
 *
 * Composant client minimal, pour que la page de profil reste rendue côté
 * serveur : seul ce bouton a besoin d'interactivité.
 */
export function ReportPlayerButton({
  targetId,
  username,
}: {
  targetId: string;
  username: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Signaler ${username}`}
        title={`Signaler ${username}`}
        className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border-soft px-2.5 py-1.5 font-display text-xs font-semibold text-text-faint transition-colors hover:border-violet/40 hover:text-violet-soft"
      >
        <Flag className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Signaler</span>
      </button>

      {open && (
        <ReportDialog
          target={{ id: targetId, username }}
          context={`profil:${targetId}`}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
