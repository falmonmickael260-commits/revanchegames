import type { ReactNode } from "react";

type Props = { animation: string };

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

function Swan() {
  const Feather = ({ d, klass }: { d: string; klass: string }) => <path d={d} className={`swan-feather ${klass}`} fill="url(#sw-feather)" stroke="#fff" strokeWidth="3" strokeLinejoin="round"/>;
  return <svg viewBox="0 0 400 400" className="rg-prestige-art rg-prestige-art--swan">
    <defs>
      <linearGradient id="sw-feather" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#fff"/><stop offset=".58" stopColor="#e7f1ff"/><stop offset="1" stopColor="#abbddd"/></linearGradient>
      <linearGradient id="sw-water" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#b2edff" stopOpacity=".8"/><stop offset="1" stopColor="#796cf0" stopOpacity=".04"/></linearGradient>
      <radialGradient id="sw-aura"><stop stopColor="#d8cbff" stopOpacity=".45"/><stop offset="1" stopColor="#8aaeff" stopOpacity="0"/></radialGradient>
      <filter id="sw-shadow"><feGaussianBlur stdDeviation="9"/></filter>
    </defs>
    <circle cx="198" cy="187" r="176" fill="url(#sw-aura)" className="sw-aura"/>
    <ellipse cx="203" cy="332" rx="128" ry="18" fill="#91c8ff" opacity=".28" filter="url(#sw-shadow)"/>
    <g className="sw-water-ripples"><ellipse cx="202" cy="318" rx="119" ry="18"/><ellipse cx="202" cy="318" rx="86" ry="12"/><ellipse cx="202" cy="318" rx="54" ry="7"/></g>
    <path d="M79 322q124-42 247 0" fill="none" stroke="url(#sw-water)" strokeWidth="13" strokeLinecap="round"/>
    <g className="sw-body">
      <path d="M110 285q13-85 99-87 84-2 111 76-35 49-115 47-63-1-95-36Z" fill="url(#sw-feather)" stroke="#fff" strokeWidth="5"/>
      <g className="sw-wing">
        <path d="M133 276q4-51 67-66 45 13 83 64-54 31-135 18Z" fill="#f8fbff" stroke="#fff" strokeWidth="4"/>
        <Feather d="M151 276q-5-31 24-50 21 3 34 37Z" klass="sf1"/>
        <Feather d="M179 282q-2-39 31-57 23 8 30 48Z" klass="sf2"/>
        <Feather d="M207 286q8-35 41-42 22 13 17 39Z" klass="sf3"/>
        <Feather d="M235 284q18-27 47-21 14 16 6 34Z" klass="sf4"/>
      </g>
      <path d="M132 284q63 20 139 0" fill="none" stroke="#c0cee7" strokeWidth="4" opacity=".8"/>
    </g>
    <g className="sw-neck">
      <path d="M128 275q-31-23-24-66 6-41 45-59 29-14 18-48-5-15-19-29 48 11 53 51 6 44-33 63-30 15-26 45 3 23 24 43Z" fill="url(#sw-feather)" stroke="#fff" strokeWidth="5" strokeLinejoin="round"/>
      <g className="sw-head"><circle cx="148" cy="89" r="28" fill="url(#sw-feather)" stroke="#fff" strokeWidth="4"/><path d="m123 94-40 10 38 11q12-4 13-11Z" fill="#ed9a49" stroke="#ffd18a" strokeWidth="3"/><circle cx="155" cy="82" r="4" fill="#302d54"/><path d="m134 61 5-13 7 11m9 0 10-11 3 16" fill="none" stroke="#e4b84f" strokeWidth="5" strokeLinecap="round"/><path d="m134 62 5-13 7 11m9 0 10-11 3 16" fill="none" stroke="#fff3b1" strokeWidth="2" strokeLinecap="round"/></g>
    </g>
    <path d="M300 286q23-16 44-5" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" className="sw-water-glint"/>
  </svg>;
}

export function PrestigeGiftAnimation({ animation }: Props) {
  let art: ReactNode;
  switch (animation) {
    case "diamond-turn": art = <Diamond />; break;
    case "crown-bloom": art = <Crown />; break;
    case "cat-wave": art = <Cat />; break;
    case "shooting-star": art = <ShootingStar />; break;
    case "swan-glide": art = <Swan />; break;
    default: return null;
  }
  return <span className="rg-prestige-art-wrap" data-prestige-art={animation}>{art}</span>;
}
