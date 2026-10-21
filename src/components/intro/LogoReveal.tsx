"use client";

import { motion } from "framer-motion";

const container = {
  hidden: {},
  shown: {
    transition: { staggerChildren: 0.045, delayChildren: 0.05 },
  },
};

const letter = {
  hidden: { opacity: 0, y: 18, filter: "blur(6px)" },
  shown: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.5, ease: [0.16, 0.85, 0.35, 1] as const },
  },
};

function AnimatedWord({ word }: { word: string }) {
  return (
    <span className="inline-flex overflow-hidden">
      {word.split("").map((char, i) => (
        <motion.span key={i} variants={letter} className="inline-block">
          {char}
        </motion.span>
      ))}
    </span>
  );
}

export function LogoReveal({ show, tagline }: { show: boolean; tagline?: boolean }) {
  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate={show ? "shown" : "hidden"}
      className="relative flex flex-col items-center text-center"
    >
      <span
        className="font-display text-3xl font-semibold tracking-[0.35em] text-text sm:text-4xl"
        style={{ textShadow: "0 0 24px rgba(47,230,255,0.35)" }}
      >
        <AnimatedWord word="REVANCHE" />
      </span>
      <span
        className="rg-glow-text font-display text-5xl font-bold tracking-[0.2em] sm:text-7xl"
        style={{
          backgroundSize: "220% 100%",
          filter: "drop-shadow(0 0 30px rgba(178,75,255,0.45))",
        }}
      >
        <AnimatedWord word="GAMES" />
      </span>
      {tagline && (
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={show ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="mt-4 font-body text-xs uppercase tracking-[0.4em] text-text-dim"
        >
          La bibliothèque de jeux entre amis
        </motion.p>
      )}
    </motion.div>
  );
}
