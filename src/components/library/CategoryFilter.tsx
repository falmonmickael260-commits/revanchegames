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
    <div className="rg-rail gap-2 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      {CATEGORIES.map((cat) => {
        const isActive = active === cat.id;
        return (
          <button
            key={cat.id}
            type="button"
            onClick={() => select(cat.id)}
            aria-pressed={isActive}
            className="shrink-0 whitespace-nowrap rounded-full border px-3.5 py-1.5 font-body text-sm font-semibold transition-all"
            style={
              isActive
                ? { background: cat.color, borderColor: cat.color, color: "var(--rg-void)" }
                : { borderColor: "var(--rg-border-soft)", background: "var(--rg-surface)", color: "var(--rg-text-dim)" }
            }
          >
            {cat.label}
          </button>
        );
      })}
    </div>
  );
}
