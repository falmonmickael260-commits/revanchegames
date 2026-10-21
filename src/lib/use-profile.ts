"use client";

import { useCallback } from "react";
import { createLocalStore } from "./create-local-store";

const DEFAULT_NAME = "Joueur";
const profileStore = createLocalStore<string>("profile-name", DEFAULT_NAME);

export function useProfile() {
  const [name, setName] = profileStore.useValue();

  const updateName = useCallback((next: string) => {
    const trimmed = next.trim().slice(0, 24);
    setName(trimmed || DEFAULT_NAME);
  }, [setName]);

  return { name, updateName };
}
