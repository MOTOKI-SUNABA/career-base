import type { CareerBaseBackup } from "@/lib/backup";
import { clearCareerBaseData, createBackup, parseBackup, restoreBackup } from "@/lib/backup";

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
  id?: string;
  email?: string;
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  user?: { id?: string; email?: string };
  error_description?: string;
  msg?: string;
  error?: string;
}

export interface SignUpResult {
  signedIn: boolean;
  message: string;
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

function authError(data: AuthResponse, fallback: string) {
  const source = `${data.error_description ?? ""} ${data.msg ?? ""} ${data.error ?? ""}`.toLowerCase();
  if (source.includes("invalid login credentials")) return "メールアドレスまたはパスワードが正しくありません。";
  if (source.includes("email not confirmed")) return "確認メール内のリンクを開いてからログインしてください。";
  if (source.includes("user already registered")) return "このメールアドレスは既に登録されています。";
  if (source.includes("signup") && source.includes("disabled")) return "現在、新規登録は停止されています。Supabaseの認証設定を確認してください。";
  if (source.includes("password") && (source.includes("weak") || source.includes("characters"))) return "パスワードは8文字以上で設定してください。";
  if (source.includes("rate limit")) return "短時間に操作が集中しています。しばらく待ってから再度お試しください。";
  if (source.includes("email address not authorized")) return "この宛先へ確認メールを送信できません。Supabaseのメール送信設定を確認してください。";
  if (source.includes("invalid") && source.includes("email")) return "正しい形式のメールアドレスを入力してください。";
  return fallback;
}

async function readAuthResponse(response: Response): Promise<AuthResponse> {
  try { return await response.json() as AuthResponse; } catch { return {}; }
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
    const next = toSession(await readAuthResponse(response));
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
  const data = await readAuthResponse(response);
  const session = toSession(data);
  if (!response.ok || !session) throw new Error(authError(data, "メールアドレスまたはパスワードが正しくありません。"));
  saveSession(session);
  return session;
}

export async function signUpToCloud(email: string, password: string): Promise<SignUpResult> {
  if (!supabaseUrl || !supabaseKey) throw new Error("Supabaseの接続情報が設定されていません。");
  const redirectTo = `${window.location.origin}/settings`;
  let response: Response;
  try {
    response = await fetch(`${supabaseUrl}/auth/v1/signup?redirect_to=${encodeURIComponent(redirectTo)}`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ email, password }),
    });
  } catch {
    throw new Error("Supabaseに接続できませんでした。通信環境を確認してください。");
  }
  const data = await readAuthResponse(response);
  if (!response.ok) throw new Error(authError(data, "新規登録に失敗しました。"));
  const session = toSession(data);
  if (session) {
    saveSession(session);
    return { signedIn: true, message: "アカウントを作成してログインしました。" };
  }
  return { signedIn: false, message: "確認メールを送信しました。メール内のリンクを開いて登録を完了してください。" };
}

export async function consumeCloudSessionFromUrl(): Promise<CloudSession | null> {
  if (typeof window === "undefined" || !supabaseUrl) return null;
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const errorDescription = params.get("error_description");
  if (errorDescription) {
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    throw new Error(authError({ error_description: errorDescription.replace(/\+/g, " ") }, "メールアドレスを確認できませんでした。リンクの有効期限を確認してください。"));
  }
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  if (!accessToken || !refreshToken) return null;
  const response = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: headers(accessToken), cache: "no-store" });
  const user = await readAuthResponse(response);
  if (!response.ok || !user.id) return null;
  const expiresIn = Number(params.get("expires_in") ?? 3600);
  const session: CloudSession = {
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_at: Math.floor(Date.now() / 1000) + (Number.isFinite(expiresIn) ? expiresIn : 3600),
    user: { id: user.id, email: user.email },
  };
  saveSession(session);
  window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
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
  clearCareerBaseData();
  window.dispatchEvent(new Event(STORAGE_RESTORED_EVENT));
  return "ログアウトしました。この端末のキャッシュを消去しました。";
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
