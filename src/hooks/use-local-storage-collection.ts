"use client";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { scheduleCloudUpload, STORAGE_RESTORED_EVENT } from "@/lib/cloud-sync";
import { readStorage, writeStorage } from "@/lib/storage";

const EMPTY_COLLECTION: never[] = [];

export function useLocalStorageCollection<T extends { id: string }>(key: string, initial: T[] = EMPTY_COLLECTION) {
  const hydrated = useSyncExternalStore(() => () => undefined, () => true, () => false);
  const [storedItems, setItems] = useState<T[]>(() => readStorage(key, initial));
  useEffect(() => {
    const refresh = () => setItems(readStorage(key, initial));
    window.addEventListener(STORAGE_RESTORED_EVENT, refresh);
    return () => window.removeEventListener(STORAGE_RESTORED_EVENT, refresh);
  }, [initial, key]);
  const update = useCallback((recipe: (current: T[]) => T[]) => setItems((current) => { const next = recipe(current); writeStorage(key, next); scheduleCloudUpload(); return next; }), [key]);
  return { items: hydrated ? storedItems : initial, hydrated, add: useCallback((item: T) => update((current) => [item, ...current]), [update]), remove: useCallback((id: string) => update((current) => current.filter((item) => item.id !== id)), [update]), replace: useCallback((item: T) => update((current) => current.map((value) => value.id === item.id ? item : value)), [update]) };
}
