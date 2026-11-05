import type { ReactNode } from "react";

type Props = { animation: string; imageUrl: string };

function Diamond() {
  return <svg viewBox="0 0 400 400" className="rg-prestige-art rg-prestige-art--diamond">
    <defs>
      <linearGradient id="pd-top" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#fff4ff"/><stop offset=".38" stopColor="#d79cff"/><stop offset="1" stopColor="#52217c"/></linearGradient>
      <linearGradient id="pd-side" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#efc5ff"/><stop offset=".48" stopColor="#923ed0"/><stop offset="1" stopColor="#321050"/></linearGradient>
      <radialGradient id="pd-aura"><stop stopColor="#d58cff" stopOpacity=".52"/><stop offset="1" stopColor="#a14cff" stopOpacity="0"/></radialGradient>
      <filter id="pd-shadow" x="-.5" y="-.5" width="2" height="2"><feGaussianBlur stdDeviation="12"/></filter>
    </defs>
    <ellipse cx="200" cy="340" rx="120" ry="25" fill="#a042ff" opacity=".32" filter="url(#pd-shadow)" className="pd-ground"/>
    <circle cx="200" cy="190" r="166" fill="url(#pd-aura)" className="pd-aura"/>
    <g className="pd-gem">
      <path d="M95 112 147 57h107l53 55-24 45-82 155-81-155Z" fill="#5c278e" stroke="#f4d5ff" strokeWidth="5"/>
      <path d="m95 112 106 5-26 64-94-24Zm212 0-106 5 26 64 94-24Z" fill="url(#pd-top)"/>
      <path d="m147 57 54 60-26 64-80-69Zm107 0-53 60 26 64 80-69Z" fill="#dfaaff"/>
      <path d="m95 112 80 69 32 131-81-155Zm212 0-80 69-32 131 82-155Z" fill="url(#pd-side)"/>
      <path d="m147 57 54 60 53-60M175 181h51M201 117v195" fill="none" stroke="#fff0ff" strokeOpacity=".82" strokeWidth="4"/>
      <path d="m111 109 38-40m118 8 25 33" fill="none" stroke="#fff" strokeWidth="7" strokeLinecap="round" className="pd-edge-glint"/>
      <path d="m201 117 25 64-25 131-26-131Z" fill="#f8dfff" opacity=".48" className="pd-inner-facet"/>
    </g>
    <path d="M79 186 64 171m260 15 13-15M200 23v-22" stroke="#f9d7ff" strokeWidth="4" strokeLinecap="round" className="pd-spark"/>
    <path d="m95 259-12 8m222-8 13 8" stroke="#fff" strokeWidth="3" strokeLinecap="round" className="pd-spark pd-spark--late"/>
  </svg>;
}

