import type { LucideIcon } from "lucide-react";

export function StatTile({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border-soft bg-surface px-4 py-3.5">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-raised">
        <Icon className="h-4 w-4 text-cyan" strokeWidth={2} />
      </span>
      <div>
        <p className="font-display text-lg font-semibold text-text">{value}</p>
        <p className="font-body text-xs text-text-faint">{label}</p>
      </div>
    </div>
  );
}
