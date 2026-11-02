"use client";

import { useEffect } from "react";
import { createLocalStore } from "@/lib/create-local-store";

export type AppTheme = "light" | "dark";

const themeStore = createLocalStore<AppTheme>("theme", "dark");

/** Applies the saved app appearance to the whole platform without touching game iframes. */
export function ThemePreferenceSync() {
  const [theme] = themeStore.useValue();

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute(
      "content",
      theme === "dark" ? "#0b0d18" : "#f6f4ef",
    );
  }, [theme]);

  return null;
}

export function useThemePreference() {
  return themeStore.useValue();
}
