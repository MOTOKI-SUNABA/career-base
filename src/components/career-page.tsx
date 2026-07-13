"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Building2, CalendarClock, MapPin, Pencil, Search, Trash2 } from "lucide-react";
import { EmptyState, FormField, Modal, PageHeader, StatusBadge, confirmDelete } from "./ui";
import { useLocalStorageCollection } from "@/hooks/use-local-storage-collection";
import { formatDate } from "@/lib/date";
import { seedCompanies } from "@/lib/seed";
import { STORAGE_KEYS } from "@/lib/storage";
import { industries, interestLevels, selectionStatuses, type Company } from "@/types";

export function CareerPage() {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Company | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("すべて");
  const [selected, setSelected] = useState<Company | null>(null);
  const { items, add, remove, replace } = useLocalStorageCollection(STORAGE_KEYS.companies, seedCompanies);
  const filtered = useMemo(() => items.filter((company) => company.name.toLowerCase().includes(query.toLowerCase()) && (status === "すべて" || company.selectionStatus === status)), [items, query, status]);
  const industryOptions = editing?.industry && !industries.some((industry) => industry === editing.industry) ? [editing.industry, ...industries] : industries;

  function openAddForm() { setEditing(null); setError(""); setFormOpen(true); }
  function openEditForm(company: Company) { setSelected(null); setEditing(company); setError(""); setFormOpen(true); }
  function closeForm() { setFormOpen(false); setEditing(null); setError(""); }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget); const name = String(form.get("name") ?? "").trim();
    if (!name) return setError("企業名を入力してください。");
    const stamp = new Date().toISOString();
    const value: Company = {
      id: editing?.id ?? crypto.randomUUID(), name, industry: String(form.get("industry")) || undefined,
      desiredRole: String(form.get("desiredRole")).trim() || undefined, interestLevel: String(form.get("interestLevel")) as Company["interestLevel"],
      selectionStatus: String(form.get("selectionStatus")) as Company["selectionStatus"], entryDeadline: String(form.get("entryDeadline")) || undefined,
      nextSelectionDate: String(form.get("nextSelectionDate")) || undefined, location: String(form.get("location")).trim() || undefined,
      startingSalary: editing?.startingSalary, portalUrl: editing?.portalUrl, companyResearch: String(form.get("companyResearch")).trim() || undefined,
      esNotes: editing?.esNotes, interviewNotes: editing?.interviewNotes, createdAt: editing?.createdAt ?? stamp, updatedAt: stamp,
    };
    if (editing) replace(value); else add(value); closeForm();
  }
  function deleteCompany(company: Company) { if (confirmDelete("この企業")) { remove(company.id); if (selected?.id === company.id) setSelected(null); } }

  return <>
    <PageHeader title="就活情報" description="企業ごとの選考状況と期限をまとめて管理" onAdd={openAddForm} />
    <div className="toolbar"><label className="search-box"><Search size={18} /><span className="sr-only">企業名を検索</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="企業名を検索" /></label><select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="選考状況で絞り込み"><option>すべて</option>{selectionStatuses.map((value) => <option key={value}>{value}</option>)}</select></div>
    <div className="section-heading"><h2>企業一覧</h2><span>{filtered.length}社</span></div>
    <div className="company-grid">{filtered.length ? filtered.map((company) => <article className="card company-card clickable" key={company.id} onClick={() => setSelected(company)} onKeyDown={(event) => (event.key === "Enter" || event.key === " ") && setSelected(company)} tabIndex={0} role="button">
      <div className="company-icon"><Building2 /></div><div className="company-body"><div className="meta-row"><StatusBadge tone="blue">{company.selectionStatus}</StatusBadge><StatusBadge tone={company.interestLevel === "第一志望群" ? "green" : "neutral"}>志望度 {company.interestLevel}</StatusBadge></div><h2>{company.name}</h2><p>{company.industry || "業界未設定"}</p><div className="company-dates">{company.entryDeadline && <span><CalendarClock size={14} />締切 {formatDate(company.entryDeadline)}</span>}{company.nextSelectionDate && <span><CalendarClock size={14} />次回 {formatDate(company.nextSelectionDate)}</span>}</div></div>
      <div className="card-actions"><button className="icon-button" onClick={(event) => { event.stopPropagation(); openEditForm(company); }} aria-label={`${company.name}を編集`}><Pencil size={17} /></button><button className="icon-button" onClick={(event) => { event.stopPropagation(); deleteCompany(company); }} aria-label={`${company.name}を削除`}><Trash2 size={17} /></button></div>
    </article>) : <EmptyState title="該当する企業はありません" description="検索条件を変更するか、企業を追加してください。" />}</div>

    {formOpen && <Modal title={editing ? "企業情報を編集" : "企業を追加"} onClose={closeForm}><form className="form-grid" onSubmit={submit} key={editing?.id ?? "new"}>
      {error && <p className="error-message">{error}</p>}
      <FormField label="企業名 *" htmlFor="company-name"><input id="company-name" name="name" defaultValue={editing?.name} autoFocus /></FormField>
      <FormField label="業界" htmlFor="industry"><select id="industry" name="industry" defaultValue={editing?.industry ?? ""}><option value="">未設定</option>{industryOptions.map((industry) => <option key={industry}>{industry}</option>)}</select></FormField>
      <FormField label="希望職種" htmlFor="role"><input id="role" name="desiredRole" defaultValue={editing?.desiredRole} /></FormField>
      <FormField label="所在地" htmlFor="location"><input id="location" name="location" defaultValue={editing?.location} /></FormField>
      <FormField label="志望度" htmlFor="interest"><select id="interest" name="interestLevel" defaultValue={editing?.interestLevel ?? "未設定"}>{interestLevels.map((level) => <option key={level}>{level}</option>)}</select></FormField>
      <FormField label="選考状況" htmlFor="status"><select id="status" name="selectionStatus" defaultValue={editing?.selectionStatus ?? "検討中"}>{selectionStatuses.map((value) => <option key={value}>{value}</option>)}</select></FormField>
      <FormField label="エントリー締切" htmlFor="deadline"><input id="deadline" name="entryDeadline" type="date" defaultValue={editing?.entryDeadline} /></FormField>
      <FormField label="次回選考日" htmlFor="next-date"><input id="next-date" name="nextSelectionDate" type="date" defaultValue={editing?.nextSelectionDate} /></FormField>
      <div className="form-field full"><FormField label="企業研究メモ" htmlFor="research"><textarea id="research" name="companyResearch" defaultValue={editing?.companyResearch} /></FormField></div>
      <div className="form-actions"><button type="button" className="secondary-button" onClick={closeForm}>キャンセル</button><button className="primary-button">{editing ? "変更を保存" : "登録する"}</button></div>
    </form></Modal>}

    {selected && <Modal title={selected.name} onClose={() => setSelected(null)}><div className="detail-stack"><div className="detail-header"><div className="meta-row"><StatusBadge tone="blue">{selected.selectionStatus}</StatusBadge><StatusBadge tone="green">志望度 {selected.interestLevel}</StatusBadge></div><button className="secondary-button" onClick={() => openEditForm(selected)}><Pencil size={16} />編集する</button></div><dl className="detail-list"><div><dt>業界</dt><dd>{selected.industry || "未設定"}</dd></div><div><dt>希望職種</dt><dd>{selected.desiredRole || "未設定"}</dd></div><div><dt>エントリー締切</dt><dd>{formatDate(selected.entryDeadline)}</dd></div><div><dt>次回選考日</dt><dd>{formatDate(selected.nextSelectionDate)}</dd></div>{selected.location && <div><dt>所在地</dt><dd><MapPin size={14} />{selected.location}</dd></div>}</dl><section><h3>企業研究メモ</h3><p>{selected.companyResearch || "まだメモはありません。"}</p></section></div></Modal>}
  </>;
}