function Crown() {
  const flower = (x: number, y: number, klass: string, scale: number) => <g transform={`translate(${x} ${y}) scale(${scale})`} className={`pc-flower ${klass}`}>
    <g className="pc-petals"><ellipse cy="-14" rx="8" ry="14"/><ellipse cy="-14" rx="8" ry="14" transform="rotate(72)"/><ellipse cy="-14" rx="8" ry="14" transform="rotate(144)"/><ellipse cy="-14" rx="8" ry="14" transform="rotate(216)"/><ellipse cy="-14" rx="8" ry="14" transform="rotate(288)"/></g>
    <circle r="7" className="pc-flower-core"/><circle r="2.5" fill="#fff6be"/>
  </g>;
  return <svg viewBox="0 0 400 400" className="rg-prestige-art rg-prestige-art--crown">
    <defs>
      <linearGradient id="pc-gold" x1="0" y1="0" x2=".9" y2="1"><stop stopColor="#fff2ae"/><stop offset=".28" stopColor="#e9ae42"/><stop offset=".58" stopColor="#fff0a0"/><stop offset="1" stopColor="#98501d"/></linearGradient>
      <linearGradient id="pc-band" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#ffe991"/><stop offset=".5" stopColor="#b87525"/><stop offset="1" stopColor="#ffe28a"/></linearGradient>
      <radialGradient id="pc-halo"><stop stopColor="#ffdb77" stopOpacity=".4"/><stop offset="1" stopColor="#ffbf3a" stopOpacity="0"/></radialGradient>
      <filter id="pc-shadow"><feGaussianBlur stdDeviation="11"/></filter>
    </defs>
    <circle cx="200" cy="193" r="165" fill="url(#pc-halo)" className="pc-halo"/>
    <ellipse cx="200" cy="325" rx="132" ry="21" fill="#efaa38" opacity=".28" filter="url(#pc-shadow)"/>
    <g className="pc-crown-body">
      <path d="m87 134 39 35 7-85 67 67 68-67 7 85 38-35-24 118H111Z" fill="url(#pc-gold)" stroke="#fff0b3" strokeWidth="5" strokeLinejoin="round"/>
      <path d="m112 241 176 0-8 36q-80 29-160 0Z" fill="url(#pc-band)" stroke="#ffedaa" strokeWidth="4"/>
      <path d="m126 169 74-18 67 18-8 68q-62 20-125 0Z" fill="#bd792d" opacity=".35"/>
      <path d="m126 169 76 14 65-14m-133 52q67 19 132 0" fill="none" stroke="#fff1b5" strokeOpacity=".8" strokeWidth="4"/>
      <circle cx="112" cy="139" r="9" fill="#fff1ae"/><circle cx="288" cy="139" r="9" fill="#fff1ae"/>
      <g className="pc-jewel j1"><path d="m132 194 13-17 13 17-13 19Z" fill="#ca5dff" stroke="#ffeaff" strokeWidth="3"/><path d="m145 177v36" stroke="#fff" opacity=".7"/></g>
      <g className="pc-jewel j2"><path d="m200 178 17-23 17 23-17 24Z" fill="#54e2ff" stroke="#fff" strokeWidth="3"/><path d="m217 155v47" stroke="#fff" opacity=".8"/></g>
      <g className="pc-jewel j3"><path d="m254 194 13-17 13 17-13 19Z" fill="#ed5f99" stroke="#ffeaff" strokeWidth="3"/><path d="m267 177v36" stroke="#fff" opacity=".7"/></g>
    </g>
    {flower(132, 91, "f1", .82)}{flower(200, 78, "f2", 1.04)}{flower(268, 91, "f3", .82)}
    <path d="M96 120 82 101m222 19 14-19M201 53V32" stroke="#fff4ba" strokeWidth="4" strokeLinecap="round" className="pc-rays"/>
  </svg>;
}

