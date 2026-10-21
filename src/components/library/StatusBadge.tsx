import type { GameStatus } from "@/types/game";

const CONFIG: Record<GameStatus, { label: string; dot: string; glow: string }> = {
  available: { label: "Disponible", dot: "bg-cyan", glow: "shadow-[0_0_6px_var(--rg-cyan)]" },
  "coming-soon": { label: "Bientôt disponible", dot: "bg-amber", glow: "shadow-[0_0_6px_var(--rg-amber)]" },
  development: { label: "En développement", dot: "bg-amber", glow: "shadow-[0_0_6px_var(--rg-amber)]" },
};

export function StatusBadge({ status }: { status: GameStatus }) {
  const { label, dot, glow } = CONFIG[status];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border-soft bg-void/70 px-2.5 py-1 font-display text-[10px] font-semibold uppercase tracking-[0.15em] text-text-dim backdrop-blur-sm">
      <span className={`h-1.5 w-1.5 rounded-full ${dot} ${glow}`} />
      {label}
    </span>
  );
}
