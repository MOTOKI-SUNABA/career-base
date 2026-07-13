"use client";
import { useCallback, useState, useSyncExternalStore } from "react";
import { readStorage, writeStorage } from "@/lib/storage";
export function useLocalStorageCollection<T extends { id: string }>(key: string, initial: T[]) {
  const hydrated = useSyncExternalStore(() => () => undefined, () => true, () => false);
  const [storedItems, setItems] = useState<T[]>(() => readStorage(key, initial));
  const update = useCallback((recipe: (current: T[]) => T[]) => setItems((current) => { const next = recipe(current); writeStorage(key, next); return next; }), [key]);
  return { items: hydrated ? storedItems : initial, hydrated, add: useCallback((item: T) => update((current) => [item, ...current]), [update]), remove: useCallback((id: string) => update((current) => current.filter((item) => item.id !== id)), [update]), replace: useCallback((item: T) => update((current) => current.map((value) => value.id === item.id ? item : value)), [update]) };
}
