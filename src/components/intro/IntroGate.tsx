"use client";

import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { IntroLoader } from "./IntroLoader";
import { readStorage, writeStorage } from "@/lib/storage";

const KEY = "intro-seen";

export function IntroGate({ children }: { children: React.ReactNode }) {
  // Lazy initializer: safe during SSR (storage.ts no-ops without window) and
  // read once on the client before the first paint, so there's no flash of
  // the full intro for a returning visitor.
  const [returning] = useState<boolean>(() => readStorage<boolean>(KEY, false));
  const [showIntro, setShowIntro] = useState(true);

  function handleDone() {
    writeStorage(KEY, true);
    setShowIntro(false);
  }

  return (
    <>
      {children}
      <AnimatePresence>
        {showIntro && (
          <IntroLoader key="intro" returning={returning} onDone={handleDone} />
        )}
      </AnimatePresence>
    </>
  );
}
