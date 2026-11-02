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
    <div className="rg-category-filter">
      {CATEGORIES.map((cat) => {
        const isActive = active === cat.id;
        return (
          <button
            key={cat.id}
            type="button"
            onClick={() => select(cat.id)}
            aria-pressed={isActive}
            className="rg-category-chip"

          >
            {cat.label}
          </button>
        );
      })}
    </div>
  );
}
