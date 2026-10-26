import type { InputHTMLAttributes, LabelHTMLAttributes, ReactNode } from "react";

export function AuthCard({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-[calc(100dvh-var(--rg-header-h))] items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm rounded-2xl border border-border-soft bg-surface p-7 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
        <p className="font-display text-xs font-semibold uppercase tracking-[0.3em] text-cyan">
          {eyebrow}
        </p>
        <h1 className="mt-1 font-display text-2xl font-semibold tracking-wide text-text">
          {title}
        </h1>
        {subtitle && <p className="mt-1.5 font-body text-sm text-text-dim">{subtitle}</p>}
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}

export function Field({
  label,
  inputProps,
}: {
  label: string;
  inputProps: InputHTMLAttributes<HTMLInputElement> & LabelHTMLAttributes<HTMLInputElement>;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-display text-xs font-semibold uppercase tracking-[0.15em] text-text-faint">
        {label}
      </span>
      <input
        {...inputProps}
        // text-base (16 px) sous sm : en dessous de 16 px, iOS Safari zoome
        // automatiquement au focus et le formulaire sort de l'ecran.
        className="w-full rounded-lg border border-border-soft bg-void px-3.5 py-2.5 font-body text-base text-text placeholder:text-text-faint focus:border-cyan/50 focus:outline-none focus:ring-2 focus:ring-cyan/20 sm:text-sm"
      />
    </label>
  );
}

export function SubmitButton({
  children,
  pending,
  disabled,
}: {
  children: ReactNode;
  pending?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="w-full rounded-lg bg-gradient-to-r from-cyan to-violet px-4 py-2.5 font-display text-sm font-semibold text-void transition-opacity disabled:opacity-60"
    >
      {pending ? "…" : children}
    </button>
  );
}

export function FormError({ message }: { message: string }) {
  if (!message) return null;
  return (
    <p className="rounded-lg border border-violet/30 bg-violet/10 px-3 py-2 font-body text-sm text-violet-soft">
      {message}
    </p>
  );
}

export function FormNote({ children }: { children: ReactNode }) {
  return <p className="font-body text-sm text-text-dim">{children}</p>;
}
