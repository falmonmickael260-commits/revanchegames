import { Lock } from "lucide-react";
import { CoinStack } from "./CoinStack";

export function CoinPackCard({
  coins,
  price,
  highlight = false,
}: {
  coins: number;
  price: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`relative flex flex-col items-center gap-4 rounded-2xl border px-6 py-8 text-center transition-colors ${
        highlight ? "border-amber/40 bg-surface-raised" : "border-border-soft bg-surface"
      }`}
    >
      <span className="inline-flex items-center gap-1.5 rounded-full border border-border-soft bg-void/70 px-2.5 py-1 font-display text-[10px] font-semibold uppercase tracking-[0.15em] text-text-dim backdrop-blur-sm">
        <span className="h-1.5 w-1.5 rounded-full bg-amber shadow-[0_0_6px_var(--rg-amber)]" />
        Bientôt disponible
      </span>

      <CoinStack size={80} />

      <div>
        <p className="font-display text-3xl font-bold tracking-wide text-text">
          {coins.toLocaleString("fr-FR")}
        </p>
        <p className="font-body text-xs uppercase tracking-[0.2em] text-text-faint">pièces Revanche</p>
      </div>

      <p className="font-display text-lg font-semibold text-amber">{price}</p>

      <button
        type="button"
        disabled
        aria-disabled="true"
        tabIndex={-1}
        title="Ce pack n'est pas encore disponible"
        className="mt-1 flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl bg-surface-raised px-4 py-2.5 font-display text-xs font-bold uppercase tracking-wider text-text-faint"
      >
        <Lock className="h-3.5 w-3.5" strokeWidth={2.5} />
        Acheter
      </button>
    </div>
  );
}
