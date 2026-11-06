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
    if (next === currentItems.current) return true;
    if (!writeStorage(key, next)) return false;
    currentItems.current = next;
    setItems(next);
    try { scheduleCloudUpload(); } catch { /* Manual cloud sync remains available. */ }
    return true;
  }, [key]);
  const reorder = useCallback((activeId: string, overId: string, visibleIds: string[]) => update((current) => {
    const visible = new Set(visibleIds);
    const ordered = current.filter((item) => visible.has(item.id));
    const from = ordered.findIndex((item) => item.id === activeId);
    const to = ordered.findIndex((item) => item.id === overId);
    if (from < 0 || to < 0 || from === to) return current;
    ordered.splice(to, 0, ordered.splice(from, 1)[0]);
    let index = 0;
    // Reorder only visible slots, keeping filtered-out records in place.
    return current.map((item) => visible.has(item.id) ? ordered[index++] : item);
  }), [update]);
  return { items: hydrated ? storedItems : initial, hydrated, reorder, update, add: useCallback((item: T) => update((current) => [item, ...current]), [update]), remove: useCallback((id: string) => update((current) => current.filter((item) => item.id !== id)), [update]), replace: useCallback((item: T) => update((current) => current.map((value) => value.id === item.id ? item : value)), [update]) };
}
