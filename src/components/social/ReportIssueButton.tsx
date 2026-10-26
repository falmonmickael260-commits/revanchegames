"use client";

import { useState } from "react";
import { LifeBuoy } from "lucide-react";
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
  variant = "row",
  className = "",
}: {
  context?: string;
  /** "row" dans les paramètres, "icon" dans la barre de jeu. */
  variant?: "row" | "icon";
  className?: string;
}) {
  const { me } = useSocial();
  const [open, setOpen] = useState(false);

  if (!me) return null;

  return (
    <>
      {variant === "icon" ? (
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

      {open && <ReportDialog context={context} onClose={() => setOpen(false)} />}
    </>
  );
}
