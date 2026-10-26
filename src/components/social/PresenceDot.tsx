import type { PresenceStatus } from "@/lib/social/types";

const STYLES: Record<PresenceStatus, { color: string; label: string }> = {
  in_game: { color: "bg-violet", label: "En partie" },
  online: { color: "bg-cyan", label: "En ligne" },
  away: { color: "bg-amber", label: "Absent" },
  offline: { color: "bg-text-faint", label: "Hors ligne" },
};

export function presenceLabel(status: PresenceStatus): string {
  return STYLES[status].label;
}

/**
 * Pastille d'état de présence. Jamais seule : toujours accompagnée du libellé
 * textuel, pour que l'information ne repose pas uniquement sur la couleur.
 */
export function PresenceDot({
  status,
  className = "",
}: {
  status: PresenceStatus;
  className?: string;
}) {
  return (
    <span
      role="img"
      aria-label={STYLES[status].label}
      title={STYLES[status].label}
      className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${STYLES[status].color} ${className}`}
    />
  );
}
