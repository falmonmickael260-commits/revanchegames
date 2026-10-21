"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Lightning } from "./Lightning";
import { Particles } from "./Particles";
import { LogoReveal } from "./LogoReveal";
import { useReducedMotion } from "@/lib/use-reduced-motion";

type Stage = "dark" | "build" | "strike" | "reveal" | "stabilize" | "exit";

type Timings = Record<Stage, number>;

const FULL_TIMINGS: Timings = {
  dark: 650,
  build: 700,
  strike: 480,
  reveal: 1050,
  stabilize: 750,
  exit: 650,
};

const FAST_TIMINGS: Timings = {
  dark: 120,
  build: 160,
  strike: 340,
  reveal: 620,
  stabilize: 320,
  exit: 500,
};

const STAGE_ORDER: Stage[] = ["dark", "build", "strike", "reveal", "stabilize", "exit"];
const SAFETY_TIMEOUT_MS = 9000;

export function IntroLoader({
  returning,
  onDone,
}: {
  returning: boolean;
  onDone: () => void;
}) {
  const reducedMotion = useReducedMotion();
  const [stage, setStage] = useState<Stage>("dark");
  const [skipped, setSkipped] = useState(false);
  const timeouts = useRef<ReturnType<typeof setTimeout>[]>([]);

  const timings = returning ? FAST_TIMINGS : FULL_TIMINGS;

  useEffect(() => {
    if (reducedMotion) {
      const t = setTimeout(onDone, 350);
      return () => clearTimeout(t);
    }

    let elapsed = 0;
    STAGE_ORDER.forEach((s, i) => {
      if (i === 0) return;
      elapsed += timings[STAGE_ORDER[i - 1]];
      timeouts.current.push(
        setTimeout(() => setStage(s), elapsed),
      );
    });
    const totalDuration = STAGE_ORDER.reduce((sum, s) => sum + timings[s], 0);
    timeouts.current.push(setTimeout(onDone, totalDuration));

    const safety = setTimeout(onDone, SAFETY_TIMEOUT_MS);
    const scheduled = timeouts.current;

    return () => {
      scheduled.forEach(clearTimeout);
      clearTimeout(safety);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reducedMotion]);

  function handleSkip() {
    if (skipped) return;
    setSkipped(true);
    timeouts.current.forEach(clearTimeout);
    setStage("exit");
    setTimeout(onDone, 420);
  }

  if (reducedMotion) {
    return (
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center bg-void"
        exit={{ opacity: 0 }}
      >
        <LogoReveal show tagline />
      </motion.div>
    );
  }

  const boltProgress = stage === "strike" || stage === "reveal" || stage === "stabilize" || stage === "exit" ? 1 : 0;
  const showLogo = stage === "reveal" || stage === "stabilize" || stage === "exit";
  const particlePhase: "gather" | "disperse" | "hidden" =
    stage === "dark" || stage === "build" ? "gather" : stage === "strike" ? "disperse" : "hidden";

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-void"
      exit={{ opacity: 0, scale: 1.12, filter: "blur(10px)" }}
      transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
    >
      {/* Ambient radial field that intensifies through build → strike */}
      <motion.div
        className="absolute inset-0"
        initial={{ opacity: 0 }}
        animate={{
          opacity: stage === "dark" ? 0.15 : stage === "build" ? 0.4 : 0.55,
        }}
        transition={{ duration: 0.6 }}
        style={{
          background:
            "radial-gradient(ellipse at 50% 55%, rgba(47,230,255,0.16), rgba(178,75,255,0.1) 45%, transparent 70%)",
        }}
      />

      <Particles phase={particlePhase} count={28} />

      <Lightning progress={boltProgress} durationMs={timings.strike} />

      {/* Flash at the moment of strike */}
      <AnimatePresence>
        {stage === "strike" && (
          <motion.div
            className="absolute inset-0 bg-white"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.22, 0] }}
            transition={{ duration: 0.4, times: [0, 0.3, 1] }}
          />
        )}
      </AnimatePresence>

      <div className="relative z-10">
        <LogoReveal show={showLogo} tagline={stage === "stabilize" || stage === "exit"} />
      </div>

      {(stage === "build" || stage === "strike" || stage === "reveal") && (
        <motion.button
          type="button"
          onClick={handleSkip}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute bottom-8 right-8 z-20 font-body text-xs uppercase tracking-[0.25em] text-text-faint transition-colors hover:text-text-dim focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan/60 rounded px-2 py-1"
        >
          Passer l&rsquo;intro →
        </motion.button>
      )}
    </motion.div>
  );
}