function Cat() {
  return <svg viewBox="0 0 400 400" className="rg-prestige-art rg-prestige-art--cat">
    <defs>
      <linearGradient id="cat-fur" x1="0" y1="0" x2=".8" y2="1"><stop stopColor="#fffefa"/><stop offset=".55" stopColor="#e8e7f3"/><stop offset="1" stopColor="#aaa9c3"/></linearGradient>
      <linearGradient id="cat-gold" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#fff3b0"/><stop offset=".5" stopColor="#d79a3c"/><stop offset="1" stopColor="#fff0a0"/></linearGradient>
      <radialGradient id="cat-aura"><stop stopColor="#c4a0ff" stopOpacity=".36"/><stop offset="1" stopColor="#b293ff" stopOpacity="0"/></radialGradient>
      <filter id="cat-shadow"><feGaussianBlur stdDeviation="10"/></filter>
    </defs>
    <circle cx="200" cy="190" r="170" fill="url(#cat-aura)"/>
    <ellipse cx="200" cy="334" rx="112" ry="22" fill="#ac8cff" opacity=".24" filter="url(#cat-shadow)"/>
    <g className="cat-tail"><path d="M260 290c55 6 75-34 56-68-14-25-42-15-36 5 3 10 15 10 20 3" fill="none" stroke="url(#cat-fur)" strokeWidth="25" strokeLinecap="round"/><path d="M260 290c55 6 75-34 56-68" fill="none" stroke="#fff" strokeOpacity=".65" strokeWidth="5" strokeLinecap="round"/></g>
    <path d="M113 304c2-64 32-103 87-103s88 43 88 105q-83 43-175-2Z" fill="url(#cat-fur)" stroke="#fff" strokeWidth="4"/>
    <path d="M153 245q-8 37 3 69m90-69q8 37-3 69" fill="none" stroke="#c9c8d9" strokeWidth="5" opacity=".7"/>
    <g className="cat-head">
      <path d="m116 157 7-67 54 43q24-8 47 0l53-43 8 68q10 68-84 83-94-16-85-84Z" fill="url(#cat-fur)" stroke="#fff" strokeWidth="4" strokeLinejoin="round"/>
      <path d="m131 112 40 31m112-31-40 31" stroke="#efabc6" strokeWidth="13" strokeLinecap="round" opacity=".78"/>
      <path d="M157 174q14-18 29 0m30 0q14-18 29 0" fill="none" stroke="#63566c" strokeWidth="6" strokeLinecap="round" className="cat-eyes"/>
      <path d="M158 175q13 16 27 0m31 0q13 16 27 0" fill="none" stroke="#63566c" strokeWidth="4" strokeLinecap="round" className="cat-blink"/>
      <path d="m193 193 8 6 8-6q-8-10-16 0" fill="#e985ac"/><path d="M201 199q-10 13-20 4m20-4q10 13 20 4" fill="none" stroke="#8c7189" strokeWidth="3" strokeLinecap="round"/>
      <path d="M145 199 103 193m43 19-40 7m151-20 42-6m-43 19 40 7" stroke="#b6b2c7" strokeWidth="3" strokeLinecap="round"/>
      <g className="cat-crown"><path d="m158 116 6-30 18 19 19-36 19 36 18-19 6 30Z" fill="url(#cat-gold)" stroke="#fff2bb" strokeWidth="3"/><path d="M161 118q42 13 82 0" fill="none" stroke="#fff0aa" strokeWidth="5"/><circle cx="201" cy="98" r="5" fill="#72ddff"/></g>
    </g>
    <g className="cat-wave-paw"><path d="M243 252q30-22 48-8 12 10 1 23l-23 29q-12 12-28 1l-16-13Z" fill="url(#cat-fur)" stroke="#fff" strokeWidth="4"/><path d="M264 279q8 10 16 0m-28 4q7 9 14 1m-20-7q7 8 13 2" fill="none" stroke="#e3a8c0" strokeWidth="4" strokeLinecap="round"/><path d="M270 250q-5-13 5-16 12-3 12 12" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round"/></g>
    <path d="m278 115 10-14m-170 14-10-14" stroke="#fff" strokeWidth="4" strokeLinecap="round" className="cat-ear-flick"/>
  </svg>;
}

function ShootingStar() {
  return <svg viewBox="0 0 400 400" className="rg-prestige-art rg-prestige-art--shooting-star">
    <defs>
      <linearGradient id="ss-trail" x1="1" y1="0" x2="0" y2="1"><stop stopColor="#fffbd2"/><stop offset=".34" stopColor="#ffc84e" stopOpacity=".8"/><stop offset="1" stopColor="#ff6a9b" stopOpacity="0"/></linearGradient>
      <radialGradient id="ss-core"><stop stopColor="#fffef0"/><stop offset=".35" stopColor="#ffe477"/><stop offset="1" stopColor="#ff9e26"/></radialGradient>
      <filter id="ss-glow" x="-.8" y="-.8" width="2.6" height="2.6"><feGaussianBlur stdDeviation="12"/></filter>
    </defs>
    <path d="M63 318Q145 248 320 77" stroke="#ffb53f" strokeWidth="31" opacity=".2" filter="url(#ss-glow)" className="ss-trail-glow"/>
    <path d="M65 318Q150 241 314 79" stroke="url(#ss-trail)" strokeWidth="18" strokeLinecap="round" strokeDasharray="380" strokeDashoffset="380" className="ss-trail ss-trail--wide"/>
    <path d="M79 316Q165 230 320 93" stroke="#fff7cb" strokeWidth="5" strokeLinecap="round" strokeDasharray="360" strokeDashoffset="360" className="ss-trail ss-trail--core"/>
    <path d="M67 286Q170 205 281 83" stroke="#ff76b1" strokeWidth="7" strokeLinecap="round" strokeDasharray="310" strokeDashoffset="310" className="ss-trail ss-trail--rose"/>
    <g className="ss-star-flight">
      <g transform="translate(280 122)">
        <circle r="81" fill="#ffb833" opacity=".26" filter="url(#ss-glow)" className="ss-star-aura"/>
        <path d="m0-72 17 49 50 3-39 30 14 49L0 29l-42 30 14-49-39-30 50-3Z" fill="url(#ss-core)" stroke="#fff8cd" strokeWidth="5" strokeLinejoin="round"/>
        <path d="m0-72 0 101-42 30 14-49-39-30 50-3Z" fill="#fff8cd" opacity=".48" className="ss-star-facet"/>
        <path d="m0-72 0 101 42 30-14-49 39-30-50-3Z" fill="#ff8c32" opacity=".46" className="ss-star-facet ss-star-facet--right"/>
        <circle r="18" fill="#fffef1" className="ss-star-core"/>
      </g>
    </g>
    <path d="m115 170 5-20 7 20 20 6-20 6-7 20-5-20-20-6Zm188-83 4-15 5 15 15 5-15 5-5 15-4-15-15-5Z" fill="#fff6bf" className="ss-spark"/>
    <circle cx="132" cy="272" r="5" fill="#fff" className="ss-ember e1"/><circle cx="179" cy="235" r="4" fill="#ffc960" className="ss-ember e2"/><circle cx="225" cy="191" r="3" fill="#fff" className="ss-ember e3"/>
  </svg>;
}

