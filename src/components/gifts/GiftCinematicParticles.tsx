"use client";

import { useEffect, useRef } from "react";
import type { GiftEvent } from "@/lib/gifts/types";

type Shape = "petal" | "heart" | "candy" | "kiss" | "hug" | "tulip" | "chocolate" | "bolt" | "butterfly" | "macaron" | "ring" | "crystal" | "salute" | "bloom" | "mist" | "magic" | "ruby" | "chest" | "prism" | "crown" | "paw" | "star" | "ripple";
type Theme = { shape: Shape; colors: string[]; count: number; spread: number; gravity: number; premium?: boolean };
type Particle = { x: number; y: number; vx: number; vy: number; age: number; life: number; size: number; spin: number; color: string };

const THEMES: Record<string, Theme> = {
  petals: { shape: "petal", colors: ["#ff647f", "#ffc1cd", "#f5a2b9"], count: 28, spread: 1, gravity: .035 },
  "double-heartbeat": { shape: "heart", colors: ["#ff5278", "#ffafc4", "#ffe0e8"], count: 20, spread: .48, gravity: -.012 },
  bounce: { shape: "candy", colors: ["#ffca67", "#79e1df", "#ff79a5"], count: 22, spread: .65, gravity: .018 },
  "kiss-hearts": { shape: "kiss", colors: ["#ff5884", "#e78acb", "#ffd4e0"], count: 24, spread: .55, gravity: -.035 },
  "bear-hug": { shape: "hug", colors: ["#e8ae7a", "#ff8c9f", "#f7cf8e"], count: 28, spread: .68, gravity: -.025 },
  bloom: { shape: "tulip", colors: ["#ff738d", "#fab3d1", "#f8d676"], count: 32, spread: .82, gravity: -.012 },
  "box-open": { shape: "chocolate", colors: ["#dda36d", "#f5d19a", "#a66a4c"], count: 26, spread: .65, gravity: -.025 },
  lightning: { shape: "bolt", colors: ["#fff19b", "#83dfff", "#f5bd4f"], count: 34, spread: .9, gravity: .012 },
  butterfly: { shape: "butterfly", colors: ["#c5a6ff", "#80e1e6", "#ffc7ee"], count: 26, spread: .9, gravity: -.018 },
  "macarons-bounce": { shape: "macaron", colors: ["#ff9dad", "#93d9c5", "#d2a7ee"], count: 24, spread: .68, gravity: .02 },
  "ring-turn": { shape: "ring", colors: ["#ffe29a", "#fff5d3", "#e6b64f"], count: 22, spread: .72, gravity: -.01 },
  "crystal-glint": { shape: "crystal", colors: ["#b7d9ff", "#f4fbff", "#b4a2ff"], count: 32, spread: .78, gravity: .005 },
  "bear-bow": { shape: "salute", colors: ["#edb477", "#ffd481", "#fff0c4"], count: 28, spread: .7, gravity: -.025 },
  "flower-glow": { shape: "bloom", colors: ["#ffe481", "#ff9bb5", "#f9d4ff"], count: 32, spread: .82, gravity: -.012 },
  "perfume-mist": { shape: "mist", colors: ["#d9b5f4", "#a8e9eb", "#ffe0f0"], count: 28, spread: .58, gravity: -.048 },
  "unicorn-nod": { shape: "magic", colors: ["#f8c5ff", "#82ddff", "#ffe89a"], count: 38, spread: .92, gravity: -.018, premium: true },
  "ruby-pulse": { shape: "ruby", colors: ["#ff405c", "#ff9d82", "#ffcfb9"], count: 34, spread: .62, gravity: -.01, premium: true },
  "chest-open": { shape: "chest", colors: ["#ffd56f", "#fff0ad", "#ff9e58"], count: 42, spread: .86, gravity: -.035, premium: true },
  "diamond-turn": { shape: "prism", colors: ["#c5a1ff", "#89e5ff", "#fff5c0"], count: 46, spread: .9, gravity: -.005, premium: true },
  "crown-bloom": { shape: "crown", colors: ["#ffd274", "#ff98bd", "#c4a2ff"], count: 42, spread: .88, gravity: -.02, premium: true },
  "cat-wave": { shape: "paw", colors: ["#f1c78f", "#ffc2cf", "#ffe6a2"], count: 36, spread: .8, gravity: -.018, premium: true },
  "shooting-star": { shape: "star", colors: ["#fff0a2", "#91dcff", "#f9b6ff"], count: 52, spread: 1, gravity: -.006, premium: true },
  "swan-glide": { shape: "ripple", colors: ["#c4e8ff", "#fff4d0", "#9bcfff"], count: 42, spread: .82, gravity: -.006, premium: true },
};

