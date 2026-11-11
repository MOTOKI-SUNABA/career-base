"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, Hash, ListFilter, NotebookPen, ChevronLeft, ChevronRight, Plus, Search, Trash2, X } from "lucide-react";
import { EmptyState, FormField, Modal, PageHeader, confirmDelete } from "./ui";
import { MemoEditor } from "./memo-editor";
import { useCloudSync } from "./cloud-sync-provider";
import { useLocalStorageCollection } from "@/hooks/use-local-storage-collection";
import { STORAGE_KEYS } from "@/lib/storage";
import { STORAGE_RESTORED_EVENT } from "@/lib/cloud-sync";
import { memoCategories, type Memo } from "@/types";

function memoUpdatedDate(value: string, withTime = false) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "不明" : new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "numeric", day: "numeric", ...(withTime ? { hour: "2-digit", minute: "2-digit" } as const : {}) }).format(date);
}

function MemoListHeading({ memo, selected }: { memo: Memo; selected: boolean }) {
  const viewport = useRef<HTMLSpanElement>(null);
  const text = useRef<HTMLSpanElement>(null);
  const [overflow, setOverflow] = useState(0);
  const title = memo.title || "無題のメモ";

  useEffect(() => {
    const measure = () => setOverflow(Math.max(0, (text.current?.scrollWidth ?? 0) - (viewport.current?.clientWidth ?? 0)));
    const observer = new ResizeObserver(measure);
    if (viewport.current) observer.observe(viewport.current);
    if (text.current) observer.observe(text.current);
    measure();
    return () => observer.disconnect();
  }, [title]);

  return <span className="memo-list-heading-row">
    <span ref={viewport} className={`memo-title-viewport${selected && overflow > 0 ? " is-scrolling" : ""}`} title={title}>
      <span ref={text} className="memo-list-title" style={{ "--title-shift": `-${overflow}px`, animationDuration: `${Math.max(6, overflow / 25 + 3)}s` } as React.CSSProperties}>{title}</span>
    </span>
    <time className="memo-created-date" dateTime={memo.updatedAt} title={`更新日時：${memoUpdatedDate(memo.updatedAt, true)}`}>{memoUpdatedDate(memo.updatedAt)}</time>
  </span>;
}

