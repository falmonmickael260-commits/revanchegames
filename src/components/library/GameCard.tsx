"use client";

import { motion } from "framer-motion";
import { Lock, Play, Users } from "lucide-react";
import type { Game } from "@/types/game";
import { GameArt } from "./GameArt";
import { StatusBadge } from "./StatusBadge";
import { CategoryPill } from "./CategoryPill";
import { FavoriteButton } from "./FavoriteButton";
import { useFavorites } from "@/lib/use-favorites";

export function GameCard({ game, index = 0 }: { game: Game; index?: number }) {
  const { isFavorite, toggleFavorite } = useFavorites();
  const launchable = game.enabled && !!game.url;

  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.4, delay: Math.min(index * 0.04, 0.3), ease: "easeOut" }}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-border-soft bg-surface transition-colors hover:border-border"
    >
      <GameArt game={game} className="aspect-[16/10] w-full" />

      <div className="absolute right-3 top-3">
        <FavoriteButton
          active={isFavorite(game.id)}
          onToggle={() => toggleFavorite(game.id)}
          label={game.name}
        />
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <h3 className="font-display text-base font-semibold tracking-wide text-text">
            {game.name}
          </h3>
          <p className="mt-0.5 font-body text-sm text-text-dim">{game.tagline}</p>
        </div>

        <p className="font-body text-xs leading-relaxed text-text-faint">
          {game.description}
        </p>

        <div className="flex flex-wrap gap-1.5">
          {game.categories.map((c) => (
            <CategoryPill key={c} category={c} />
          ))}
        </div>

        <div className="mt-auto flex items-center justify-between gap-2 pt-2">
          <div className="flex flex-col gap-1.5">
            <StatusBadge status={game.status} />
            <span className="inline-flex items-center gap-1 font-body text-[11px] text-text-faint">
              <Users className="h-3 w-3" strokeWidth={2} />
              {game.players}
            </span>
          </div>

          {launchable ? (
            <a
              href={game.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-cyan to-violet px-4 py-2 font-display text-xs font-semibold uppercase tracking-wider text-void transition-transform hover:scale-[1.04]"
            >
              <Play className="h-3 w-3" strokeWidth={2.5} fill="currentColor" />
              Jouer
            </a>
          ) : (
            <button
              type="button"
              disabled
              aria-disabled="true"
              tabIndex={-1}
              title="Ce jeu n'est pas encore disponible"
              className="flex cursor-not-allowed items-center gap-1.5 rounded-full bg-surface-raised px-4 py-2 font-display text-xs font-semibold uppercase tracking-wider text-text-faint opacity-60"
            >
              <Lock className="h-3 w-3" strokeWidth={2.5} />
              Jouer
            </button>
          )}
        </div>
      </div>
    </motion.article>
  );
}
