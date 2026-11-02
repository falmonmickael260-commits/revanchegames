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
    <div className="rg-empty-state">
      <span className="rg-empty-state-icon">
        <Icon className="h-6 w-6 text-text-faint" strokeWidth={1.6} />
      </span>
      <div>
        <h3 className="text-lg font-bold tracking-tight text-text">
          {title}
        </h3>
        <p className="mx-auto mt-2 max-w-sm text-xs leading-6 text-text-faint">{message}</p>
      </div>
      {action}
    </div>
  );
}
