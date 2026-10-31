import { Lock } from "lucide-react";
import { CoinStack } from "./CoinStack";

export function CoinPackCard({
  name,
  coins,
  price,
  highlight = false,
}: {
  name: string;
  coins: number;
  price: string;
  highlight?: boolean;
}) {
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
        Bientôt disponible
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
