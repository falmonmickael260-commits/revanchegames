"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { GiftEvent } from "@/lib/gifts/types";
import { GiftArt } from "./GiftArt";

type Particle = { x: number; y: number; vx: number; vy: number; life: number; age: number; size: number; color: string; drag: number };
const COLORS = ["#ffd98d", "#ff526d", "#ca79ff", "#6cdcff", "#fff2d1", "#ff9b54"];

function avatarStyle(url: string | null | undefined): CSSProperties {
  return url ? { backgroundImage: `url("${url.replaceAll('"', "")}")` } : {};
}

export function GiftFireworkAnimation({ event, onClose }: { event: GiftEvent; onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [bannerVisible, setBannerVisible] = useState(false);
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
        context.shadowBlur = 24;
        context.shadowColor = "#ffe8b1";
        const glow = context.createRadialGradient(x, y, 0, x, y, 22);
        glow.addColorStop(0, "#fffdf6"); glow.addColorStop(0.2, "#ffe8ac"); glow.addColorStop(1, "#ff6f55");
        context.fillStyle = glow;
        context.beginPath(); context.arc(x, y, 12, 0, Math.PI * 2); context.fill();
        context.strokeStyle = "#ffc86a"; context.lineWidth = 3; context.beginPath();
        context.moveTo(x, y + 13); context.quadraticCurveTo(x + 16, y + 34, x + Math.sin(now / 23) * 9, y + 62); context.stroke();
        context.restore();
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
    const banner = setTimeout(() => setBannerVisible(true), reduced ? 0 : 1450);
    const flashOn = setTimeout(() => setFinalFlash(true), reduced ? 0 : 4800);
    const flash = setTimeout(() => setFinalFlash(false), 5100);
    return () => {
      alive = false; cancelAnimationFrame(frame); clearTimeout(banner); clearTimeout(flashOn); clearTimeout(flash);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <div className={`rg-firework-stage ${finalFlash ? "is-final-flash" : ""}`} role="alertdialog" aria-label={`${event.senderName} offre ${event.gift.name} à ${event.recipientName}`}>
    <canvas ref={canvasRef} className="rg-firework-canvas" aria-hidden="true" />
    <div className="rg-firework-vignette" aria-hidden="true" />
    <button type="button" className="rg-firework-close" onClick={onClose} aria-label="Fermer l’animation">×</button>
    <div className={`rg-firework-banner ${bannerVisible ? "is-visible" : ""}`} aria-live="polite">
      {!event.preview && <div className="rg-firework-avatars">
        <span className="rg-firework-avatar" style={avatarStyle(event.senderAvatarUrl)} aria-label={event.senderName} />
        <i aria-hidden="true">✦</i>
        <span className="rg-firework-avatar" style={avatarStyle(event.recipientAvatarUrl)} aria-label={event.recipientName} />
      </div>}
      <p>{event.preview ? <><strong>{event.gift.name}</strong> · ta collection ×{event.quantity}</>
        : <><strong>{event.senderName}</strong> offre un <b>{event.gift.name}</b> à <strong>{event.recipientName}</strong></>}</p>
      <blockquote>« {event.celebrationMessage || "Certaines personnes méritent bien plus que des étoiles… Elles méritent un ciel entier illuminé pour elles."} »</blockquote>
      <GiftArt src={event.gift.image_url} name={event.gift.name} animation={event.gift.animation_type} size={76} />
    </div>
  </div>;
}
