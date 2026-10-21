"use client";

import { motion } from "framer-motion";

type LightningProps = {
  /** Drives the draw-on animation: 0 = invisible, 1 = fully struck. */
  progress: number;
  durationMs: number;
};

/**
 * Hand-drawn jagged bolt with two branch forks. Rendered twice per stroke:
 * a wide blurred cyan glow underneath, a thin bright violet-white core on top.
 */
export function Lightning({ progress, durationMs }: LightningProps) {
  const seconds = durationMs / 1000;
  const mainPath =
    "M200,10 L182,150 L236,162 L158,330 L238,344 L196,420 L214,590";
  const branchLeft = "M158,330 L64,392 L104,470 L58,540";
  const branchRight = "M238,344 L326,276 L300,210";

  const pathTransition = {
    duration: seconds,
    ease: [0.16, 0.85, 0.35, 1] as const,
  };

  return (
    <svg
      viewBox="0 0 400 600"
      className="pointer-events-none absolute left-1/2 top-1/2 h-[120%] w-auto -translate-x-1/2 -translate-y-1/2 sm:h-[90%]"
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <filter id="rg-bolt-glow" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="9" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <linearGradient id="rg-bolt-core" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fdfeff" />
          <stop offset="45%" stopColor="var(--rg-cyan-soft)" />
          <stop offset="100%" stopColor="var(--rg-violet-soft)" />
        </linearGradient>
      </defs>

      <g filter="url(#rg-bolt-glow)" opacity={0.8}>
        {[mainPath, branchLeft, branchRight].map((d, i) => (
          <motion.path
            key={`glow-${i}`}
            d={d}
            stroke="var(--rg-cyan)"
            strokeWidth={i === 0 ? 7 : 4}
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{
              pathLength: progress,
              opacity: progress > 0 ? 1 : 0,
            }}
            transition={pathTransition}
          />
        ))}
      </g>

      {[mainPath, branchLeft, branchRight].map((d, i) => (
        <motion.path
          key={`core-${i}`}
          d={d}
          stroke="url(#rg-bolt-core)"
          strokeWidth={i === 0 ? 2.5 : 1.4}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{
            pathLength: progress,
            opacity: progress > 0 ? 1 : 0,
          }}
          transition={pathTransition}
        />
      ))}
    </svg>
  );
}