function Swan({ imageUrl }: { imageUrl: string }) {
  const wing = "M117 94 Q135 76 157 73 Q180 75 198 99 Q210 118 201 141 Q184 160 158 164 Q134 157 121 139 Q111 119 117 94Z";
  const neck = "M77 64 Q68 51 81 37 Q91 26 107 32 L117 42 Q105 48 102 61 Q98 76 111 87 Q123 96 121 109 Q115 124 129 141 L116 156 Q97 140 94 119 Q89 98 77 81Z";
  return <svg viewBox="0 0 256 256" className="rg-prestige-art rg-prestige-art--swan">
    <defs>
      <radialGradient id="sw-aura"><stop stopColor="#d8cbff" stopOpacity=".45"/><stop offset="1" stopColor="#8aaeff" stopOpacity="0"/></radialGradient>
      <mask id="sw-base-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="256" height="256">
        <rect width="256" height="256" fill="#fff"/><path d={neck} fill="#000"/><path d={wing} fill="#000"/>
      </mask>
      <clipPath id="sw-neck-clip"><path d={neck}/></clipPath>
      <clipPath id="sw-wing-clip"><path d={wing}/></clipPath>
      <filter id="sw-shadow" x="-.5" y="-.5" width="2" height="2"><feGaussianBlur stdDeviation="9"/></filter>
    </defs>
    <circle cx="128" cy="128" r="119" fill="url(#sw-aura)" className="sw-aura"/>
    <ellipse cx="128" cy="210" rx="92" ry="15" fill="#91c8ff" opacity=".26" filter="url(#sw-shadow)"/>
    <image href={imageUrl} x="0" y="0" width="256" height="256" preserveAspectRatio="none" mask="url(#sw-base-mask)"/>
    <g className="sw-neck-piece"><image href={imageUrl} x="0" y="0" width="256" height="256" preserveAspectRatio="none" clipPath="url(#sw-neck-clip)"/></g>
    <g className="sw-wing-piece"><image href={imageUrl} x="0" y="0" width="256" height="256" preserveAspectRatio="none" clipPath="url(#sw-wing-clip)"/></g>
    <g className="sw-water-ripples"><ellipse cx="128" cy="215" rx="104" ry="13"/><ellipse cx="128" cy="215" rx="75" ry="9"/><ellipse cx="128" cy="215" rx="46" ry="5"/></g>
  </svg>;
}

export function PrestigeGiftAnimation({ animation, imageUrl }: Props) {
  let art: ReactNode;
  switch (animation) {
    case "diamond-turn": art = <Diamond />; break;
    case "crown-bloom": art = <Crown />; break;
    case "cat-wave": art = <Cat />; break;
    case "shooting-star": art = <ShootingStar />; break;
    case "swan-glide": art = <Swan imageUrl={imageUrl} />; break;
    default: return null;
  }
  return <span className="rg-prestige-art-wrap" data-prestige-art={animation}>{art}</span>;
}
