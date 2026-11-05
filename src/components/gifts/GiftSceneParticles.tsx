"use client";

import { useEffect, useRef } from "react";

type Particle = { x: number; y: number; vx: number; vy: number; age: number; life: number; size: number; spin: number; color: string; kind: string };
const PALETTES: Record<string, string[]> = {
  petals: ["#ff738d", "#ffd0d8", "#e52e57"], "double-heartbeat": ["#ff4c77", "#ffb2c5", "#fff0f4"], bounce: ["#ffcd5c", "#ff6e8b", "#81dcff"], "kiss-hearts": ["#ff718d", "#ffb4c4", "#ffe2e8"],
  "bear-hug": ["#ffcc84", "#ff788c", "#f7e7c3"], bloom: ["#ff80a3", "#ffd26d", "#b9f29c"], "box-open": ["#e5a56c", "#ffda8a", "#ff7b8e"], lightning: ["#fff69a", "#ffd15e", "#a2eaff"],
  butterfly: ["#bc9bff", "#7ee8ff", "#ffe4a5"], "macarons-bounce": ["#ff9ab4", "#a8edce", "#ffd479"], "ring-turn": ["#fff0b2", "#c9a9ff", "#e7fbff"], "crystal-glint": ["#bcf3ff", "#ffffff", "#8baeff"],
  "bear-bow": ["#ffd78c", "#ff83a1", "#fff4c8"], "flower-glow": ["#ffc5d2", "#ffe177", "#bcf39b"], "perfume-mist": ["#edc4ff", "#fff2ff", "#a4ddff"], "unicorn-nod": ["#b998ff", "#85eaff", "#ffd790"],
  "ruby-pulse": ["#ff4c69", "#ffb0bb", "#fff1c9"], "chest-open": ["#ffdc78", "#ffab50", "#fff3b0"], "diamond-turn": ["#b3eaff", "#ffffff", "#a997ff"], "crown-bloom": ["#ffe58f", "#ff92b2", "#c9a5ff"],
  "cat-wave": ["#ffe2a6", "#f6b46f", "#fff5db"], "shooting-star": ["#fff3a5", "#ffc765", "#c8eaff"], "swan-glide": ["#d9f6ff", "#9edcff", "#ffffff"],
};
const ROUTES: Record<string, Array<[number, number]>> = {
  petals:[[.2,.2],[.78,.25],[.3,.47],[.7,.4]], "double-heartbeat":[[.22,.48],[.78,.48],[.34,.28],[.66,.28]], bounce:[[.2,.68],[.8,.63],[.35,.42],[.65,.38]], "kiss-hearts":[[.5,.62],[.36,.44],[.65,.38],[.5,.29]],
  "bear-hug":[[.16,.54],[.84,.54],[.3,.38],[.7,.38]], bloom:[[.23,.66],[.5,.44],[.77,.66],[.5,.3]], "box-open":[[.5,.65],[.42,.48],[.58,.39],[.5,.27]], lightning:[[.16,.3],[.82,.34],[.24,.52],[.76,.5]],
  butterfly:[[.23,.38],[.75,.32],[.32,.54],[.69,.51]], "macarons-bounce":[[.25,.68],[.5,.61],[.75,.68],[.5,.45]], "ring-turn":[[.28,.42],[.72,.42],[.5,.28],[.5,.58]], "crystal-glint":[[.2,.4],[.8,.4],[.36,.27],[.64,.58]],
  "bear-bow":[[.3,.3],[.7,.3],[.5,.22],[.5,.58]], "flower-glow":[[.24,.53],[.5,.36],[.76,.53],[.5,.24]], "perfume-mist":[[.24,.58],[.4,.42],[.62,.35],[.76,.5]], "unicorn-nod":[[.2,.57],[.37,.38],[.63,.38],[.8,.55]],
  "ruby-pulse":[[.5,.48],[.5,.48],[.5,.48],[.5,.48]], "chest-open":[[.5,.64],[.42,.46],[.58,.42],[.5,.27]], "diamond-turn":[[.5,.47],[.25,.47],[.75,.47],[.5,.3]], "crown-bloom":[[.28,.38],[.5,.27],[.72,.38],[.5,.56]],
  "cat-wave":[[.28,.56],[.72,.43],[.34,.37],[.69,.6]], "shooting-star":[[.2,.63],[.39,.49],[.6,.35],[.79,.2]], "swan-glide":[[.5,.62],[.34,.57],[.66,.57],[.5,.52]],
};

