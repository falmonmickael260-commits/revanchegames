"use client";

import { useCallback, useSyncExternalStore } from "react";
import { readStorage, writeStorage } from "./storage";

/**
 * A tiny localStorage-backed store compatible with useSyncExternalStore —
 * the React-recommended way to read external state without the
 * "setState in an effect" anti-pattern (and its SSR hydration flicker).
 */
export function createLocalStore<T>(key: string, fallback: T) {
  let cache: T | undefined;
  const listeners = new Set<() => void>();

  function getSnapshot(): T {
    if (cache === undefined) cache = readStorage<T>(key, fallback);
    return cache;
  }

  function set(value: T) {
    cache = value;
    writeStorage(key, value);
    listeners.forEach((listener) => listener());
  }

  function subscribe(listener: () => void) {
    listeners.add(listener);
    const onStorage = (event: StorageEvent) => {
      if (event.key === `rg:${key}`) {
        cache = undefined;
        listener();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(listener);
      window.removeEventListener("storage", onStorage);
    };
  }

  function useValue(): [T, (value: T) => void] {
    const value = useSyncExternalStore(subscribe, getSnapshot, () => fallback);
    const setValue = useCallback((next: T) => set(next), []);
    return [value, setValue];
  }

  return { useValue, getSnapshot, set };
}
