"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Hash, Pencil, Search, Trash2 } from "lucide-react";
import { EmptyState, FormField, Modal, PageHeader, StatusBadge, confirmDelete } from "./ui";
import { useLocalStorageCollection } from "@/hooks/use-local-storage-collection";
import { STORAGE_KEYS } from "@/lib/storage";
import { memoCategories, type Memo } from "@/types";

export function MemosPage() {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Memo | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("すべて");
  const [selected, setSelected] = useState<Memo | null>(null);
  const { items, add, remove, replace } = useLocalStorageCollection<Memo>(STORAGE_KEYS.memos);
  const filtered = useMemo(() => { const normalized = query.toLowerCase(); return items.filter((memo) => (memo.title.toLowerCase().includes(normalized) || memo.content.toLowerCase().includes(normalized) || memo.tags.some((tag) => tag.toLowerCase().includes(normalized))) && (category === "すべて" || memo.category === category)); }, [items, query, category]);

  function openAddForm() { setEditing(null); setError(""); setFormOpen(true); }
  function openEditForm(memo: Memo) { setSelected(null); setEditing(memo); setError(""); setFormOpen(true); }
  function closeForm() { setFormOpen(false); setEditing(null); setError(""); }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget); const title = String(form.get("title") ?? "").trim(); const content = String(form.get("content") ?? "").trim();
    if (!title || !content) return setError("タイトルと本文を入力してください。");
    const stamp = new Date().toISOString();
    const value: Memo = {
      id: editing?.id ?? crypto.randomUUID(), title, content, category: String(form.get("category")) as Memo["category"],
      tags: String(form.get("tags")).split(",").map((tag) => tag.trim()).filter(Boolean), companyId: editing?.companyId,
      createdAt: editing?.createdAt ?? stamp, updatedAt: stamp,
    };
    if (editing) replace(value); else add(value); closeForm();
  }
  function deleteMemo(memo: Memo) { if (confirmDelete("このメモ")) { remove(memo.id); if (selected?.id === memo.id) setSelected(null); } }

  return <>
    <PageHeader title="メモ" description="気づきや選考準備を、あとから探せる形で残す" onAdd={openAddForm} />
    <div className="toolbar"><label className="search-box"><Search size={18} /><span className="sr-only">メモを検索</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="タイトル・本文・タグを検索" /></label><select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="カテゴリで絞り込み"><option>すべて</option>{memoCategories.map((value) => <option key={value}>{value}</option>)}</select></div>
    <div className="section-heading"><h2>メモ一覧</h2><span>{filtered.length}件</span></div>
    <div className="memo-grid">{filtered.length ? filtered.map((memo) => <article className="card memo-card clickable" key={memo.id} role="button" tabIndex={0} onClick={() => setSelected(memo)} onKeyDown={(event) => (event.key === "Enter" || event.key === " ") && setSelected(memo)}>
      <div className="memo-card-top"><StatusBadge tone="green">{memo.category}</StatusBadge><div className="card-actions"><button className="icon-button" onClick={(event) => { event.stopPropagation(); openEditForm(memo); }} aria-label={`${memo.title}を編集`}><Pencil size={17} /></button><button className="icon-button" onClick={(event) => { event.stopPropagation(); deleteMemo(memo); }} aria-label={`${memo.title}を削除`}><Trash2 size={17} /></button></div></div>
      <h2>{memo.title}</h2><p>{memo.content}</p><div className="tag-row">{memo.tags.map((tag) => <span key={tag}><Hash size={12} />{tag}</span>)}</div>
    </article>) : <EmptyState title="該当するメモはありません" description="検索条件を変更するか、新しいメモを追加してください。" />}</div>

    {formOpen && <Modal title={editing ? "メモを編集" : "メモを追加"} onClose={closeForm}><form className="form-grid" onSubmit={submit} key={editing?.id ?? "new"}>
      {error && <p className="error-message">{error}</p>}
      <FormField label="タイトル *" htmlFor="memo-title"><input id="memo-title" name="title" defaultValue={editing?.title} autoFocus /></FormField>
      <FormField label="カテゴリ" htmlFor="memo-category"><select id="memo-category" name="category" defaultValue={editing?.category ?? memoCategories[0]}>{memoCategories.map((value) => <option key={value}>{value}</option>)}</select></FormField>
      <div className="form-field full"><FormField label="本文 *" htmlFor="memo-content"><textarea id="memo-content" name="content" defaultValue={editing?.content} /></FormField></div>
      <div className="form-field full"><FormField label="タグ" htmlFor="memo-tags" hint="複数の場合はカンマで区切ってください"><input id="memo-tags" name="tags" defaultValue={editing?.tags.join(", ")} placeholder="例: 面接, ガクチカ" /></FormField></div>
      <div className="form-actions"><button type="button" className="secondary-button" onClick={closeForm}>キャンセル</button><button className="primary-button">{editing ? "変更を保存" : "登録する"}</button></div>
    </form></Modal>}

    {selected && <Modal title={selected.title} onClose={() => setSelected(null)}><div className="memo-detail"><div className="detail-header"><StatusBadge tone="green">{selected.category}</StatusBadge><button className="secondary-button" onClick={() => openEditForm(selected)}><Pencil size={16} />編集する</button></div><p>{selected.content}</p><div className="tag-row">{selected.tags.map((tag) => <span key={tag}><Hash size={12} />{tag}</span>)}</div></div></Modal>}
  </>;
}
