export function GamepadIllustration() {
  return (
    <svg viewBox="0 0 420 270" fill="none" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="rg-pad-shell" x1="58" y1="54" x2="352" y2="252" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F0B8FF" />
          <stop offset=".38" stopColor="#A64AFF" />
          <stop offset="1" stopColor="#5016B6" />
        </linearGradient>
        <linearGradient id="rg-pad-face" x1="121" y1="78" x2="284" y2="194" gradientUnits="userSpaceOnUse">
          <stop stopColor="#321055" />
          <stop offset="1" stopColor="#160B2D" />
        </linearGradient>
        <linearGradient id="rg-pad-button" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#FFE7FF" />
          <stop offset="1" stopColor="#A84AFF" />
        </linearGradient>
        <filter id="rg-pad-glow" x="0" y="0" width="420" height="280" filterUnits="userSpaceOnUse">
          <feGaussianBlur stdDeviation="13" />
        </filter>
        <filter id="rg-pad-shadow" x="14" y="34" width="400" height="244" filterUnits="userSpaceOnUse">
          <feDropShadow dx="0" dy="14" stdDeviation="10" floodColor="#080111" floodOpacity=".7" />
        </filter>
      </defs>
      <path d="M65 113c8-41 31-60 66-58l53 15h52l53-15c35-2 58 17 66 58l23 97c5 20-7 32-24 32h-24c-19 0-29-9-40-26l-22-36H152l-22 36c-11 17-21 26-40 26H66c-17 0-29-12-24-32l23-97Z" fill="#AF3AFF" opacity=".72" filter="url(#rg-pad-glow)" />
      <g filter="url(#rg-pad-shadow)">
        <path d="M66 111c8-39 29-57 65-55l54 15h50l54-15c36-2 57 16 65 55l22 99c4 18-7 30-23 30h-25c-17 0-27-8-38-24l-24-37H154l-24 37c-11 16-21 24-38 24H67c-16 0-27-12-23-30l22-99Z" fill="url(#rg-pad-shell)" stroke="#F3D8FF" strokeWidth="4" />
        <path d="M91 115c7-27 20-39 45-38l53 13h47l53-13c25-1 38 11 45 38l17 74c2 10-5 18-14 18h-13c-10 0-17-5-24-15l-22-33H147l-22 33c-7 10-14 15-24 15H88c-9 0-16-8-14-18l17-74Z" fill="url(#rg-pad-face)" stroke="#C67AFF" strokeWidth="2" />
        <path d="M112 128h18v18h18v18h-18v18h-18v-18H94v-18h18v-18Z" fill="url(#rg-pad-button)" />
        <circle cx="295" cy="132" r="13" fill="#FF78C8" stroke="#FFE4FA" strokeWidth="3" />
        <circle cx="326" cy="158" r="13" fill="#FFD166" stroke="#FFF1C4" strokeWidth="3" />
        <circle cx="264" cy="158" r="13" fill="#68E6FF" stroke="#D7FBFF" strokeWidth="3" />
        <circle cx="295" cy="184" r="13" fill="#9AF19B" stroke="#E0FFE2" strokeWidth="3" />
        <ellipse cx="187" cy="141" rx="18" ry="13" fill="#0C0718" stroke="#D59AFF" strokeWidth="3" />
        <ellipse cx="228" cy="174" rx="18" ry="13" fill="#0C0718" stroke="#D59AFF" strokeWidth="3" />
        <circle cx="207" cy="105" r="4" fill="#F4D8FF" />
        <circle cx="221" cy="105" r="4" fill="#F4D8FF" />
      </g>
      <path d="m76 54 5 12 13 1-10 8 3 13-11-7-11 7 3-13-10-8 13-1 5-12Z" fill="#FFE382" filter="drop-shadow(0 0 8px #FFD966)" />
      <circle cx="357" cy="66" r="4" fill="#9DEEFF" filter="drop-shadow(0 0 6px #72DFFF)" />
    </svg>
  );
}
