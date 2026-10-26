"use client";

import { useState } from "react";
import { Flag, X } from "lucide-react";
import { submitReport, type ReportKind } from "@/lib/social/api";

const DETAILS_MAX = 1000;

/** Motifs proposés quand on signale un joueur. */
const PLAYER_REASONS: { value: ReportKind; label: string; hint: string }[] = [
  { value: "avatar", label: "Photo de profil", hint: "Image choquante, nudité, contenu inapproprié" },
  { value: "signature", label: "Signature", hint: "Texte insultant ou déplacé" },
  { value: "username", label: "Pseudonyme", hint: "Pseudonyme offensant ou usurpé" },
  { value: "behaviour", label: "Comportement", hint: "Triche, harcèlement, propos haineux" },
  { value: "message", label: "Messages", hint: "Messages privés ou publics déplacés" },
  { value: "other", label: "Autre", hint: "Décris le problème ci-dessous" },
];

/** Motifs proposés quand on signale un problème sans viser personne. */
const ISSUE_REASONS: { value: ReportKind; label: string; hint: string }[] = [
  { value: "bug", label: "Problème technique", hint: "Quelque chose ne fonctionne pas" },
  { value: "other", label: "Autre", hint: "Décris le problème ci-dessous" },
];

/**
 * Signaler un joueur, ou signaler un souci.
 *
 * Deux usages dans le même composant parce que c'est le même formulaire et la
 * même table : `target` renseigné, on signale quelqu'un ; `target` absent, on
 * remonte un problème (depuis l'écran de jeu ou les paramètres).
 *
 * Aucune règle n'est appliquée ici : la fonction SQL `submit_report` vérifie
 * l'identité, interdit de se signaler soi-même, limite à dix envois par heure
 * et refuse un second dossier ouvert sur le même motif.
 */
export function ReportDialog({
  target,
  context,
  onClose,
}: {
  /** Le joueur visé. Absent : signalement d'un problème, sans cible. */
  target?: { id: string; username: string };
  /** Où le problème a été rencontré — slug de jeu, salon, page. */
  context?: string;
  onClose: () => void;
}) {
  const reasons = target ? PLAYER_REASONS : ISSUE_REASONS;

  const [kind, setKind] = useState<ReportKind>(reasons[0].value);
  const [details, setDetails] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function submit() {
    setPending(true);
    setError("");
    const result = await submitReport({
      kind,
      targetUserId: target?.id ?? null,
      context: context ?? null,
      details: details.trim() || null,
    });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSent(true);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={target ? `Signaler ${target.username}` : "Signaler un problème"}
      className="fixed inset-0 z-[70] flex items-end justify-center bg-void/80 p-3 backdrop-blur-sm sm:items-center"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[85dvh] w-full max-w-sm flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_12px_48px_rgba(0,0,0,0.6)]">
        <header className="flex shrink-0 items-start justify-between gap-2 border-b border-border-soft px-4 py-3">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 font-display text-sm font-semibold text-text">
              <Flag className="h-4 w-4 text-violet-soft" />
              {target ? `Signaler ${target.username}` : "Signaler un problème"}
            </p>
            <p className="mt-0.5 font-body text-[11px] text-text-faint">
              {target
                ? "Ton signalement est confidentiel — la personne n'en est pas informée."
                : "Décris ce qui ne va pas, on regardera."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="shrink-0 rounded-lg p-1 text-text-faint hover:text-text"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        {sent ? (
          <div className="flex flex-col gap-3 p-4">
            <p className="font-body text-sm text-text-dim">
              Signalement envoyé. Merci — il sera examiné.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-gradient-to-r from-cyan to-violet px-4 py-2 font-display text-sm font-semibold text-void"
            >
              Fermer
            </button>
          </div>
        ) : (
          <>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
              <fieldset className="flex flex-col gap-1.5">
                <legend className="mb-1.5 font-display text-xs font-semibold uppercase tracking-[0.15em] text-text-faint">
                  Motif
                </legend>
                {reasons.map((reason) => (
                  <label
                    key={reason.value}
                    className={`flex cursor-pointer items-start gap-2.5 rounded-xl border px-3 py-2.5 transition-colors ${
                      kind === reason.value
                        ? "border-cyan/50 bg-cyan/[0.06]"
                        : "border-border-soft bg-void hover:border-border"
                    }`}
                  >
                    <input
                      type="radio"
                      name="report-kind"
                      value={reason.value}
                      checked={kind === reason.value}
                      onChange={() => setKind(reason.value)}
                      className="mt-0.5 shrink-0 accent-cyan"
                    />
                    <span className="min-w-0">
                      <span className="block font-display text-sm font-semibold text-text">
                        {reason.label}
                      </span>
                      <span className="block font-body text-[11px] text-text-faint">
                        {reason.hint}
                      </span>
                    </span>
                  </label>
                ))}
              </fieldset>

              <label className="mt-4 flex flex-col gap-1.5">
                <span className="font-display text-xs font-semibold uppercase tracking-[0.15em] text-text-faint">
                  Détails {target ? "(facultatif)" : ""}
                </span>
                <textarea
                  value={details}
                  onChange={(event) => setDetails(event.target.value.slice(0, DETAILS_MAX))}
                  rows={4}
                  placeholder="Ce qui s'est passé, où, quand…"
                  // text-base sous sm : en dessous de 16 px, iOS Safari zoome
                  // au focus et sort le formulaire de l'écran.
                  className="w-full resize-none rounded-lg border border-border-soft bg-void px-3 py-2.5 font-body text-base text-text placeholder:text-text-faint focus:border-cyan/50 focus:outline-none sm:text-sm"
                />
                <span className="text-right font-body text-[11px] text-text-faint">
                  {details.length} / {DETAILS_MAX}
                </span>
              </label>

              {error && <p className="mt-2 font-body text-xs text-violet-soft">{error}</p>}
            </div>

            <div className="flex shrink-0 gap-2 border-t border-border-soft p-4">
              <button
                type="button"
                disabled={pending}
                onClick={submit}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-cyan to-violet px-4 py-2.5 font-display text-sm font-semibold text-void disabled:opacity-50"
              >
                <Flag className="h-4 w-4" />
                {pending ? "Envoi…" : "Envoyer le signalement"}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={onClose}
                className="rounded-lg border border-border-soft px-4 py-2.5 font-display text-sm font-semibold text-text-dim disabled:opacity-50"
              >
                Annuler
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
