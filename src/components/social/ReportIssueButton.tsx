"use client";

import { useState } from "react";
import { Flag, LifeBuoy } from "lucide-react";
import { ReportDialog } from "./ReportDialog";
import { useSocial } from "./SocialProvider";

/**
 * « Un souci ? » — signaler un problème technique, sans viser personne.
 *
 * Placé dans les paramètres et dans l'écran de jeu, les deux endroits où l'on
 * se trouve quand quelque chose ne va pas. `context` note d'où part le
 * signalement (jeu, salon, page), ce qui évite de devoir le demander au
 * joueur.
 *
 * Réservé aux comptes connectés : `submit_report` exige une identité, et un
 * signalement anonyme ne serait de toute façon pas exploitable.
 */
export function ReportIssueButton({
  context,
  gameName,
  variant = "row",
  className = "",
}: {
  context?: string;
  gameName?: string;
  /** "tab" dans la barre commune à tous les jeux. */
  variant?: "row" | "icon" | "tab";
  className?: string;
}) {
  const { me } = useSocial();
  const [open, setOpen] = useState(false);

  if (!me) return null;

  return (
    <>
      {variant === "tab" ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          title="Signaler un problème technique, de la triche ou un comportement déplacé"
          className={`inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg border border-cyan/30 bg-cyan/5 px-2 font-display text-xs font-semibold text-cyan transition-colors hover:bg-cyan/15 ${className}`}
        >
          <Flag className="h-4 w-4 shrink-0" aria-hidden="true" />
          Signalement
        </button>
      ) : variant === "icon" ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Signaler un problème"
          title="Signaler un problème"
          className={`rounded-lg p-2 text-text-faint transition-colors hover:bg-surface hover:text-text ${className}`}
        >
          <LifeBuoy className="h-4 w-4" />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={`flex w-full items-start gap-3 rounded-xl border border-border-soft bg-surface px-4 py-3.5 text-left transition-colors hover:border-border ${className}`}
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-raised">
            <LifeBuoy className="h-4 w-4 text-cyan" strokeWidth={2} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-display text-sm font-semibold text-text">
              Signaler un problème
            </span>
            <span className="block font-body text-xs text-text-faint">
              Un jeu qui ne se lance pas, un affichage cassé, un comportement
              déplacé — dis-nous ce qui s&apos;est passé.
            </span>
          </span>
        </button>
      )}

      {open && <ReportDialog context={context} gameName={gameName} onClose={() => setOpen(false)} />}
    </>
  );
}
