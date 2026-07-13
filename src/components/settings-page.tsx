"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { DatabaseBackup, Download, RotateCcw, Trash2, Upload } from "lucide-react";
import { PageHeader } from "./ui";
import { clearCareerBaseData, createBackup, parseBackup, restoreBackup } from "@/lib/backup";

type Notice = { tone: "success" | "error"; text: string } | null;

export function SettingsPage() {
  const [notice, setNotice] = useState<Notice>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function exportData() {
    const json = JSON.stringify(createBackup(), null, 2);
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = `career-base-backup-${new Date().toISOString().slice(0, 10)}.json`; anchor.click();
    URL.revokeObjectURL(url);
    setNotice({ tone: "success", text: "バックアップファイルを書き出しました。大切な場所に保管してください。" });
  }

  async function importData(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setNotice({ tone: "error", text: "ファイルが大きすぎます。5MB以下のJSONファイルを選択してください。" }); event.target.value = ""; return; }
    const backup = parseBackup(await file.text());
    if (!backup) { setNotice({ tone: "error", text: "Career Baseのバックアップファイルとして読み込めませんでした。" }); event.target.value = ""; return; }
    if (!window.confirm("現在のデータをバックアップ内容で置き換えますか？")) { event.target.value = ""; return; }
    setNotice(restoreBackup(backup) ? { tone: "success", text: "データを復元しました。各画面を開くと内容を確認できます。" } : { tone: "error", text: "データを保存できませんでした。ブラウザの設定や空き容量を確認してください。" });
    event.target.value = "";
  }

  function clearData() {
    if (!window.confirm("予定・ToDo・企業・メモをすべて削除しますか？この操作は取り消せません。")) return;
    setNotice(clearCareerBaseData() ? { tone: "success", text: "すべての登録データを削除しました。" } : { tone: "error", text: "データを削除できませんでした。ブラウザの設定を確認してください。" });
  }

  return <>
    <PageHeader title="設定" description="大切なデータのバックアップと復元" showSettings={false} />
    {notice && <div className={`notice notice-${notice.tone}`} role="status">{notice.text}</div>}
    <div className="settings-grid">
      <section className="card settings-card"><div className="settings-icon"><DatabaseBackup /></div><div><h2>バックアップ</h2><p>このブラウザに保存されている予定・ToDo・企業・メモを、ひとつのJSONファイルにまとめます。</p></div><button className="primary-button" onClick={exportData}><Download size={18} />書き出す</button></section>
      <section className="card settings-card"><div className="settings-icon"><RotateCcw /></div><div><h2>データを復元</h2><p>Career Baseから書き出したJSONファイルを読み込み、現在のデータと置き換えます。</p></div><input ref={fileInputRef} className="sr-only" id="backup-file" type="file" accept="application/json,.json" onChange={importData} /><button className="secondary-button" onClick={() => fileInputRef.current?.click()}><Upload size={18} />ファイルを選択</button></section>
      <section className="card settings-card danger-zone"><div className="settings-icon"><Trash2 /></div><div><h2>すべてのデータを削除</h2><p>このブラウザに保存された登録データをすべて消去します。先にバックアップすることをおすすめします。</p></div><button className="danger-button" onClick={clearData}><Trash2 size={18} />すべて削除</button></section>
    </div>
    <p className="settings-note">バックアップには個人情報が含まれる場合があります。第三者へ共有せず、安全な場所に保管してください。</p>
  </>;
}
