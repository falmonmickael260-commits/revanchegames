import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  title,
  message,
  action,
}: {
  icon: LucideIcon;
  title: string;
  message: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border-soft px-6 py-16 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border-soft bg-surface">
        <Icon className="h-6 w-6 text-text-faint" strokeWidth={1.6} />
      </span>
      <div>
        <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-text-dim">
          {title}
        </h3>
        <p className="mx-auto mt-1.5 max-w-sm font-body text-sm text-text-faint">{message}</p>
      </div>
      {action}
    </div>
  );
}