function starPath(ctx: CanvasRenderingContext2D, points = 5) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const radius = i % 2 ? 0.43 : 1;
    const angle = -Math.PI / 2 + i * Math.PI / points;
    const x = Math.cos(angle) * radius, y = Math.sin(angle) * radius;
    if (!i) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function heartPath(ctx: CanvasRenderingContext2D) {
  ctx.beginPath(); ctx.moveTo(0, .35); ctx.bezierCurveTo(-1.1, -.3, -.55, -1, 0, -.48);
  ctx.bezierCurveTo(.55, -1, 1.1, -.3, 0, .35); ctx.closePath();
}

function drawShape(ctx: CanvasRenderingContext2D, shape: Shape, p: Particle, progress: number) {
  const size = p.size * (shape === "mist" || shape === "ripple" ? 4 : 1);
  ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.spin + p.age * .001); ctx.scale(size, size);
  ctx.globalAlpha = Math.min(1, p.age / 100, (p.life - p.age) / 170); ctx.fillStyle = p.color; ctx.strokeStyle = p.color;
  switch (shape) {
    case "heart": case "kiss": case "ruby": heartPath(ctx); ctx.fill(); break;
    case "petal": case "tulip": case "bloom":
      ctx.beginPath(); ctx.moveTo(0, .7); ctx.bezierCurveTo(-1.05, .1, -.42, -.9, 0, -1); ctx.bezierCurveTo(.6, -.65, 1.05, .15, 0, .7); ctx.fill(); break;
    case "candy":
      ctx.fillRect(-.62, -.42, 1.24, .84); ctx.beginPath(); ctx.moveTo(-.62, -.38); ctx.lineTo(-1.05, -.72); ctx.lineTo(-.95, 0); ctx.lineTo(-1.05, .72); ctx.lineTo(-.62, .38); ctx.fill();
      ctx.beginPath(); ctx.moveTo(.62, -.38); ctx.lineTo(1.05, -.72); ctx.lineTo(.95, 0); ctx.lineTo(1.05, .72); ctx.lineTo(.62, .38); ctx.fill(); break;
    case "chocolate": ctx.fillRect(-.6, -.6, 1.2, 1.2); ctx.globalAlpha *= .5; ctx.strokeRect(-.3, -.3, .6, .6); break;
    case "bolt": ctx.beginPath(); ctx.moveTo(.2,-1); ctx.lineTo(-.55,.05); ctx.lineTo(-.08,.05); ctx.lineTo(-.35,1); ctx.lineTo(.58,-.2); ctx.lineTo(.12,-.2); ctx.closePath(); ctx.fill(); break;
    case "butterfly":
      ctx.beginPath(); ctx.ellipse(-.48,-.1,.52,.78,-.45,0,Math.PI*2); ctx.ellipse(.48,-.1,.52,.78,.45,0,Math.PI*2); ctx.fill(); ctx.fillRect(-.07,-.56,.14,1.12); break;
    case "macaron": ctx.beginPath(); ctx.ellipse(0,-.2,1,.58,0,Math.PI,0); ctx.ellipse(0,.2,1,.58,0,0,Math.PI); ctx.fill(); ctx.fillRect(-.93,-.12,1.86,.24); break;
    case "ring": ctx.beginPath(); ctx.ellipse(0,.18,.94,.44,-.2,0,Math.PI*2); ctx.lineWidth=.22; ctx.stroke(); ctx.beginPath(); ctx.moveTo(-.2,-.2); ctx.lineTo(0,-.68); ctx.lineTo(.2,-.2); ctx.stroke(); break;
    case "crystal": case "prism":
      ctx.beginPath(); ctx.moveTo(0,-1); ctx.lineTo(.82,-.3); ctx.lineTo(.48,1); ctx.lineTo(-.48,1); ctx.lineTo(-.82,-.3); ctx.closePath(); ctx.fill();
      ctx.globalAlpha *= .5; ctx.beginPath(); ctx.moveTo(0,-1); ctx.lineTo(0,1); ctx.moveTo(-.82,-.3); ctx.lineTo(.48,1); ctx.moveTo(.82,-.3); ctx.lineTo(-.48,1); ctx.stroke(); break;
    case "mist": ctx.beginPath(); ctx.arc(-.35,0,.55,0,Math.PI*2); ctx.arc(.35,-.1,.68,0,Math.PI*2); ctx.fill(); break;
    case "chest": case "crown": case "salute":
      if (shape === "chest") { ctx.fillRect(-.8,-.25,1.6,.9); ctx.beginPath(); ctx.moveTo(-.8,-.25); ctx.quadraticCurveTo(0,-1,.8,-.25); ctx.closePath(); ctx.fill(); }
      else if (shape === "crown") { ctx.beginPath(); ctx.moveTo(-1,.55); ctx.lineTo(-.8,-.55); ctx.lineTo(-.15,.05); ctx.lineTo(.1,-.8); ctx.lineTo(.55,.05); ctx.lineTo(.95,-.55); ctx.lineTo(.8,.55); ctx.closePath(); ctx.fill(); }
      else { starPath(ctx,4); ctx.fill(); }
      break;
    case "paw": ctx.beginPath(); ctx.ellipse(0,.38,.65,.48,0,0,Math.PI*2); ctx.fill();
      for (const [x,y] of [[-.55,-.28],[-.2,-.55],[.22,-.55],[.57,-.26]]) { ctx.beginPath(); ctx.arc(x,y,.22,0,Math.PI*2); ctx.fill(); } break;
    case "ripple": ctx.beginPath(); ctx.ellipse(0,0,1,.34,0,0,Math.PI*2); ctx.lineWidth=.16; ctx.stroke(); break;
    case "star": case "magic": case "hug": starPath(ctx, shape === "magic" ? 4 : 5); ctx.fill(); break;
  }
  ctx.restore();
  void progress;
}

