import type { CareerBaseBackup } from "@/lib/backup";
import { createBackup, parseBackup, restoreBackup } from "@/lib/backup";

const SESSION_KEY = "career-base-cloud-session";
const DIRTY_KEY = "career-base-cloud-dirty";
export const STORAGE_RESTORED_EVENT = "career-base-storage-restored";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

interface CloudSession {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  user: { id: string; email?: string };
}

interface CloudRecord {
  user_id: string;
  events: CareerBaseBackup["data"]["events"];
  todos: CareerBaseBackup["data"]["todos"];
  companies: CareerBaseBackup["data"]["companies"];
  memos: CareerBaseBackup["data"]["memos"];
  updated_at: string;
}

interface AuthResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  user?: { id?: string; email?: string };
  error_description?: string;
  msg?: string;
}

let uploadTimer: ReturnType<typeof setTimeout> | undefined;

export function isCloudConfigured() {
  return Boolean(supabaseUrl && supabaseKey);
}

function headers(accessToken?: string): HeadersInit {
  return {
    apikey: supabaseKey ?? "",
    Authorization: `Bearer ${accessToken ?? supabaseKey ?? ""}`,
    "Content-Type": "application/json",
  };
}

function readSession(): CloudSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null) return null;
    const session = value as Partial<CloudSession>;
    if (!session.access_token || !session.refresh_token || !session.expires_at || !session.user?.id) return null;
    return session as CloudSession;
  } catch {
    return null;
  }
}

function saveSession(session: CloudSession) {
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function toSession(data: AuthResponse): CloudSession | null {
  if (!data.access_token || !data.refresh_token || !data.user?.id) return null;
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Math.floor(Date.now() / 1000) + (data.expires_in ?? 3600),
    user: { id: data.user.id, email: data.user.email },
  };
}

async function refreshSession(session: CloudSession): Promise<CloudSession | null> {
  if (!supabaseUrl || !supabaseKey) return null;
  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ refresh_token: session.refresh_token }),
    });
    if (!response.ok) return null;
    const next = toSession(await response.json() as AuthResponse);
    if (next) saveSession(next);
    return next;
  } catch {
    return null;
  }
}

export async function getCloudSession(): Promise<CloudSession | null> {
  const session = readSession();
  if (!session) return null;
  if (session.expires_at > Math.floor(Date.now() / 1000) + 60) return session;
  return refreshSession(session);
}

export async function signInToCloud(email: string, password: string): Promise<CloudSession> {
  if (!supabaseUrl || !supabaseKey) throw new Error("Supabaseの接続情報が設定されていません。");
  let response: Response;
  try {
    response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ email, password }),
    });
  } catch {
    throw new Error("Supabaseに接続できませんでした。通信環境を確認してください。");
  }
  const data = await response.json() as AuthResponse;
  const session = toSession(data);
  if (!response.ok || !session) throw new Error(data.error_description ?? data.msg ?? "メールアドレスまたはパスワードが正しくありません。");
  saveSession(session);
  return session;
}

export async function signOutFromCloud(): Promise<string> {
  if (typeof window === "undefined") return "ログアウトしました。";
  const session = await getCloudSession();
  if (session && window.localStorage.getItem(DIRTY_KEY) === "true") await uploadLocalData();
  if (session && supabaseUrl) {
    try {
      await fetch(`${supabaseUrl}/auth/v1/logout?scope=local`, {
        method: "POST",
        headers: headers(session.access_token),
      });
    } catch {
      // サーバーへの通知に失敗しても、この端末のセッションは終了します。
    }
  }
  if (uploadTimer) clearTimeout(uploadTimer);
  uploadTimer = undefined;
  window.localStorage.removeItem(SESSION_KEY);
  window.localStorage.removeItem(DIRTY_KEY);
  return "ログアウトしました。端末内のデータは残っています。";
}

async function readCloudRecord(session: CloudSession): Promise<CloudRecord | null> {
  if (!supabaseUrl) return null;
  const query = new URLSearchParams({ select: "user_id,events,todos,companies,memos,updated_at", user_id: `eq.${session.user.id}` });
  const response = await fetch(`${supabaseUrl}/rest/v1/career_base_data?${query}`, { headers: headers(session.access_token), cache: "no-store" });
  if (!response.ok) throw new Error("クラウドデータを読み込めませんでした。SupabaseのSQL設定を確認してください。");
  const rows = await response.json() as CloudRecord[];
  return rows[0] ?? null;
}

export async function uploadLocalData(): Promise<string> {
  const session = await getCloudSession();
  if (!session || !supabaseUrl) throw new Error("先にログインしてください。");
  const backup = createBackup();
  const response = await fetch(`${supabaseUrl}/rest/v1/career_base_data?on_conflict=user_id`, {
    method: "POST",
    headers: { ...headers(session.access_token), Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify({ user_id: session.user.id, ...backup.data, updated_at: new Date().toISOString() }),
  });
  if (!response.ok) throw new Error("クラウドへ保存できませんでした。SupabaseのSQL設定を確認してください。");
  window.localStorage.removeItem(DIRTY_KEY);
  return "この端末のデータをクラウドへ保存しました。";
}

export async function downloadCloudData(): Promise<{ found: boolean; message: string }> {
  const session = await getCloudSession();
  if (!session) throw new Error("先にログインしてください。");
  const record = await readCloudRecord(session);
  if (!record) return { found: false, message: "クラウドに保存済みのデータはありません。" };
  const backup = parseBackup(JSON.stringify({
    app: "career-base",
    version: 1,
    exportedAt: record.updated_at,
    data: { events: record.events, todos: record.todos, companies: record.companies, memos: record.memos },
  }));
  if (!backup || !restoreBackup(backup)) throw new Error("クラウドデータをこの端末へ保存できませんでした。");
  window.localStorage.removeItem(DIRTY_KEY);
  window.dispatchEvent(new Event(STORAGE_RESTORED_EVENT));
  return { found: true, message: "クラウドのデータをこの端末へ反映しました。" };
}

export async function initializeCloudData(): Promise<string> {
  const session = await getCloudSession();
  if (!session) return "";
  if (window.localStorage.getItem(DIRTY_KEY) === "true") return uploadLocalData();
  const result = await downloadCloudData();
  if (result.found) return result.message;
  return uploadLocalData();
}

export function scheduleCloudUpload() {
  if (typeof window === "undefined" || !isCloudConfigured() || !readSession()) return;
  window.localStorage.setItem(DIRTY_KEY, "true");
  if (uploadTimer) clearTimeout(uploadTimer);
  uploadTimer = setTimeout(() => { void uploadLocalData().catch(() => undefined); }, 800);
}

export function notifyStorageRestored() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(STORAGE_RESTORED_EVENT));
}
