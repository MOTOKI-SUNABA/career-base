"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { consumeCloudSessionFromUrl, downloadCloudData, getCloudSession, initializeCloudData, isCloudConfigured, signInToCloud, signOutFromCloud, signUpToCloud, uploadLocalData } from "@/lib/cloud-sync";

type CloudNotice = { tone: "success" | "error"; text: string } | null;

interface CloudSyncContextValue {
  configured: boolean;
  loading: boolean;
  syncing: boolean;
  email: string | null;
  statusNotice: CloudNotice;
  signIn: (email: string, password: string) => Promise<string>;
  signUp: (email: string, password: string) => Promise<string>;
  signOut: () => Promise<string>;
  upload: () => Promise<string>;
  download: () => Promise<string>;
}

const CloudSyncContext = createContext<CloudSyncContextValue | null>(null);

export function CloudSyncProvider({ children }: { children: ReactNode }) {
  const configured = isCloudConfigured();
  const [loading, setLoading] = useState(configured);
  const [syncing, setSyncing] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState<CloudNotice>(null);

  useEffect(() => {
    let active = true;
    if (!configured) return;
    void (async () => {
      let session = await getCloudSession();
      try {
        const confirmedSession = await consumeCloudSessionFromUrl();
        if (confirmedSession) {
          session = confirmedSession;
          if (active) setStatusNotice({ tone: "success", text: "メールアドレスの確認が完了し、ログインしました。" });
        }
      } catch (error) {
        if (active) setStatusNotice({ tone: "error", text: error instanceof Error ? error.message : "メールアドレスを確認できませんでした。" });
      }
      if (!active) return;
      setEmail(session?.user.email ?? null);
      if (session) {
        setSyncing(true);
        try { await initializeCloudData(); } catch { /* 手動同期で再試行できます。 */ }
        if (active) setSyncing(false);
      }
      if (active) setLoading(false);
    })();
    return () => { active = false; };
  }, [configured]);

  const value = useMemo<CloudSyncContextValue>(() => ({
    configured,
    loading,
    syncing,
    email,
    statusNotice,
    async signIn(address, password) {
      setStatusNotice(null);
      setSyncing(true);
      try {
        const session = await signInToCloud(address, password);
        setEmail(session.user.email ?? address);
        return await initializeCloudData();
      } finally { setSyncing(false); }
    },
    async signUp(address, password) {
      setStatusNotice(null);
      setSyncing(true);
      try {
        const result = await signUpToCloud(address, password);
        if (result.signedIn) {
          const session = await getCloudSession();
          setEmail(session?.user.email ?? address);
          await initializeCloudData();
        }
        return result.message;
      } finally { setSyncing(false); }
    },
    async signOut() {
      setStatusNotice(null);
      setSyncing(true);
      try {
        const message = await signOutFromCloud();
        setEmail(null);
        return message;
      } finally { setSyncing(false); }
    },
    async upload() {
      setSyncing(true);
      try { return await uploadLocalData(); } finally { setSyncing(false); }
    },
    async download() {
      setSyncing(true);
      try { return (await downloadCloudData()).message; } finally { setSyncing(false); }
    },
  }), [configured, email, loading, statusNotice, syncing]);

  return <CloudSyncContext.Provider value={value}>{children}</CloudSyncContext.Provider>;
}

export function useCloudSync() {
  const context = useContext(CloudSyncContext);
  if (!context) throw new Error("useCloudSync must be used within CloudSyncProvider");
  return context;
}
