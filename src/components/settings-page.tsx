"use client";

import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Cloud, DatabaseBackup, Download, LogIn, LogOut, RotateCcw, Trash2, Upload, UserPlus } from "lucide-react";
import { PageHeader } from "./ui";
import { useCloudSync } from "./cloud-sync-provider";
import { clearCareerBaseData, createBackup, parseBackup, restoreBackup } from "@/lib/backup";
import { notifyStorageRestored, scheduleCloudUpload } from "@/lib/cloud-sync";

type Notice = { tone: "success" | "error"; text: string } | null;

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "処理に失敗しました。もう一度お試しください。";
}

export function SettingsPage() {
  const [notice, setNotice] = useState<Notice>(null);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cloud = useCloudSync();

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const passwordConfirmation = String(form.get("passwordConfirmation") ?? "");
    if (!email || !password) return setNotice({ tone: "error", text: "メールアドレスとパスワードを入力してください。" });
    if (authMode === "signup" && password.length < 8) return setNotice({ tone: "error", text: "パスワードは8文字以上で入力してください。" });
    if (authMode === "signup" && password !== passwordConfirmation) return setNotice({ tone: "error", text: "確認用パスワードが一致しません。" });
    try {
      const message = authMode === "login" ? await cloud.signIn(email, password) : await cloud.signUp(email, password);
      setNotice({ tone: "success", text: message || (authMode === "login" ? "ログインしました。" : "アカウントを作成しました。") });
      if (authMode === "signup") setAuthMode("login");
      formElement.reset();
    } catch (error) {
      setNotice({ tone: "error", text: errorMessage(error) });
    }
  }

  async function runCloudAction(action: () => Promise<string>, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    try { setNotice({ tone: "success", text: await action() }); }
    catch (error) { setNotice({ tone: "error", text: errorMessage(error) }); }
  }

  function exportData() {
    const json = JSON.stringify(createBackup(), null, 2);
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `career-base-backup-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setNotice({ tone: "success", text: "バックアップファイルを書き出しました。大切な場所に保管してください。" });
  }

  async function importData(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setNotice({ tone: "error", text: "ファイルが大きすぎます。5MB以下のJSONファイルを選択してください。" });
      event.target.value = "";
      return;
    }
    const backup = parseBackup(await file.text());
    if (!backup) {
      setNotice({ tone: "error", text: "Career Baseのバックアップファイルとして読み込めませんでした。" });
      event.target.value = "";
      return;
    }
    if (!window.confirm("現在のデータをバックアップ内容で置き換えますか？")) {
      event.target.value = "";
      return;
    }
    if (restoreBackup(backup)) {
      notifyStorageRestored();
      scheduleCloudUpload();
      setNotice({ tone: "success", text: "データを復元しました。各画面を開くと内容を確認できます。" });
    } else {
      setNotice({ tone: "error", text: "データを保存できませんでした。ブラウザの設定や空き容量を確認してください。" });
    }
    event.target.value = "";
  }

  function clearData() {
    if (!window.confirm("予定・ToDo・企業・メモをすべて削除しますか？この操作は取り消せません。")) return;
    if (clearCareerBaseData()) {
      notifyStorageRestored();
      scheduleCloudUpload();
      setNotice({ tone: "success", text: "すべての登録データを削除しました。" });
    } else {
      setNotice({ tone: "error", text: "データを削除できませんでした。ブラウザの設定を確認してください。" });
    }
  }

  return <>
    <PageHeader title="設定" description="クラウド同期とバックアップ" showSettings={false} />
    {(notice ?? cloud.statusNotice) && <div className={`notice notice-${(notice ?? cloud.statusNotice)?.tone}`} role="status">{(notice ?? cloud.statusNotice)?.text}</div>}
    <div className="settings-grid">
      <section className="card cloud-card">
        <div className="settings-icon"><Cloud /></div>
        <div className="cloud-card-body">
          <h2>クラウド同期</h2>
          {!cloud.configured ? <p>Supabaseの接続情報を設定すると、スマートフォンとパソコンで同じデータを使えます。</p>
            : cloud.loading ? <p>ログイン状態を確認しています…</p>
              : cloud.email ? <>
                <p><strong>{cloud.email}</strong> でログイン中です。変更内容は自動でクラウドへ保存されます。</p>
                <div className="cloud-actions">
                  <button className="secondary-button" disabled={cloud.syncing} onClick={() => void runCloudAction(cloud.upload)}>この端末から保存</button>
                  <button className="secondary-button" disabled={cloud.syncing} onClick={() => void runCloudAction(cloud.download, "この端末のデータをクラウドの内容で置き換えますか？")}>クラウドから読込</button>
                  <button className="secondary-button" disabled={cloud.syncing} onClick={() => void runCloudAction(cloud.signOut)}><LogOut size={18} />ログアウト</button>
                </div>
              </> : <>
              <div className="auth-mode-tabs" role="group" aria-label="アカウント操作">
                <button type="button" className={authMode === "login" ? "active" : ""} aria-pressed={authMode === "login"} onClick={() => { setAuthMode("login"); setNotice(null); }}>ログイン</button>
                <button type="button" className={authMode === "signup" ? "active" : ""} aria-pressed={authMode === "signup"} onClick={() => { setAuthMode("signup"); setNotice(null); }}>新規登録</button>
              </div>
              <form className="cloud-login-form" onSubmit={submitAuth}>
                <p>{authMode === "login" ? "登録済みのアカウントでログインしてください。" : "メールアドレスとパスワードでアカウントを作成します。"}</p>
                <label htmlFor="cloud-email">メールアドレス</label>
                <input id="cloud-email" name="email" type="email" autoComplete="email" required />
                <label htmlFor="cloud-password">パスワード</label>
                <input id="cloud-password" name="password" type="password" minLength={authMode === "signup" ? 8 : undefined} autoComplete={authMode === "signup" ? "new-password" : "current-password"} required />
                {authMode === "signup" && <>
                  <label htmlFor="cloud-password-confirmation">パスワード（確認）</label>
                  <input id="cloud-password-confirmation" name="passwordConfirmation" type="password" minLength={8} autoComplete="new-password" required />
                  <small className="auth-help">8文字以上で設定してください。登録後に確認メールが届く場合があります。</small>
                </>}
                <button className="primary-button" disabled={cloud.syncing}>{authMode === "login" ? <LogIn size={18} /> : <UserPlus size={18} />}{cloud.syncing ? "処理中…" : authMode === "login" ? "ログイン" : "アカウントを作成"}</button>
              </form></>}
        </div>
      </section>
      <section className="card settings-card"><div className="settings-icon"><DatabaseBackup /></div><div><h2>バックアップ</h2><p>このブラウザに保存されている予定・ToDo・企業・メモを、ひとつのJSONファイルにまとめます。</p></div><button className="primary-button" onClick={exportData}><Download size={18} />書き出す</button></section>
      <section className="card settings-card"><div className="settings-icon"><RotateCcw /></div><div><h2>データを復元</h2><p>Career Baseから書き出したJSONファイルを読み込み、現在のデータと置き換えます。</p></div><input ref={fileInputRef} className="sr-only" id="backup-file" type="file" accept="application/json,.json" onChange={importData} /><button className="secondary-button" onClick={() => fileInputRef.current?.click()}><Upload size={18} />ファイルを選択</button></section>
      <section className="card settings-card danger-zone"><div className="settings-icon"><Trash2 /></div><div><h2>すべてのデータを削除</h2><p>このブラウザに保存された登録データをすべて消去します。ログイン中はクラウドにも反映されます。</p></div><button className="danger-button" onClick={clearData}><Trash2 size={18} />すべて削除</button></section>
    </div>
    <p className="settings-note">JSONバックアップには個人情報が含まれる場合があります。第三者へ共有せず、安全な場所に保管してください。</p>
  </>;
}
