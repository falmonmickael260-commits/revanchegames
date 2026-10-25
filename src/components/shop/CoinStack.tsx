/** Pile de pièces dessinée en SVG — pas d'image à charger, se colore avec le thème. */
export function CoinStack({ size = 72 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" fill="none" aria-hidden="true">
      <ellipse cx="48" cy="70" rx="30" ry="10" fill="var(--rg-amber)" fillOpacity="0.12" />
      {[22, 13, 4].map((y, i) => (
        <g key={y} opacity={1 - i * 0.12}>
          <ellipse cx="48" cy={y + 46} rx="28" ry="10" fill="var(--rg-void)" stroke="var(--rg-amber)" strokeWidth="2" />
          <ellipse cx="48" cy={y + 42} rx="28" ry="10" fill="url(#coinFace)" stroke="var(--rg-amber)" strokeWidth="2" />
          <text x="48" y={y + 46} textAnchor="middle" fontSize="13" fontWeight="700" fill="var(--rg-void)" fontFamily="var(--font-display)">
            RG
          </text>
        </g>
      ))}
      <defs>
        <linearGradient id="coinFace" x1="20" y1="30" x2="76" y2="54" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--rg-amber)" />
          <stop offset="1" stopColor="#ffd98a" />
        </linearGradient>
      </defs>
    </svg>
  );
}
