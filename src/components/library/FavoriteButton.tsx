"use client";

import { Heart } from "lucide-react";

export function FavoriteButton({
  active,
  onToggle,
  label,
}: {
  active: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      aria-label={active ? `Retirer ${label} des favoris` : `Ajouter ${label} aux favoris`}
      className="rounded-full border border-border-soft bg-surface p-2 text-text-faint transition-colors hover:text-rose-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan/40"
    >
      <Heart
        className="h-4 w-4"
        strokeWidth={2}
        fill={active ? "#ff5d7a" : "none"}
        color={active ? "#ff5d7a" : "currentColor"}
      />
    </button>
  );
}
