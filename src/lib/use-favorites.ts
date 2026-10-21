"use client";

import { useCallback } from "react";
import { createLocalStore } from "./create-local-store";

const favoritesStore = createLocalStore<string[]>("favorites", []);

export function useFavorites() {
  const [favorites, setFavorites] = favoritesStore.useValue();

  const toggleFavorite = useCallback((gameId: string) => {
    const current = favoritesStore.getSnapshot();
    const next = current.includes(gameId)
      ? current.filter((id) => id !== gameId)
      : [...current, gameId];
    setFavorites(next);
  }, [setFavorites]);

  const isFavorite = useCallback(
    (gameId: string) => favorites.includes(gameId),
    [favorites],
  );

  return { favorites, toggleFavorite, isFavorite };
}
