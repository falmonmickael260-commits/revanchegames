"use client";

import { useEffect, useRef, useState } from "react";
import type { GiftEvent } from "@/lib/gifts/types";

type Particle = { x: number; y: number; vx: number; vy: number; life: number; age: number; size: number; color: string; drag: number };
const COLORS = ["#ffd98d", "#ff526d", "#ca79ff", "#6cdcff", "#fff2d1", "#ff9b54"];

export function GiftFireworkAnimation({ event }: { event: GiftEvent }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [finalFlash, setFinalFlash] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d", { alpha: true });
    if (!canvas || !context) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    let alive = true;
    const particles: Particle[] = [];
    const burstTimes = reduced ? [] : [880, 1480, 2260, 4170, 4930];
    const fired = new Set<number>();
    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 1.65);
      canvas.width = Math.floor(window.innerWidth * ratio);
      canvas.height = Math.floor(window.innerHeight * ratio);
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    };
    const pop = (elapsed: number) => {
      const w = window.innerWidth, h = window.innerHeight;
      const isFinal = elapsed > 4000;
      const centerX = w * ([0.22, 0.72, 0.5, 0.34, 0.64][burstTimes.indexOf(elapsed)] ?? 0.5);
      const centerY = h * ([0.3, 0.22, 0.38, 0.27, 0.24][burstTimes.indexOf(elapsed)] ?? 0.3);
      const count = isFinal ? 190 : elapsed < 2000 ? 105 : 125;
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 + Math.random() * 0.045;
        const speed = (isFinal ? 2.4 : 1.5) + Math.random() * (isFinal ? 5.6 : 4.2);
        particles.push({ x: centerX, y: centerY, vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed, life: 850 + Math.random() * 1150, age: 0,
          size: 1.2 + Math.random() * (isFinal ? 2.9 : 2.1), color: COLORS[(Math.random() * COLORS.length) | 0],
          drag: 0.982 + Math.random() * 0.012 });
      }
    };
    const drawRocket = (x: number, y: number, now: number) => {
      context.save();
      context.translate(x, y);
      const drift = Math.cos(now / 900) * 0.045;
      context.rotate(drift);
      const aura = context.createRadialGradient(0, 0, 2, 0, 0, 38);
      aura.addColorStop(0, "#fff8d8d9"); aura.addColorStop(0.34, "#ffb95788"); aura.addColorStop(1, "#ff765500");
      context.fillStyle = aura;
      context.beginPath(); context.arc(0, 0, 38, 0, Math.PI * 2); context.fill();

      const flameLength = 24 + Math.sin(now / 24) * 5;
      const flame = context.createLinearGradient(0, 8, 0, flameLength + 15);
      flame.addColorStop(0, "#fffce3"); flame.addColorStop(0.25, "#ffdb74"); flame.addColorStop(0.7, "#ff7b52"); flame.addColorStop(1, "#ed4e8900");
      context.fillStyle = flame;
      context.beginPath(); context.moveTo(-5, 8); context.quadraticCurveTo(-3, flameLength, Math.sin(now / 18) * 3, flameLength + 12);
      context.quadraticCurveTo(5, flameLength, 5, 8); context.closePath(); context.fill();

      context.shadowBlur = 18; context.shadowColor = "#ffe8ac";
      const shell = context.createLinearGradient(-9, 0, 9, 0);
      shell.addColorStop(0, "#dbeaff"); shell.addColorStop(0.35, "#fffefa"); shell.addColorStop(0.72, "#f7d9a0"); shell.addColorStop(1, "#b86a52");
      context.fillStyle = shell;
      context.beginPath(); context.moveTo(0, -25); context.bezierCurveTo(5, -18, 8, -11, 8, -4); context.lineTo(7, 10);
      context.quadraticCurveTo(0, 15, -7, 10); context.lineTo(-8, -4); context.bezierCurveTo(-8, -11, -5, -18, 0, -25); context.closePath(); context.fill();
      context.shadowBlur = 0;

      context.fillStyle = "#df5967";
      context.beginPath(); context.moveTo(-7, 3); context.lineTo(-14, 14); context.lineTo(-5, 11); context.closePath(); context.fill();
      context.beginPath(); context.moveTo(7, 3); context.lineTo(14, 14); context.lineTo(5, 11); context.closePath(); context.fill();
      context.fillStyle = "#dca751"; context.fillRect(-7, 5, 14, 2.5);
      context.fillStyle = "#7cd9ff"; context.strokeStyle = "#fff"; context.lineWidth = 1.5;
      context.beginPath(); context.arc(0, -6, 3.1, 0, Math.PI * 2); context.fill(); context.stroke();
      context.restore();
    };
    resize();
    window.addEventListener("resize", resize);
    const start = performance.now();
    const draw = (now: number) => {
      if (!alive) return;
      const elapsed = now - start;
      const w = window.innerWidth, h = window.innerHeight;
      context.clearRect(0, 0, w, h);
      context.globalCompositeOperation = "lighter";

      if (!reduced && elapsed < 900) {
        const p = Math.min(elapsed / 900, 1);
        const x = w * (0.49 + Math.sin(p * 1.6) * 0.025);
        const y = h * (0.88 - p * 0.63);
        context.save();
        context.strokeStyle = "#ffc86a"; context.lineWidth = 3; context.beginPath();
        context.moveTo(x, y + 13); context.quadraticCurveTo(x + 16, y + 34, x + Math.sin(now / 23) * 9, y + 62); context.stroke();
        context.restore();
        drawRocket(x, y, now);
        if (Math.random() > 0.28) particles.push({ x: x + (Math.random() - 0.5) * 10, y: y + 22,
          vx: (Math.random() - 0.5) * 2, vy: 1 + Math.random() * 2, life: 220 + Math.random() * 300,
          age: 0, size: 1 + Math.random() * 2.1, color: COLORS[(Math.random() * COLORS.length) | 0], drag: 0.97 });
      }
      for (const time of burstTimes) if (elapsed >= time && !fired.has(time)) { fired.add(time); pop(time); }

      const dt = 16.7;
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.age += dt; p.x += p.vx; p.y += p.vy;
        p.vx *= p.drag; p.vy = p.vy * p.drag + 0.042;
        if (p.age >= p.life) { particles.splice(i, 1); continue; }
        const fade = Math.min(1, (p.life - p.age) / 180, p.age / 90);
        context.globalAlpha = Math.max(0, fade);
        context.fillStyle = p.color;
        context.shadowBlur = 10; context.shadowColor = p.color;
        context.beginPath(); context.arc(p.x, p.y, p.size, 0, Math.PI * 2); context.fill();
      }
      context.globalAlpha = 1; context.globalCompositeOperation = "source-over";
      if (elapsed < 6600) frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    const flashOn = reduced ? undefined : setTimeout(() => setFinalFlash(true), 4800);
    const flash = reduced ? undefined : setTimeout(() => setFinalFlash(false), 5100);
    return () => {
      alive = false; cancelAnimationFrame(frame);
      if (flashOn) clearTimeout(flashOn);
      if (flash) clearTimeout(flash);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <div className={`rg-firework-stage ${finalFlash ? "is-final-flash" : ""}`} role="status" aria-label={`Animation ${event.gift.name}`}>
    <canvas ref={canvasRef} className="rg-firework-canvas" aria-hidden="true" />
    <div className="rg-firework-vignette" aria-hidden="true" />
  </div>;
}