export function MemosPage() {
  const cloud = useCloudSync();
  const { items, hydrated, add, remove, replace, update } = useLocalStorageCollection<Memo>(STORAGE_KEYS.memos);
  const [query, setQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState("");
  const [sortOrder, setSortOrder] = useState("newest");
  const availableTags = useMemo(() => [...new Set(items.flatMap((memo) => memo.tags))].sort((a, b) => a.localeCompare(b, "ja")), [items]);
  const [draft, setDraft] = useState<Memo | null>(null);
  const draftRef = useRef<Memo | null>(null);
  const [focused, setFocused] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [operationError, setOperationError] = useState("");
  const [selecting, setSelecting] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [bulkDialog, setBulkDialog] = useState<{ kind: "move" | "delete"; ids: string[] } | null>(null);
  const [bulkError, setBulkError] = useState("");
  const [notice, setNotice] = useState("");
  const pendingDraft = useRef<Memo | null>(null);
  const persistedIds = useRef(new Set<string>());
  const workspace = useRef<HTMLDivElement>(null);
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    const result = items.filter((memo) => (!selectedTag || memo.tags.includes(selectedTag))
      && [memo.title, memo.content, ...memo.tags].some((value) => value.toLocaleLowerCase().includes(normalized)));
    result.sort((a, b) => {
      const difference = (Date.parse(a.updatedAt) || 0) - (Date.parse(b.updatedAt) || 0);
      return sortOrder === "newest" ? -difference : difference;
    });
    return result;
  }, [items, query, selectedTag, sortOrder]);
  const updatedAt = (draft && items.find((memo) => memo.id === draft.id)?.updatedAt) || draft?.updatedAt;
  const selectedVisible = filtered.filter((memo) => checked.has(memo.id));
  const batch = bulkDialog ? items.filter((memo) => bulkDialog.ids.includes(memo.id)) : [];
  const ready = hydrated && !cloud.loading;

  useEffect(() => {
    function restored() {
      pendingDraft.current = null; persistedIds.current.clear(); draftRef.current = null;
      setDraft(null); setSaveFailed(false); setOperationError(""); setFocused(false);
      setSelecting(false); setChecked(new Set()); setBulkDialog(null); setBulkError(""); setNotice("");
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
    draftRef.current = memo; setDraft(memo); setOperationError("");
    if (window.matchMedia("(max-width: 759px)").matches) workspace.current?.scrollIntoView({ block: "start" });
  }

  function createMemo() {
    if (!hydrated || cloud.loading || !canLeave()) return;
    const stamp = new Date().toISOString();
    const memo: Memo = { id: crypto.randomUUID(), title: "", content: "", tags: selectedTag ? [selectedTag] : [], category: memoCategories[0], createdAt: stamp, updatedAt: stamp };
    setSelecting(false); setChecked(new Set()); setBulkDialog(null); setBulkError(""); setNotice("");
    setQuery(""); draftRef.current = memo; setDraft(memo); setOperationError(""); persist(memo);
  }

  function changeMemo(id: string, patch: Partial<Pick<Memo, "title" | "content" | "richContent" | "category" | "tags">>) {
    // Late editor events must never switch a newly created note back to the old one.
    const current = draftRef.current;
    if (!current || current.id !== id) return;
    const next = { ...current, ...patch };
    draftRef.current = next; setDraft(next); persist(next);
  }

  function backToList() {
    if (!canLeave()) return;
    draftRef.current = null; setDraft(null); setFocused(false);
  }

  function deleteMemo() {
    if (!draft || !confirmDelete("このメモ")) return;
    if (items.some((item) => item.id === draft.id) && !remove(draft.id)) { setOperationError("削除できませんでした。端末の保存領域を確認して再度お試しください。"); return; }
    persistedIds.current.delete(draft.id); pendingDraft.current = null;
    draftRef.current = null; setDraft(null); setSaveFailed(false); setFocused(false); setOperationError("");
    setSelecting(false); setChecked(new Set()); setNotice("");
  }

  function openBulk(kind: "move" | "delete") {
    if (!ready || !selectedVisible.length || !canLeave()) return;
    setBulkError(""); setBulkDialog({ kind, ids: selectedVisible.map((memo) => memo.id) });
  }

  function applyBulk(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!bulkDialog || !batch.length || !canLeave()) return;
    const destination = String(new FormData(event.currentTarget).get("category") ?? "");
    if (bulkDialog.kind === "move" && !memoCategories.some((value) => value === destination)) {
      setBulkError("移動先のカテゴリを選んでください。"); return;
    }
    const ids = new Set(batch.map((memo) => memo.id));
    const stamp = new Date().toISOString();
    const saved = update((current) => bulkDialog.kind === "delete" ? current.filter((memo) => !ids.has(memo.id)) : current.map((memo) => ids.has(memo.id) ? { ...memo, category: destination as Memo["category"], updatedAt: stamp } : memo));
    if (!saved) { setBulkError("保存できませんでした。端末の保存領域を確認して再度お試しください。"); return; }
    const current = draftRef.current;
    if (current && ids.has(current.id)) {
      if (bulkDialog.kind === "delete") {
        draftRef.current = null; setDraft(null); pendingDraft.current = null; setSaveFailed(false); setFocused(false);
      } else {
        const next = { ...current, category: destination as Memo["category"], updatedAt: stamp };
        draftRef.current = next; setDraft(next);
      }
    }
    if (bulkDialog.kind === "delete") ids.forEach((id) => persistedIds.current.delete(id));
    setNotice(bulkDialog.kind === "delete" ? `${batch.length}件のメモを削除しました。` : `${batch.length}件を「${destination}」に移動しました。`);
    setBulkDialog(null); setBulkError(""); setSelecting(false); setChecked(new Set()); setOperationError("");
  }

  function memoSummary(memo: Memo) {
    return <><MemoListHeading memo={memo} selected={draft?.id === memo.id && !selecting} /><span className="memo-list-tags">{memo.tags.map((tag) => <span key={tag}><Hash size={11} />{tag}</span>)}</span></>;
  }

  return <div className="memos-page">
    <PageHeader title="メモ" onAdd={hydrated && !cloud.loading ? createMemo : undefined} />
    {cloud.loading && <p className="muted" role="status">保存済みのメモを確認しています…</p>}
    <div ref={workspace} className={`memo-workspace${draft ? " has-selection" : ""}${focused ? " is-focused" : ""}${selecting ? " is-selecting" : ""}`}>
      <aside className="memo-sidebar" aria-label="メモ一覧">
        <div className="memo-filters">
          <label className="search-box"><Search size={18} /><span className="sr-only">メモを検索</span><input value={query} onChange={(event) => { setQuery(event.target.value); setChecked(new Set()); setNotice(""); }} placeholder="タイトル・本文・タグを検索" /></label>
          <select value={selectedTag} onChange={(event) => { setSelectedTag(event.target.value); setChecked(new Set()); setNotice(""); }} aria-label="タグで絞り込み"><option value="">すべてのタグ</option>{(selectedTag && !availableTags.includes(selectedTag) ? [selectedTag, ...availableTags] : availableTags).map((tag) => <option key={tag} value={tag}>#{tag}</option>)}</select>
        </div>
        <label className="memo-sort-control">並び順<select aria-label="メモの並び順" value={sortOrder} onChange={(event) => setSortOrder(event.target.value)}><option value="newest">新しい順</option><option value="oldest">古い順</option></select></label>
        <div className="memo-list-heading"><h2>メモ一覧</h2><span>{hydrated ? `${filtered.length}件` : "読込中…"}</span><button type="button" className="secondary-button memo-select-button" disabled={!ready || saveFailed} aria-pressed={selecting} onClick={() => { if (!canLeave()) return; setSelecting(!selecting); setChecked(new Set()); setNotice(""); }}><ListFilter size={15} />{selecting ? "完了" : "選択"}</button></div>
        {notice && <p className="memo-bulk-notice" role="status">{notice}</p>}
        {selecting && <div className="memo-bulk-toolbar"><span>{selectedVisible.length}件を選択中</span>
          <button type="button" className="secondary-button bulk-select-all" disabled={!filtered.length} onClick={() => setChecked(selectedVisible.length === filtered.length ? new Set() : new Set(filtered.map((memo) => memo.id)))}>{selectedVisible.length === filtered.length && filtered.length ? "選択をすべて解除" : "表示中をすべて選択"}</button>
          <div className="memo-bulk-actions"><button type="button" className="secondary-button" disabled={!selectedVisible.length || saveFailed} onClick={() => openBulk("move")}>カテゴリ移動</button><button type="button" className="danger-button" disabled={!selectedVisible.length || saveFailed} onClick={() => openBulk("delete")}>メモ削除</button></div>
        </div>}
        {selecting ? <ul className="memo-selection-list" aria-label="メモを選択">{filtered.map((memo) => <li key={memo.id}><label className={`memo-selection-row${checked.has(memo.id) ? " checked" : ""}`}><input type="checkbox" className="selection-circle" aria-label={`${memo.title || "無題のメモ"}を選択`} checked={checked.has(memo.id)} onChange={(event) => { const next = new Set(checked); if (event.target.checked) next.add(memo.id); else next.delete(memo.id); setChecked(next); }} /><span className="memo-list-item memo-selection-content">{memoSummary(memo)}</span></label></li>)}</ul> :
<ul className="memo-compact-list memo-date-sorted" aria-label="メモ一覧（更新日時順）">{filtered.map((memo) => <li key={memo.id}><button type="button" className={`memo-list-item${draft?.id === memo.id ? " selected" : ""}`} aria-label={[memo.title || "無題のメモ", ...memo.tags].join(" ")} onClick={() => openMemo(memo)} disabled={cloud.loading} aria-current={draft?.id === memo.id ? "true" : undefined}>{memoSummary(memo)}</button></li>)}</ul>}
        {hydrated && !filtered.length && <EmptyState title={items.length ? "該当するメモはありません" : "メモを残しましょう"} description={items.length ? "検索条件を変更してください。" : "「＋ 追加」から書き始められます。"} />}
      </aside>
      <section className="memo-editor-pane" aria-label="メモ編集">
        {draft ? <>
          <div className="memo-editor-actions">
            <button type="button" className="secondary-button memo-back" onClick={backToList}><ArrowLeft size={16} />一覧に戻る</button>
            <button type="button" className="secondary-button memo-focus" onClick={() => setFocused(!focused)} aria-pressed={focused}>{focused ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}{focused ? "一覧を表示" : "一覧を閉じる"}</button>
          <div className="memo-save-state" role="status">{saveFailed ? <span className="memo-save-error">この端末に保存できませんでした。<button type="button" onClick={() => persist(draft)}>再試行</button></span> : <span>自動保存済み</span>}</div>
            <div className="memo-editor-options"><button type="button" className="icon-button" onClick={deleteMemo} aria-label="このメモを削除"><Trash2 size={17} /></button></div>
          </div>
          {operationError && <p className="error-message" role="alert">{operationError}</p>}
          <div className="memo-document-meta">
            <div className="memo-date-tags">
              <p className="memo-created-date">更新日時：<time dateTime={updatedAt}>{memoUpdatedDate(updatedAt ?? draft.updatedAt, true)}</time></p>
              <div className="memo-edit-tags" aria-label="登録済みのタグ">{draft.tags.map((tag) => <span className="memo-edit-tag" key={tag}><Hash size={11} /><span>{tag}</span><button type="button" className="memo-tag-remove" aria-label={`タグ「${tag}」を削除`} onClick={() => changeMemo(draft.id, { tags: draft.tags.filter((value) => value !== tag) })}><X size={11} /></button></span>)}</div>
            </div>
            <label className="sr-only" htmlFor="memo-title">タイトル</label><input key={draft.id} id="memo-title" autoFocus={!draft.title} className="memo-title-input" value={draft.title} onChange={(event) => changeMemo(draft.id, { title: event.target.value })} placeholder="無題のメモ" />
            <div className="memo-metadata-fields">
              <MemoTags key={draft.id} tags={draft.tags} availableTags={availableTags} onChange={(tags) => changeMemo(draft.id, { tags })} /></div>
          </div>
          <MemoEditor key={draft.id} memo={draft} onChange={(content, richContent) => changeMemo(draft.id, { content, richContent })} />
        </> : <div className="memo-editor-empty"><NotebookPen size={36} /><h2>メモを選んで、書き始める</h2><p>左の一覧から選ぶか、新しいメモを追加してください。</p><button type="button" className="primary-button" onClick={createMemo} disabled={!hydrated || cloud.loading}>＋ メモを追加</button></div>}
      </section>
    </div>
    {bulkDialog && <Modal title={bulkDialog.kind === "move" ? "カテゴリ移動" : `${batch.length}件のメモを削除しますか？`} onClose={() => { setBulkDialog(null); setBulkError(""); }}><form className="company-form" onSubmit={applyBulk}>
      {bulkError && <p className="error-message" role="alert">{bulkError}</p>}
      <ul className="company-batch-names">{batch.map((memo) => <li key={memo.id}>{memo.title || "無題のメモ"}</li>)}</ul>
      {bulkDialog.kind === "move" ? <FormField label="移動先" htmlFor="memo-move-category"><select id="memo-move-category" name="category" defaultValue={memoCategories[0]}>{memoCategories.map((value) => <option key={value}>{value}</option>)}</select></FormField> : <p className="muted">選択したメモを削除します。この操作は取り消せません。</p>}
      <div className="company-form-actions"><button type="button" className="secondary-button" onClick={() => { setBulkDialog(null); setBulkError(""); }}>キャンセル</button><button disabled={!batch.length || saveFailed} className={bulkDialog.kind === "move" ? "primary-button" : "danger-button"}>{bulkDialog.kind === "move" ? "移動する" : "メモを削除する"}</button></div>
    </form></Modal>}
  </div>;
}

function MemoTags({ tags, availableTags, onChange }: { tags: string[]; availableTags: string[]; onChange: (tags: string[]) => void }) {
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(-1);
  const query = value.trim().replace(/^#+/, "").trim();
  const suggestions = availableTags.filter((tag) => !tags.includes(tag) && tag.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  const showSuggestions = focused && suggestions.length > 0;
  function addTag(candidate = value) {
    const tag = candidate.trim().replace(/^#+/, "").trim();
    if (!tag) return;
    if (!tags.includes(tag)) onChange([...tags, tag]);
    setValue("");
    setActive(-1);
  }
  return <div className="memo-tags-field"><label htmlFor="memo-tag-input">タグ</label><div className="memo-tag-entry"><div className="memo-tag-autocomplete"><input id="memo-tag-input" role="combobox" aria-autocomplete="list" aria-expanded={showSuggestions} aria-controls={showSuggestions ? "memo-tag-suggestions" : undefined} aria-activedescendant={showSuggestions && active >= 0 ? `memo-tag-option-${active}` : undefined} autoComplete="off" value={value} onFocus={() => setFocused(true)} onClick={() => setFocused(true)} onBlur={() => { setFocused(false); setActive(-1); }} onChange={(event) => { setValue(event.target.value); setActive(-1); }} onKeyDown={(event) => {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "Escape") { setFocused(false); setActive(-1); }
    if (showSuggestions && (event.key === "ArrowDown" || event.key === "ArrowUp")) { event.preventDefault(); setActive((current) => event.key === "ArrowDown" ? (current + 1) % suggestions.length : (current <= 0 ? suggestions.length : current) - 1); }
    if (event.key === "Enter") { event.preventDefault(); addTag(showSuggestions && active >= 0 ? suggestions[active] : value); }
  }} placeholder="タグを入力" />{showSuggestions && <ul id="memo-tag-suggestions" className="memo-tag-suggestions" role="listbox" aria-label="既存のタグ候補">{suggestions.map((tag, index) => <li id={`memo-tag-option-${index}`} key={tag} role="option" aria-selected={active === index} onMouseDown={(event) => event.preventDefault()} onClick={() => addTag(tag)}><Hash size={12} />{tag}</li>)}</ul>}</div><button type="button" className="secondary-button" aria-label="タグを追加" disabled={!query} onClick={() => addTag()}><Plus size={18} /></button></div></div>;
}
