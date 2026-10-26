"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";

/** A brief, tasteful pop-in — not shown if the viewer prefers reduced motion. */
export function SuccessBadge() {
  return (
    <motion.span
      initial={{ scale: 0.4, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 18 }}
      className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-cyan to-violet"
    >
      <Check className="h-8 w-8 text-void" strokeWidth={3} />
    </motion.span>
  );
}
