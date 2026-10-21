"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { CATEGORIES } from "@/data/categories";

export function CategoryFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const active = searchParams.get("category") ?? "tous";

  function select(id: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (id === "tous") params.delete("category");
    else params.set("category", id);
    // Filters apply in place — never navigate to a different screen to "enter" the library.
    router.push(`${pathname}${params.toString() ? `?${params.toString()}` : ""}`);
  }

  return (
    <div className="flex flex-wrap gap-2">
      {CATEGORIES.map((cat) => {
        const isActive = active === cat.id;
        return (
          <button
            key={cat.id}
            type="button"
            onClick={() => select(cat.id)}
            aria-pressed={isActive}
            className={`rounded-full border px-3.5 py-1.5 font-body text-sm transition-colors ${
              isActive
                ? "border-cyan/40 bg-cyan/10 text-text"
                : "border-border-soft bg-surface text-text-dim hover:border-border hover:text-text"
            }`}
          >
            {cat.label}
          </button>
        );
      })}
    </div>
  );
}