export function GiftCinematicParticles({ event, duration }: { event: GiftEvent; duration: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current, ctx = canvas?.getContext("2d", { alpha: true });
    if (!canvas || !ctx) return;
    const theme = THEMES[event.gift.animation_type];
    if (!theme) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const life = reduced ? 500 : duration;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(window.innerWidth * dpr); canvas.height = Math.round(window.innerHeight * dpr);
    const w = window.innerWidth, h = window.innerHeight;
    const cx = w * .5, cy = event.animationTier === "prestige" ? h * .47 : Math.min(h * .27, 240);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const particles: Particle[] = [];
    const count = reduced ? 4 : Math.round(theme.count * (event.animationTier === "small" ? .58 : theme.premium ? 1.35 : 1));
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i / count) + (Math.random() - .5) * .22;
      const speed = (.45 + Math.random() * 2.5) * theme.spread;
      particles.push({ x: cx + (Math.random() - .5) * 32, y: cy + (Math.random() - .5) * 20,
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - (theme.gravity < 0 ? .5 : 0), age: Math.random() * 180,
        life: life * (.58 + Math.random() * .44), size: 2 + Math.random() * (theme.premium ? 4 : 3), spin: Math.random() * 6.28,
        color: theme.colors[i % theme.colors.length] });
    }
    let frame = 0, alive = true;
    const start = performance.now();
    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(window.innerWidth * ratio); canvas.height = Math.round(window.innerHeight * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    };
    const draw = (now: number) => {
      if (!alive) return;
      const elapsed = now - start, p = Math.min(1, elapsed / life);
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      if (!reduced) {
        // Gift-specific light choreography, distinct from the icon's own motion.
        const pulse = Math.sin(p * Math.PI * (theme.shape === "heart" || theme.shape === "ruby" ? 4 : 2));
        const radius = 48 + (1 - p) * (theme.premium ? 210 : 118) + pulse * 10;
        const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(1, radius));
        glow.addColorStop(0, `${theme.colors[0]}44`); glow.addColorStop(1, `${theme.colors[0]}00`);
        ctx.fillStyle = glow; ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
      }
      for (const particle of particles) {
        const age = particle.age + elapsed, progress = Math.min(1, age / particle.life);
        if (progress >= 1) continue;
        const drift = theme.shape === "petal" || theme.shape === "butterfly" ? Math.sin(age / 170 + particle.spin) * 1.3 : 0;
        particle.x += particle.vx * .22;
        drawShape(ctx, theme.shape, { ...particle, x: particle.x + drift, y: particle.y + particle.vy * .22 + age * age * theme.gravity * .00035,
          age, size: particle.size * (theme.shape === "ripple" ? .6 + progress * 1.3 : 1) }, progress);
      }
      if (elapsed < life) frame = requestAnimationFrame(draw);
      else ctx.clearRect(0, 0, w, h);
    };
    window.addEventListener("resize", resize);
    frame = requestAnimationFrame(draw);
    return () => { alive = false; cancelAnimationFrame(frame); window.removeEventListener("resize", resize); };
  }, [event.id, event.gift.animation_type, event.animationTier, duration]);

  return <canvas ref={canvasRef} className="rg-gift-cinematic-particles" aria-hidden="true" />;
}
