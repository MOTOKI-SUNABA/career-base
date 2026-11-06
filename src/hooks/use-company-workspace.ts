"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { CompanyWorkspace } from "@/types";
import { EMPTY_COMPANY_WORKSPACE, readCompanyWorkspace, reorderVisible, writeCompanyWorkspace } from "@/lib/company-workspace";
import { scheduleCloudUpload, STORAGE_RESTORED_EVENT } from "@/lib/cloud-sync";

export function useCompanyWorkspace() {
  const hydrated = useSyncExternalStore(() => () => undefined, () => true, () => false);
  const [stored, setStored] = useState(readCompanyWorkspace);
  const current = useRef(stored);
  useEffect(() => {
    const refresh = () => { current.current = readCompanyWorkspace(); setStored(current.current); };
    window.addEventListener(STORAGE_RESTORED_EVENT, refresh);
    return () => window.removeEventListener(STORAGE_RESTORED_EVENT, refresh);
  }, []);
  const update = useCallback((recipe: (workspace: CompanyWorkspace) => CompanyWorkspace) => {
    const next = recipe(current.current);
    if (next === current.current) return true;
    if (!writeCompanyWorkspace(next)) return false;
    current.current = next; setStored(next);
    try { scheduleCloudUpload(); } catch { /* Local data is saved; manual cloud sync can retry. */ }
    return true;
  }, []);
  const reorder = useCallback((activeId: string, overId: string, visibleIds: string[]) => update((workspace) => {
    const companies = reorderVisible(workspace.companies, activeId, overId, visibleIds);
    return companies === workspace.companies ? workspace : { ...workspace, companies };
  }), [update]);
  return { ...(hydrated ? stored : EMPTY_COMPANY_WORKSPACE), hydrated, update, reorder };
}
