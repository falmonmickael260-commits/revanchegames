"use client";

import { useRef, useState } from "react";
import { Lock } from "lucide-react";
import { CoinStack } from "./CoinStack";
import type { PackId } from "@/lib/stripe/catalog";

export function CoinPackCard({
  name,
  coins,
  price,
  highlight = false,
  packId,
  available = false,
  testMode = false,
}: {
  name: string;
  coins: number;
  price: string;
  highlight?: boolean;
  packId?: PackId;
  available?: boolean;
  testMode?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const requestId = useRef<string | null>(null);
  const inFlight = useRef(false);
  async function buy() {
    if (inFlight.current || !available || !packId) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    requestId.current ||= crypto.randomUUID();
    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packId, requestId: requestId.current }),
      });
      const result = await response.json();
      if (!response.ok) {
        if (response.status === 409) requestId.current = null;
        throw new Error(result.error || "Paiement indisponible.");
      }
      const url = new URL(result.url);
      if (url.origin !== "https://checkout.stripe.com") throw new Error("Lien de paiement invalide.");
      window.location.assign(url.href);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Paiement indisponible.");
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  return (
    <div
      className={`group relative flex flex-col items-center gap-4 rounded-2xl border px-6 py-8 text-center transition-all hover:-translate-y-0.5 ${
        highlight
          ? "border-amber/50 bg-surface-raised shadow-[0_0_0_1px_rgba(240,169,62,0.15),0_12px_32px_rgba(240,169,62,0.08)]"
          : "border-border-soft bg-surface hover:border-border"
      }`}
    >
      {highlight && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-amber to-cyan px-3 py-1 font-display text-[10px] font-bold uppercase tracking-[0.15em] text-void">
          Le plus populaire
        </span>
      )}

      <span className="inline-flex items-center gap-1.5 rounded-full border border-border-soft bg-void/70 px-2.5 py-1 font-display text-[10px] font-semibold uppercase tracking-[0.15em] text-text-dim backdrop-blur-sm">
        <span className="h-1.5 w-1.5 rounded-full bg-amber shadow-[0_0_6px_var(--rg-amber)]" />
        {available ? testMode ? "Mode test — aucun débit réel" : "Paiement sécurisé" : packId ? "Paiement indisponible" : "Bientôt disponible"}
      </span>

      <div className="transition-transform group-hover:scale-105">
        <CoinStack size={80} />
      </div>

      <p className="-mb-1.5 font-display text-sm font-semibold uppercase tracking-[0.2em] text-text-dim">
        {name}
      </p>

      <div>
        <p className="font-display text-3xl font-bold tracking-wide text-text">
          {coins.toLocaleString("fr-FR")}
        </p>
        <p className="font-body text-xs uppercase tracking-[0.2em] text-text-faint">pièces Revanche</p>
      </div>

      <p className="font-display text-lg font-semibold text-amber">{price}</p>

      <button
        type="button"
        disabled={!available || busy}
        onClick={buy}
        className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-amber px-4 py-2.5 font-display text-xs font-bold uppercase tracking-wider text-void disabled:cursor-not-allowed disabled:bg-surface-raised disabled:text-text-faint"
      >
        <Lock className="h-3.5 w-3.5" strokeWidth={2.5} />
        {busy ? "Ouverture…" : testMode && available ? "Tester l’achat" : "Acheter"}
      </button>
      {error && <p role="alert" className="font-body text-sm text-text-dim">{error}</p>}
    </div>
  );
}
