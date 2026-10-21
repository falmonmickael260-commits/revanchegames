import { CATEGORIES } from "@/data/categories";
import type { GameCategory } from "@/types/game";

export function CategoryPill({ category }: { category: GameCategory }) {
  const def = CATEGORIES.find((c) => c.id === category);
  return (
    <span className="rounded-full border border-border-soft bg-surface px-2 py-0.5 font-body text-[11px] text-text-dim">
      {def?.label ?? category}
    </span>
  );
}
