/** Broadcast-style angled section label — a color-blocked ribbon, not a quiet caption. */
export function SectionBanner({ label, color }: { label: string; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="inline-block py-1.5 pl-4 pr-6 font-display text-xs font-bold uppercase tracking-[0.2em] text-void"
        style={{
          background: color,
          clipPath: "polygon(0 0, 100% 0, 88% 100%, 0% 100%)",
          boxShadow: `0 0 18px ${color}55`,
        }}
      >
        {label}
      </span>
      <span
        className="h-px flex-1 opacity-40"
        style={{ background: `linear-gradient(90deg, ${color}, transparent)` }}
      />
    </div>
  );
}
