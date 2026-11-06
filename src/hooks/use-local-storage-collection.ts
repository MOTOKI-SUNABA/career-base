"use client";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { scheduleCloudUpload, STORAGE_RESTORED_EVENT } from "@/lib/cloud-sync";
import { readStorage, writeStorage } from "@/lib/storage";

const EMPTY_COLLECTION: never[] = [];

export function useLocalStorageCollection<T extends { id: string }>(key: string, initial: T[] = EMPTY_COLLECTION) {
  const hydrated = useSyncExternalStore(() => () => undefined, () => true, () => false);
  const [storedItems, setItems] = useState<T[]>(() => readStorage(key, initial));
  const currentItems = useRef(storedItems);
  useEffect(() => {
    const refresh = () => { currentItems.current = readStorage(key, initial); setItems(currentItems.current); };
    window.addEventListener(STORAGE_RESTORED_EVENT, refresh);
    return () => window.removeEventListener(STORAGE_RESTORED_EVENT, refresh);
  }, [initial, key]);
  const update = useCallback((recipe: (current: T[]) => T[]) => {
    const next = recipe(currentItems.current);
    if (!writeStorage(key, next)) return false;
    currentItems.current = next;
    setItems(next);
    try { scheduleCloudUpload(); } catch { /* Manual cloud sync remains available. */ }
    return true;
  }, [key]);
  return { items: hydrated ? storedItems : initial, hydrated, add: useCallback((item: T) => update((current) => [item, ...current]), [update]), remove: useCallback((id: string) => update((current) => current.filter((item) => item.id !== id)), [update]), replace: useCallback((item: T) => update((current) => current.map((value) => value.id === item.id ? item : value)), [update]) };
}
