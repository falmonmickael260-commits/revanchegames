export function PageHeader({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && (
          <p className="font-display text-xs font-semibold uppercase tracking-[0.3em] text-cyan">
            {eyebrow}
          </p>
        )}
        <h1 className="mt-1 font-display text-2xl font-semibold tracking-wide text-text sm:text-3xl">
          {title}
        </h1>
        {subtitle && <p className="mt-1.5 max-w-xl font-body text-sm text-text-dim">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
