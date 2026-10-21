import { CATEGORIES } from "@/data/categories";
import type { GameCategory } from "@/types/game";

export function CategoryPill({ category }: { category: GameCategory }) {
  const def = CATEGORIES.find((c) => c.id === category);
  const color = def?.color ?? "#2fe6ff";
  return (
    <span
      className="rounded-full border px-2 py-0.5 font-body text-[11px] font-medium"
      style={{ borderColor: `${color}55`, background: `${color}1a`, color }}
    >
      {def?.label ?? category}
    </span>
  );
}
