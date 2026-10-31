"use client";

import { useState, type FormEvent } from "react";
import { Sparkles, Ticket } from "lucide-react";
import { redeemPromoCode } from "@/lib/wallet-api";

/**
 * Section « Vous avez un code promo ? » de la boutique.
 *
 * Toute la logique (unicité par compte, plafond, expiration, atomicité du
 * crédit) vit dans la fonction SQL `redeem_promo_code` — ce composant ne fait
 * qu'afficher son résultat. Le solde affiché dans l'en-tête se met à jour
 * tout seul (useWallet est en écoute temps réel sur wallet_accounts).
 */
export function PromoCodeForm() {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [celebrate, setCelebrate] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) return;

    setBusy(true);
    setResult(null);
    const outcome = await redeemPromoCode(trimmed);
    setBusy(false);

    if (!outcome.ok) {
      setResult({ kind: "error", text: outcome.error });
      return;
    }

    setResult({
      kind: "success",
      text: `Félicitations ! Tu as reçu ${outcome.data.rewardCoins.toLocaleString("fr-FR")} pièces Revanche !`,
    });
    setCode("");
    setCelebrate(true);
    setTimeout(() => setCelebrate(false), 1400);
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-cyan/25 bg-gradient-to-br from-surface to-surface-raised p-5">
      {celebrate && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          {Array.from({ length: 10 }).map((_, i) => (
            <span
              key={i}
              className="absolute top-0 text-lg"
              style={{
                left: `${8 + i * 9}%`,
                animation: `rg-coin-fall 1.1s ease-in ${i * 0.05}s both`,
              }}
            >
              🪙
            </span>
          ))}
          <style>{`
            @keyframes rg-coin-fall {
              0% { transform: translateY(-10px) rotate(0deg); opacity: 0; }
              15% { opacity: 1; }
              100% { transform: translateY(160px) rotate(220deg); opacity: 0; }
            }
          `}</style>
        </div>
      )}

      <div className="flex items-center gap-2">
        <Ticket className="h-4 w-4 text-cyan" strokeWidth={2} />
        <h2 className="font-display text-sm font-semibold uppercase tracking-[0.18em] text-text-faint">
          Vous avez un code promo ?
        </h2>
      </div>

      <form onSubmit={handleSubmit} className="mt-3 flex flex-col gap-2.5 sm:flex-row">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Code Games"
          maxLength={32}
          aria-label="Code promotionnel"
          className="w-full rounded-lg border border-border-soft bg-void px-3.5 py-2.5 font-body text-base uppercase tracking-wide text-text placeholder:text-text-faint placeholder:normal-case focus:border-cyan/50 focus:outline-none focus:ring-2 focus:ring-cyan/20 sm:text-sm"
        />
        <button
          type="submit"
          disabled={busy || !code.trim()}
          className="flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-cyan to-violet px-5 py-2.5 font-display text-sm font-semibold text-void disabled:opacity-50"
        >
          <Sparkles className="h-4 w-4" />
          {busy ? "…" : "Valider"}
        </button>
      </form>

      {result && (
        <p
          className={`mt-2.5 font-body text-sm ${result.kind === "success" ? "text-cyan" : "text-violet-soft"}`}
        >
          {result.text}
        </p>
      )}
    </div>
  );
}
