"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Hash, NotebookPen, PanelLeftClose, PanelLeftOpen, Search, Trash2 } from "lucide-react";
import { EmptyState, PageHeader, confirmDelete } from "./ui";
import { MemoEditor } from "./memo-editor";
import { SortableList } from "./sortable-list";
import { useCloudSync } from "./cloud-sync-provider";
import { useLocalStorageCollection } from "@/hooks/use-local-storage-collection";
import { STORAGE_KEYS } from "@/lib/storage";
import { STORAGE_RESTORED_EVENT } from "@/lib/cloud-sync";
import { memoCategories, type Memo } from "@/types";

export function MemosPage() {
  const cloud = useCloudSync();
  const { items, hydrated, add, remove, replace, reorder } = useLocalStorageCollection<Memo>(STORAGE_KEYS.memos);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("すべて");
  const [draft, setDraft] = useState<Memo | null>(null);
  const [focused, setFocused] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [operationError, setOperationError] = useState("");
  const pendingDraft = useRef<Memo | null>(null);
  const persistedIds = useRef(new Set<string>());
  const workspace = useRef<HTMLDivElement>(null);
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return items.filter((memo) => (category === "すべて" || memo.category === category)
      && [memo.title, memo.content, ...memo.tags].some((value) => value.toLocaleLowerCase().includes(normalized)));
  }, [items, query, category]);

  useEffect(() => {
    function restored() {
      pendingDraft.current = null; persistedIds.current.clear();
      setDraft(null); setSaveFailed(false); setOperationError(""); setFocused(false);
    }
    window.addEventListener(STORAGE_RESTORED_EVENT, restored);
    return () => window.removeEventListener(STORAGE_RESTORED_EVENT, restored);
  }, []);

  useEffect(() => {
    if (!saveFailed) return;
    function beforeUnload(event: BeforeUnloadEvent) { event.preventDefault(); }
    function preventNavigation(event: MouseEvent) {
      if (event.target instanceof Element && event.target.closest("a[href]") && !window.confirm("保存できていない変更があります。この画面を離れますか？")) {
        event.preventDefault(); event.stopPropagation();
      }
    }
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", preventNavigation, true);
    return () => { window.removeEventListener("beforeunload", beforeUnload); document.removeEventListener("click", preventNavigation, true); };
  }, [saveFailed]);

  function persist(value: Memo) {
    const savedValue = { ...value, title: value.title.trim() || "無題のメモ", updatedAt: new Date().toISOString() };
    const exists = items.some((item) => item.id === value.id) || persistedIds.current.has(value.id);
    const saved = exists ? replace(savedValue) : add(savedValue);
    if (saved) persistedIds.current.add(value.id);
    pendingDraft.current = saved ? null : value;
    setSaveFailed(!saved);
    return saved;
  }

  function canLeave() { return !pendingDraft.current || persist(pendingDraft.current); }

  function openMemo(memo: Memo) {
    if (cloud.loading || !canLeave()) return;
    setDraft(memo); setOperationError("");
    if (window.matchMedia("(max-width: 759px)").matches) workspace.current?.scrollIntoView({ block: "start" });
  }

  function createMemo() {
    if (!hydrated || cloud.loading || !canLeave()) return;
    const stamp = new Date().toISOString();
    const memo: Memo = { id: crypto.randomUUID(), title: "", content: "", tags: [], category: category === "すべて" ? memoCategories[0] : category as Memo["category"], createdAt: stamp, updatedAt: stamp };
    setQuery(""); setDraft(memo); setOperationError(""); persist(memo);
  }

  function changeMemo(patch: Partial<Pick<Memo, "title" | "content" | "richContent" | "category" | "tags">>) {
    if (!draft) return;
    const next = { ...draft, ...patch };
    setDraft(next); persist(next);
  }

  function backToList() {
    if (!canLeave()) return;
    setDraft(null); setFocused(false);
  }

  function deleteMemo() {
    if (!draft || !confirmDelete("このメモ")) return;
    if (items.some((item) => item.id === draft.id) && !remove(draft.id)) { setOperationError("削除できませんでした。端末の保存領域を確認して再度お試しください。"); return; }
    persistedIds.current.delete(draft.id); pendingDraft.current = null;
    setDraft(null); setSaveFailed(false); setFocused(false); setOperationError("");
  }

  return <div className="memos-page">
    <PageHeader title="メモ" onAdd={hydrated && !cloud.loading ? createMemo : undefined} />
    {cloud.loading && <p className="muted" role="status">保存済みのメモを確認しています…</p>}
    <div ref={workspace} className={`memo-workspace${draft ? " has-selection" : ""}${focused ? " is-focused" : ""}`}>
      <aside className="memo-sidebar" aria-label="メモ一覧">
        <div className="memo-filters">
          <label className="search-box"><Search size={18} /><span className="sr-only">メモを検索</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="タイトル・本文・タグを検索" /></label>
          <select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="カテゴリで絞り込み"><option>すべて</option>{memoCategories.map((value) => <option key={value}>{value}</option>)}</select>
        </div>
        <div className="memo-list-heading"><h2>メモ一覧</h2><span>{hydrated ? `${filtered.length}件` : "読込中…"}</span></div>
        <SortableList items={filtered} label="メモの並び順" className="memo-compact-list" getLabel={(memo) => memo.title || "無題のメモ"} onMove={reorder} disabled={cloud.loading || saveFailed}>{(memo) => <button type="button" className={`memo-list-item${draft?.id === memo.id ? " selected" : ""}`} onClick={() => openMemo(memo)} disabled={cloud.loading} aria-current={draft?.id === memo.id ? "true" : undefined}>
          <span className="memo-list-title">{memo.title || "無題のメモ"}</span>
          {memo.tags.length > 0 && <span className="memo-list-tags">{memo.tags.map((tag) => <span key={tag}><Hash size={11} />{tag}</span>)}</span>}
        </button>}</SortableList>
        {hydrated && !filtered.length && <EmptyState title={items.length ? "該当するメモはありません" : "メモを残しましょう"} description={items.length ? "検索条件を変更してください。" : "「＋ 追加」から書き始められます。"} />}
      </aside>
      <section className="memo-editor-pane" aria-label="メモ編集">
        {draft ? <>
          <div className="memo-editor-actions">
            <button type="button" className="secondary-button memo-back" onClick={backToList}><ArrowLeft size={16} />一覧に戻る</button>
            <button type="button" className="secondary-button memo-focus" onClick={() => setFocused(!focused)} aria-pressed={focused}>{focused ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}{focused ? "一覧を表示" : "一覧を閉じる"}</button>
            <div className="memo-editor-options"><button type="button" className="icon-button" onClick={deleteMemo} aria-label="このメモを削除"><Trash2 size={17} /></button></div>
          </div>
          <div className="memo-save-state" role="status">{saveFailed ? <span className="memo-save-error">この端末に保存できませんでした。<button type="button" onClick={() => persist(draft)}>再試行</button></span> : <span>この端末に自動保存済み</span>}</div>
          {operationError && <p className="error-message" role="alert">{operationError}</p>}
          <div className="memo-document-meta">
            <label className="sr-only" htmlFor="memo-title">タイトル</label><input key={draft.id} id="memo-title" autoFocus={!draft.title} className="memo-title-input" value={draft.title} onChange={(event) => changeMemo({ title: event.target.value })} placeholder="無題のメモ" />
            <div className="memo-metadata-fields"><label>カテゴリ<select value={draft.category} onChange={(event) => changeMemo({ category: event.target.value as Memo["category"] })}>{memoCategories.map((value) => <option key={value}>{value}</option>)}</select></label>
              <MemoTags key={draft.id} tags={draft.tags} onChange={(tags) => changeMemo({ tags })} /></div>
          </div>
          <MemoEditor key={draft.id} memo={draft} onChange={(content, richContent) => changeMemo({ content, richContent })} />
        </> : <div className="memo-editor-empty"><NotebookPen size={36} /><h2>メモを選んで、書き始める</h2><p>左の一覧から選ぶか、新しいメモを追加してください。</p><button type="button" className="primary-button" onClick={createMemo} disabled={!hydrated || cloud.loading}>＋ メモを追加</button></div>}
      </section>
    </div>
  </div>;
}

function MemoTags({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void }) {
  const [value, setValue] = useState(tags.join(", "));
  return <label className="memo-tags-field">タグ<input value={value} onChange={(event) => {
    setValue(event.target.value);
    onChange([...new Set(event.target.value.split(/[,、]/).map((tag) => tag.trim()).filter(Boolean))]);
  }} placeholder="面接, ガクチカ（カンマ区切り）" /></label>;
}
