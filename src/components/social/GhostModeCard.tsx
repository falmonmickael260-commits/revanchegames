"use client";

import { useState } from "react";
import { Ghost } from "lucide-react";
import { useSocial } from "./SocialProvider";
import { updatePrivacy } from "@/lib/social/api";

/**
 * Le mode fantôme, directement sur la fiche de profil.
 *
 * Il était jusqu'ici dans les paramètres seulement. C'est pourtant une
 * décision qu'on prend *au moment* où l'on veut jouer tranquille, pas en
 * explorant des réglages — donc sa place est là où l'on arrive en ouvrant son
 * profil, à côté de son pseudonyme et de son avatar.
 *
 * Le réglage reste unique : c'est la même colonne `profiles.ghost_mode` que
 * celle des paramètres, et `SocialProvider` étant monté dans la coquille, les
 * deux écrans se mettent à jour ensemble — basculer ici change aussi
 * l'affichage dans les paramètres, sans rechargement.
 *
 * Ce que le mode fantôme fait réellement (voir `use-presence.ts`) : on cesse
 * de publier sa présence, donc les amis voient « hors ligne ». Les demandes
 * d'ami, les invitations et les messages continuent d'arriver normalement —
 * c'est une invisibilité, pas une coupure.
 */
export function GhostModeCard() {
  const { me } = useSocial();
  // Bascule optimiste : la valeur du profil reprend la main si l'écriture
  // échoue, sans effet de synchronisation.
  const [override, setOverride] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!me) return null;

  const active = override ?? me.ghostMode;

  async function toggle() {
    const next = !active;
    setBusy(true);
    setError("");
    setOverride(next);

    const result = await updatePrivacy({ ghost_mode: next });
    setBusy(false);

    if (!result.ok) {
      setOverride(null);
      setError(result.error);
    }
  }

  return (
    <div
      className={`flex items-start gap-3 rounded-2xl border px-4 py-3.5 transition-colors ${
        active ? "border-violet/40 bg-violet/[0.07]" : "border-border-soft bg-surface"
      }`}
    >
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
          active ? "bg-violet/20" : "bg-surface-raised"
        }`}
      >
        <Ghost
          className={`h-5 w-5 ${active ? "text-violet-soft" : "text-text-faint"}`}
          strokeWidth={2}
        />
      </span>

      <div className="min-w-0 flex-1">
        <p className="font-display text-sm font-semibold text-text">
          Mode fantôme {active && <span className="text-violet-soft">· actif</span>}
        </p>
        <p className="mt-0.5 font-body text-xs text-text-faint">
          {active
            ? "Tu apparais hors ligne pour tes amis. Invitations et messages continuent d'arriver."
            : "Apparaître hors ligne pour tes amis, même connecté."}
        </p>
        {error && <p className="mt-1.5 font-body text-xs text-violet-soft">{error}</p>}
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={active}
        aria-label="Mode fantôme"
        disabled={busy}
        onClick={toggle}
        className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
          active ? "bg-gradient-to-r from-violet to-cyan" : "bg-surface-raised"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-void transition-transform ${
            active ? "translate-x-[1.375rem]" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );
}
