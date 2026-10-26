"use client";

import { useEffect, useState } from "react";
import { BellRing, X } from "lucide-react";
import { useSocial } from "./SocialProvider";
import { createLocalStore } from "@/lib/create-local-store";
import {
  isPushSupported,
  isStandaloneDisplay,
  readPushState,
  subscribeToPush,
} from "@/lib/push-client";

/** Une fois refusée, la proposition ne revient plus — voir SocialSettings pour l'activer plus tard. */
const dismissedStore = createLocalStore<boolean>("push-install-prompt-dismissed", false);

/**
 * Propose l'activation des notifications, mais seulement au moment où elle a
 * une chance d'aboutir : une fois Revanche Games ajouté à l'écran d'accueil
 * (`display-mode: standalone`), jamais dans un onglet de navigateur ordinaire
 * qui n'a pas vocation à rester ouvert en arrière-plan.
 *
 * Trois règles tenues ici, pour ne jamais prétendre ou insister :
 *  • ne s'affiche que si le push est réellement possible sur cet appareil
 *    (`isPushSupported`) et pas déjà actif ou refusé (`readPushState`) ;
 *  • l'autorisation système n'est demandée qu'au clic sur « Activer », jamais
 *    à l'affichage de la bannière ;
 *  • un rejet (la croix) est définitif — mémorisé en local, jamais réaffiché.
 *    Le réglage reste accessible depuis /settings à tout moment.
 */
export function PushInstallPrompt() {
  const { me } = useSocial();
  const [dismissed] = dismissedStore.useValue();
  const [eligible, setEligible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    // Pas de remise à zéro ici : `visible` plus bas tient déjà compte de
    // `me` et `dismissed`. Appeler setState dans le corps d'un effet
    // déclencherait un rendu en cascade pour rien.
    if (!me || dismissed) return;
    let cancelled = false;
    (async () => {
      if (!isStandaloneDisplay() || !isPushSupported()) return;
      const state = await readPushState();
      if (!cancelled && state === "idle") setEligible(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [me, dismissed]);

  // Dérivé : déconnexion ou rejet font disparaître la bannière sans qu'on
  // ait à réécrire `eligible`.
  const visible = eligible && Boolean(me) && !dismissed && !done;
  if (!visible) return null;

  async function activate() {
    setBusy(true);
    setError("");
    const result = await subscribeToPush();
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? "Activation impossible.");
      return;
    }
    setDone(true);
  }

  function dismiss() {
    dismissedStore.set(true);
  }

  return (
    <section
      aria-label="Activer les notifications"
      className="fixed left-2 right-2 z-50 mx-auto flex max-w-sm items-start gap-3 rounded-2xl border border-cyan/30 bg-surface/98 p-3.5 shadow-[0_12px_48px_rgba(0,0,0,0.6)] backdrop-blur-lg sm:left-auto sm:right-4"
      style={{ bottom: "calc(0.75rem + var(--rg-bottom-nav-h))" }}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-r from-cyan to-violet">
        <BellRing className="h-4 w-4 text-void" strokeWidth={2} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-display text-sm font-semibold text-text">Activer les notifications ?</p>
        <p className="mt-0.5 font-body text-xs text-text-faint">
          Sois prévenu d&apos;une invitation ou d&apos;une demande d&apos;ami même quand
          Revanche Games est fermé.
        </p>
        {error && <p className="mt-1.5 font-body text-xs text-violet-soft">{error}</p>}
        <div className="mt-2.5 flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={activate}
            className="rounded-lg bg-gradient-to-r from-cyan to-violet px-3 py-1.5 font-display text-xs font-semibold text-void disabled:opacity-50"
          >
            {busy ? "…" : "Activer"}
          </button>
          <button
            type="button"
            onClick={dismiss}
            className="rounded-lg border border-border-soft px-3 py-1.5 font-display text-xs font-semibold text-text-dim"
          >
            Plus tard
          </button>
        </div>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Ne plus proposer"
        className="shrink-0 rounded-lg p-1 text-text-faint hover:text-text"
      >
        <X className="h-4 w-4" />
      </button>
    </section>
  );
}