function seeded(seedText: string) {
  let seed = 2166136261;
  for (let i = 0; i < seedText.length; i++) seed = Math.imul(seed ^ seedText.charCodeAt(i), 16777619);
  return () => { seed += 0x6D2B79F5; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** Transparent, deterministic per-gift particle choreography. Draws on the viewport, never on a panel. */
export function GiftSceneParticles({ scene, seed, level }: { scene: string; seed: string; level: "small" | "medium" | "large" | "prestige" }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d", { alpha: true });
    if (!canvas || !ctx) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;
    const random = seeded(`${seed}:${scene}`);
    const palette = PALETTES[scene] ?? ["#ffe19c", "#fff", "#ba9aff"];
    const w = () => window.innerWidth, h = () => window.innerHeight;
    let raf = 0, alive = true, previous = 0;
    let width = 0, height = 0;
    const particles: Particle[] = [];
    const resize = () => {
      const dpr = Math.min(devicePixelRatio || 1, 1.35);
      width = w(); height = h(); canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`; canvas.style.height = `${height}px`; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const burst = (x: number, y: number, amount: number, force: number, kind: string) => {
      for (let i = 0; i < amount; i++) {
        const angle = (i / amount) * Math.PI * 2 + (random() - .5) * .35;
        const speed = force * (.25 + random() * .9);
        let vx = Math.cos(angle) * speed, vy = Math.sin(angle) * speed;
        if (kind === "petal") { vx *= .3; vy = Math.abs(vy) * .32 + .8; }
        if (kind === "heart") vy = -Math.abs(vy) - .55;
        if (kind === "mist") { vx *= .32; vy = -Math.abs(vy) * .35 - .25; }
        if (kind === "droplet") vy = Math.abs(vy) * .28 + .6;
        if (kind === "round") vy = -Math.abs(vy) * .65 - .4;
        particles.push({ x, y, vx, vy, age: 0,
          life: 950 + random() * 1450, size: 1.5 + random() * (kind === "shard" ? 4.2 : 2.8), spin: (random() - .5) * .18,
          color: palette[(random() * palette.length) | 0], kind });
      }
    };
    resize(); window.addEventListener("resize", resize);
    const timeline = [520, 1420, 2480, 3510];
    const fired = new Set<number>();
    let burstIndex = 0;
    const emit = (at: number) => {
      const route = ROUTES[scene] ?? [[.5,.5]];
      const [px,py] = route[Math.min(burstIndex++,route.length-1)];
      const cx = width * (px + (random() - .5) * .07), cy = height * (py + (random() - .5) * .055);
      const type = scene;
      const amount = level === "prestige" ? 32 : level === "large" ? 24 : level === "medium" ? 18 : 12;
      const kind = type.includes("heart") || type === "kiss-hearts" || type === "ruby-pulse" ? "heart"
        : type.includes("petal") || type.includes("bloom") || type === "flower-glow" ? "petal"
          : type.includes("macaron") || type === "box-open" ? "round"
            : type.includes("crystal") || type.includes("diamond") || type === "lightning" ? "shard"
              : type === "swan-glide" ? "droplet" : type === "cat-wave" || type === "bear-hug" || type === "bear-bow" ? "star" : "spark";
      const specificKind = type === "cat-wave" ? "paw" : type === "bear-hug" ? "heart" : type === "perfume-mist" ? "mist" : kind;
      burst(cx, cy, amount, level === "prestige" ? 5.8 : level === "large" ? 4.9 : 3.6, specificKind);
      if (["ring-turn", "diamond-turn", "crystal-glint"].includes(type)) burst(width * .5, height * .46, 13, 5, "shard");
      if (["chest-open", "box-open"].includes(type)) burst(width * .5, height * .55, 18, 2.4, "spark");
      void at;
    };
    const drawHeart = (x: number, y: number, s: number) => { ctx.beginPath(); ctx.moveTo(x, y + s * .35); ctx.bezierCurveTo(x - s * 1.2, y - s * .3, x - s * .7, y - s, x, y - s * .45); ctx.bezierCurveTo(x + s * .7, y - s, x + s * 1.2, y - s * .3, x, y + s * .35); ctx.fill(); };
    const draw = (now: number) => {
      if (!alive) return;
      const elapsed = now - (start ?? now); const dt = Math.min(32, previous ? now - previous : 16); previous = now;
      ctx.clearRect(0, 0, width, height); ctx.globalCompositeOperation = "lighter";
      timeline.forEach(time => { if (elapsed >= time && !fired.has(time)) { fired.add(time); emit(time); } });
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]; p.age += dt; p.x += p.vx * dt / 16.7; p.y += p.vy * dt / 16.7;
        p.vx *= .986; p.vy = p.vy * .987 + (p.kind === "petal" || p.kind === "droplet" ? .024 : .008);
        if (p.age > p.life) { particles.splice(i, 1); continue; }
        const alpha = Math.min(1, p.age / 100, (p.life - p.age) / 260); ctx.globalAlpha = Math.max(0, alpha);
        ctx.fillStyle = p.color; ctx.shadowColor = p.color; ctx.shadowBlur = p.kind === "mist" ? 25 : 12;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.spin * p.age);
        if (p.kind === "heart") drawHeart(0, 0, p.size * 1.3);
        else if (p.kind === "petal") { ctx.beginPath(); ctx.ellipse(0, 0, p.size * 1.7, p.size * .72, .65, 0, Math.PI * 2); ctx.fill(); }
        else if (p.kind === "shard") { ctx.beginPath(); ctx.moveTo(0, -p.size * 1.8); ctx.lineTo(p.size * .55, 0); ctx.lineTo(0, p.size * 1.8); ctx.lineTo(-p.size * .55, 0); ctx.closePath(); ctx.fill(); }
        else if (p.kind === "mist") { ctx.globalAlpha *= .12; ctx.shadowBlur = 34; ctx.beginPath(); ctx.ellipse(0, 0, p.size * 4, p.size * 2.5, 0, 0, Math.PI * 2); ctx.fill(); }
        else if (p.kind === "droplet") { ctx.beginPath(); ctx.ellipse(0, 0, p.size * .65, p.size * 1.6, 0, 0, Math.PI * 2); ctx.fill(); }
        else if (p.kind === "star") { ctx.beginPath(); for (let n=0;n<10;n++){ const a=-Math.PI/2+n*Math.PI/5, r=n%2?p.size*.45:p.size*1.4; ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r); } ctx.closePath(); ctx.fill(); }
        else if (p.kind === "paw") { ctx.beginPath(); ctx.arc(0,p.size*.5,p.size*.7,0,Math.PI*2); ctx.fill(); for(let n=0;n<3;n++){ctx.beginPath();ctx.arc((n-1)*p.size*.9,-p.size*.55,p.size*.42,0,Math.PI*2);ctx.fill();} }
        else { ctx.beginPath(); ctx.arc(0, 0, p.size, 0, Math.PI * 2); ctx.fill(); }
        ctx.restore();
      }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
      if (elapsed < 4900 || particles.length) raf = requestAnimationFrame(draw);
    };
    const start = performance.now(); raf = requestAnimationFrame(draw);
    return () => { alive = false; cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, [scene, seed, level]);
  return <canvas ref={ref} className="rg-gift-scene-canvas" aria-hidden="true" />;
}

