import { Sparkles } from "lucide-react";

export type PlayerProgress = {
  xp: number;
  level: number;
  xpIntoLevel: number;
  xpForLevel: number;
};

type ProgressRow = {
  xp: number | string;
  level: number;
  xp_into_level: number | string;
  xp_for_level: number | string;
};

export function toProgress(rows: unknown): PlayerProgress | null {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const row = rows[0] as ProgressRow;
  return {
    xp: Number(row.xp),
    level: Number(row.level),
    xpIntoLevel: Number(row.xp_into_level),
    xpForLevel: Number(row.xp_for_level),
  };
}

/**
 * Niveau et progression du joueur.
 *
 * `compact` : une simple pastille « Nv. 3 », pour les listes (classement,
 * fiche d'un ami). Sinon, la carte complète avec la barre de progression.
 *
 * L'XP n'est stockée nulle part : elle est recalculée depuis les parties
 * réellement terminées (voir la migration `player_progress`). Ce composant ne
 * fait donc qu'afficher — il n'y a pas de compteur à incrémenter, et rien ne
 * peut diverger de l'historique réel.
 */
export function LevelBadge({
  progress,
  compact = false,
}: {
  progress: PlayerProgress;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <span
        title={`${progress.xp} XP`}
        className="shrink-0 rounded-md border border-cyan/30 bg-cyan/10 px-1.5 py-0.5 font-display text-[10px] font-bold uppercase tracking-wide text-cyan"
      >
        Nv. {progress.level}
      </span>
    );
  }

  // Pourcentage borné : une XP pile sur le seuil ne doit pas afficher 100 %
  // d'un niveau déjà franchi.
  const ratio = progress.xpForLevel > 0 ? progress.xpIntoLevel / progress.xpForLevel : 0;
  const percent = Math.max(0, Math.min(100, Math.round(ratio * 100)));
  const remaining = Math.max(0, progress.xpForLevel - progress.xpIntoLevel);

  return (
    <div className="rounded-2xl border border-border-soft bg-surface px-4 py-3.5">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl bg-gradient-to-br from-cyan/20 to-violet/20">
          <span className="font-display text-base font-bold leading-none text-cyan">
            {progress.level}
          </span>
          <span className="font-display text-[8px] uppercase tracking-wider text-text-faint">
            niveau
          </span>
        </span>

        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 font-display text-sm font-semibold text-text">
            <Sparkles className="h-3.5 w-3.5 text-amber" strokeWidth={2} />
            {progress.xp.toLocaleString("fr-FR")} XP
          </p>
          <p className="mt-0.5 font-body text-[11px] text-text-faint">
            {remaining === 0
              ? "Niveau suivant atteint à la prochaine partie."
              : `Encore ${remaining.toLocaleString("fr-FR")} XP pour le niveau ${progress.level + 1}.`}
          </p>
        </div>
      </div>

      <div
        className="mt-3 h-2 w-full overflow-hidden rounded-full bg-surface-raised"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Progression vers le niveau ${progress.level + 1}`}
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-cyan to-violet transition-[width]"
          style={{ width: `${percent}%` }}
        />
      </div>

      <p className="mt-1.5 font-body text-[11px] text-text-faint">
        {progress.xpIntoLevel} / {progress.xpForLevel} XP dans ce niveau · 10 XP par partie,
        +15 par victoire, +5 par match nul.
      </p>
    </div>
  );
}
