"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";

type ParticlesProps = {
  count?: number;
  phase: "gather" | "disperse" | "hidden";
};

type Particle = {
  x: number;
  y: number;
  size: number;
  delay: number;
  color: "cyan" | "violet";
};

function seededParticles(count: number): Particle[] {
  // Deterministic pseudo-random spread so particles don't reshuffle on re-render.
  let seed = 42;
  const rand = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  return Array.from({ length: count }, (_, i) => ({
    x: rand() * 100,
    y: rand() * 100,
    size: 1.5 + rand() * 2.5,
    delay: (i % 10) * 0.07,
    color: rand() > 0.5 ? "cyan" : "violet",
  }));
}

export function Particles({ count = 26, phase }: ParticlesProps) {
  const particles = useMemo(() => seededParticles(count), [count]);

  if (phase === "hidden") return null;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {particles.map((p, i) => (
        <motion.span
          key={i}
          className="absolute rounded-full"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            background: p.color === "cyan" ? "var(--rg-cyan)" : "var(--rg-violet)",
            boxShadow: `0 0 ${p.size * 3}px ${
              p.color === "cyan" ? "var(--rg-cyan)" : "var(--rg-violet)"
            }`,
          }}
          initial={{ opacity: 0, scale: 0 }}
          animate={
            phase === "gather"
              ? { opacity: [0, 0.9, 0.5], scale: [0, 1, 1], y: [0, -6, 0] }
              : { opacity: 0, scale: 0, y: -40, x: (p.x - 50) * 0.6 }
          }
          transition={{
            duration: phase === "gather" ? 1.6 : 0.9,
            delay: p.delay,
            ease: "easeOut",
            repeat: phase === "gather" ? Infinity : 0,
            repeatType: "mirror",
          }}
        />
      ))}
    </div>
  );
}
