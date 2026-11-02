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
    <div className="rg-page-heading">
      <div>
        {eyebrow && (
          <p className="rg-eyebrow">
            {eyebrow}
          </p>
        )}
        <h1 className="rg-page-title">
          {title}
        </h1>
        {subtitle && <p className="rg-page-subtitle">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
