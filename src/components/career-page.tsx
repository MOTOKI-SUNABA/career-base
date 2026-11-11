"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ChevronRight, Folder, ListFilter, MoreHorizontal, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { EmptyState, FormField, Modal, PageHeader, StatusBadge, confirmDelete } from "./ui";
import { CompanyForm } from "./company-form";
import { useCompanyWorkspace } from "@/hooks/use-company-workspace";
import { useCloudSync } from "./cloud-sync-provider";
import { STORAGE_RESTORED_EVENT } from "@/lib/cloud-sync";
import { formatDate, todayKey } from "@/lib/date";
import { sortCompanies } from "@/lib/company-sort";
import type { Company, CompanyList } from "@/types";
import { selectionStatuses } from "@/types";

const selectionStatusColors = {
  "検討中": "neutral",
  "応募準備中": "amber",
  "選考中": "blue",
  "合格": "green",
  "イベント参加": "purple",
  "不合格": "red",
  "辞退": "neutral",
} as const;

function SelectionStatusBadge({ status, onChange, label, disabled }: { status: keyof typeof selectionStatusColors; onChange?: (status: Company["selectionStatus"]) => void; label?: string; disabled?: boolean }) {
  const palette = {
    neutral: { backgroundColor: "#edf0ee", color: "#526159" },
    amber: { backgroundColor: "#fff0c2", color: "#775000" },
    blue: { backgroundColor: "#e0eefc", color: "#235a8f" },
    purple: { backgroundColor: "#eee5fa", color: "#694095" },
    green: { backgroundColor: "#d8efdf", color: "#17613c" },
    red: { backgroundColor: "#fae5e2", color: "#993d34" },
  };
  const style = palette[selectionStatusColors[status] ?? "neutral"];
  return onChange ? <select className="badge selection-status selection-status-input" aria-label={label ?? "選考状況を変更"} value={status} disabled={disabled} style={style} onClick={(event) => event.stopPropagation()} onMouseDown={(event) => event.stopPropagation()} onTouchStart={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()} onChange={(event) => onChange(event.target.value as Company["selectionStatus"])}>{selectionStatuses.map((value) => <option key={value} value={value}>{value}</option>)}</select> : <span className="badge selection-status" style={style}>{status}</span>;
}

const ALL = "__all";
const UNFILED = "__unfiled";
type Dialog = { kind: "add" } | { kind: "detail" | "edit" | "list-settings" | "list-delete"; id: string } | { kind: "new-list" } | { kind: "move" | "bulk-delete"; ids: string[] } | null;

export function CareerPage() {
  const { companies, lists, hydrated, update } = useCompanyWorkspace();
  const cloud = useCloudSync();
  const [activeList, setActiveList] = useState(ALL);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("すべて");
  const [sortOrder, setSortOrder] = useState<"default" | "deadline">("default");
  const [selecting, setSelecting] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [dialog, setDialog] = useState<Dialog>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const ready = hydrated && !cloud.loading;
  const knownListIds = useMemo(() => new Set(lists.map((list) => list.id)), [lists]);
  const membership = (company: Company) => company.listId && knownListIds.has(company.listId) ? company.listId : UNFILED;
  const activeName = activeList === ALL ? "すべて" : activeList === UNFILED ? "未分類" : lists.find((list) => list.id === activeList)?.name ?? "すべて";
  const filtered = sortCompanies(companies.filter((company) => (activeList === ALL || membership(company) === activeList)
    && company.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()) && (status === "すべて" || company.selectionStatus === status)), sortOrder);
  const selectedVisible = filtered.filter((company) => checked.has(company.id));
  const company = dialog && "id" in dialog && ["detail", "edit"].includes(dialog.kind) ? companies.find((company) => company.id === dialog.id) : undefined;
  const currentList = dialog && "id" in dialog && dialog.kind.startsWith("list-") ? lists.find((list) => list.id === dialog.id) : undefined;
  const batch = dialog && "ids" in dialog ? companies.filter((company) => dialog.ids.includes(company.id)) : [];

  useEffect(() => {
    const refresh = () => { setDialog(null); setChecked(new Set()); setSelecting(false); setActiveList(ALL); setError(""); setNotice(""); };
    window.addEventListener(STORAGE_RESTORED_EVENT, refresh);
    return () => window.removeEventListener(STORAGE_RESTORED_EVENT, refresh);
  }, []);

  function openDialog(value: Dialog) { setError(""); setNotice(""); setDialog(value); }
  function closeDialog() { setDialog(null); setError(""); }
  function chooseList(id: string) { setActiveList(id); setChecked(new Set()); setNotice(""); }
  function finish(message: string) { closeDialog(); setChecked(new Set()); setSelecting(false); setNotice(message); }
  function failed() { setError("保存できませんでした。端末の保存領域を確認して再度お試しください。"); }

  function changeSelectionStatus(id: string, selectionStatus: Company["selectionStatus"]) {
    if (!ready || !selectionStatuses.includes(selectionStatus)) return;
    setError(""); setNotice("");
    const saved = update((workspace) => ({ ...workspace, companies: workspace.companies.map((item) => item.id === id ? { ...item, selectionStatus, updatedAt: new Date().toISOString() } : item) }));
    if (!saved) failed();
  }

  function saveCompany(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    if (!name) { setError("企業名を入力してください。"); return; }
    const listId = String(form.get("listId") ?? "");
    if (listId && !knownListIds.has(listId)) { setError("所属リストを選び直してください。"); return; }
    const stamp = new Date().toISOString();
    const value: Company = {
      ...company, id: company?.id ?? crypto.randomUUID(), name, listId: listId || undefined,
      industry: String(form.get("industry") ?? "") || undefined,
      desiredRole: String(form.get("desiredRole") ?? "").trim() || undefined,
      interestLevel: String(form.get("interestLevel") ?? "未設定") as Company["interestLevel"],
      selectionStatus: String(form.get("selectionStatus") ?? "検討中") as Company["selectionStatus"],
      entryDeadline: String(form.get("entryDeadline") ?? "") || undefined,
      nextSelectionDate: String(form.get("nextSelectionDate") ?? "") || undefined,
      location: String(form.get("location") ?? "").trim() || undefined,
      companyResearch: String(form.get("companyResearch") ?? "").trim() || undefined,
      createdAt: company?.createdAt ?? stamp, updatedAt: stamp,
    };
    const saved = update((workspace) => ({ ...workspace, companies: company ? workspace.companies.map((item) => item.id === company.id ? { ...item, ...value } : item) : [value, ...workspace.companies] }));
    if (!saved) { failed(); return; }
    closeDialog();
  }

  function saveList(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = String(new FormData(event.currentTarget).get("name") ?? "").trim();
    if (!name || name.length > 40 || ["すべて", "未分類"].includes(name) || lists.some((list) => list.id !== currentList?.id && list.name === name)) {
      setError("重複しないリスト名を40文字以内で入力してください。「すべて」「未分類」は使用できません。"); return;
    }
    const stamp = new Date().toISOString();
    const value: CompanyList = { id: currentList?.id ?? crypto.randomUUID(), name, createdAt: currentList?.createdAt ?? stamp, updatedAt: stamp };
    const saved = update((workspace) => ({ ...workspace, lists: currentList ? workspace.lists.map((list) => list.id === currentList.id ? value : list) : [...workspace.lists, value] }));
    if (!saved) { failed(); return; }
    setActiveList(value.id); finish(currentList ? "リスト名を変更しました。" : "リストを作成しました。");
  }

  function deleteList() {
    if (!currentList) return;
    const stamp = new Date().toISOString();
    const saved = update((workspace) => ({ ...workspace,
      lists: workspace.lists.filter((list) => list.id !== currentList.id),
      companies: workspace.companies.map((company) => company.listId === currentList.id ? { ...company, listId: undefined, updatedAt: stamp } : company),
    }));
    if (!saved) { failed(); return; }
    setActiveList(UNFILED); finish("リストを削除し、所属企業を未分類に戻しました。");
  }

  function moveCompanies(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!dialog || dialog.kind !== "move" || !batch.length) return;
    const listId = String(new FormData(event.currentTarget).get("listId") ?? "");
    if (listId && !knownListIds.has(listId)) { setError("移動先を選び直してください。"); return; }
    const ids = new Set(dialog.ids); const stamp = new Date().toISOString();
    const saved = update((workspace) => ({ ...workspace, companies: workspace.companies.map((company) => ids.has(company.id) ? { ...company, listId: listId || undefined, updatedAt: stamp } : company) }));
    if (!saved) { failed(); return; }
    finish(`${batch.length}社を「${lists.find((list) => list.id === listId)?.name ?? "未分類"}」に移動しました。`);
  }

  function deleteCompanies(ids: string[]) {
    const targets = new Set(ids);
    const saved = update((workspace) => ({ ...workspace, companies: workspace.companies.filter((company) => !targets.has(company.id)) }));
    if (!saved) { failed(); return; }
    finish(`${ids.length}社を削除しました。`);
  }

  function cells(value: Company) {
    const date = companyListDate(value);
    return <>{selecting ? <span className="company-list-name" title={value.name}>{value.name}</span> : <button type="button" className="company-list-name company-detail-open" title={value.name} aria-haspopup="dialog" disabled={!ready}>{value.name}</button>}<span className="company-list-status"><SelectionStatusBadge status={value.selectionStatus} onChange={selecting ? undefined : (status) => changeSelectionStatus(value.id, status)} label={`${value.name}の選考状況`} disabled={!ready} /></span><span className="company-list-date">{date ? <>{date.label} <time dateTime={date.value}>{formatDate(date.value)}</time></> : null}</span>{!selecting && <ChevronRight size={16} className="company-list-arrow" aria-hidden="true" />}</>;
  }

  return <>
    <PageHeader title="企業情報" onAdd={ready ? () => openDialog({ kind: "add" }) : undefined} />
    {cloud.loading && <p className="muted" role="status">保存済みの企業情報を確認しています…</p>}
    <div className="career-workspace">
      <aside className="career-sidebar" aria-label="企業リスト">
        <div className="career-sidebar-heading"><h2><Folder size={16} />リスト</h2><button type="button" className="secondary-button" aria-label="リスト" title="リストを追加" onClick={() => openDialog({ kind: "new-list" })} disabled={!ready}><Plus size={15} /></button></div>
        <label className="career-mobile-list-picker">表示リスト<select value={activeList} onChange={(event) => chooseList(event.target.value)}><option value={ALL}>すべて（{companies.length}）</option><option value={UNFILED}>未分類（{companies.filter((company) => membership(company) === UNFILED).length}）</option>{lists.map((list) => <option value={list.id} key={list.id}>{list.name}（{companies.filter((company) => company.listId === list.id).length}）</option>)}</select></label>
        <nav className="career-list-nav" aria-label="企業リストの切り替え">
          {[{ id: ALL, name: "すべて", count: companies.length }, { id: UNFILED, name: "未分類", count: companies.filter((company) => membership(company) === UNFILED).length }, ...lists.map((list) => ({ ...list, count: companies.filter((company) => company.listId === list.id).length }))].map((list) => <div className="career-list-nav-row" key={list.id}>
            <button type="button" className={`career-list-link${activeList === list.id ? " active" : ""}`} onClick={() => chooseList(list.id)} aria-pressed={activeList === list.id}><span>{list.name}</span><span className="career-list-count">{list.count}</span></button>
            {![ALL, UNFILED].includes(list.id) && <button type="button" className="career-list-settings" aria-label={`${list.name}の設定`} onClick={() => openDialog({ kind: "list-settings", id: list.id })}><MoreHorizontal size={17} /></button>}
          </div>)}
        </nav>
        {![ALL, UNFILED].includes(activeList) && <button type="button" className="career-mobile-list-settings secondary-button" onClick={() => openDialog({ kind: "list-settings", id: activeList })}>このリストの設定</button>}
      </aside>
      <div className="career-main">
        <div className="toolbar"><label className="search-box"><Search size={18} /><span className="sr-only">企業名を検索</span><input value={query} onChange={(event) => { setQuery(event.target.value); setChecked(new Set()); }} placeholder="企業名を検索" /></label><select value={status} onChange={(event) => { setStatus(event.target.value); setChecked(new Set()); }} aria-label="選考状況で絞り込み"><option>すべて</option>{selectionStatuses.map((value) => <option key={value}>{value}</option>)}</select></div>
        <div className="career-section-heading"><h2>{activeName}<span>{filtered.length}社</span></h2><div className="company-list-controls"><select aria-label="企業の並び順" value={sortOrder} onChange={(event) => setSortOrder(event.target.value as "default" | "deadline")}><option value="default">デフォルト</option><option value="deadline">締切順</option></select><button type="button" className="secondary-button" disabled={!ready} aria-pressed={selecting} onClick={() => { setSelecting(!selecting); setChecked(new Set()); setNotice(""); }}><ListFilter size={16} />{selecting ? "完了" : "選択"}</button></div></div>
        {notice && <p className="career-notice" role="status">{notice}</p>}
        {error && !dialog && <p className="error-message" role="alert">{error}</p>}
        {selecting && <div className="company-bulk-toolbar"><span>{selectedVisible.length}社を選択中</span><div>
          <button type="button" className="secondary-button bulk-select-all" disabled={!filtered.length} onClick={() => setChecked(selectedVisible.length === filtered.length ? new Set() : new Set(filtered.map((company) => company.id)))}>{selectedVisible.length === filtered.length && filtered.length ? "選択をすべて解除" : "表示中をすべて選択"}</button>
          <button type="button" className="secondary-button" disabled={!selectedVisible.length} onClick={() => openDialog({ kind: "move", ids: selectedVisible.map((company) => company.id) })}>リスト移動</button>
          <button type="button" className="danger-button" disabled={!selectedVisible.length} onClick={() => openDialog({ kind: "bulk-delete", ids: selectedVisible.map((company) => company.id) })}>企業削除</button>
        </div></div>}
        {filtered.length ? <div className={`company-list-surface${selecting ? " is-selecting" : ""}`}>
          <div className="company-list-columns" aria-hidden="true"><span>企業名</span><span>選考状況</span><span>日付</span><span /></div>
          {selecting ? <ul className="company-list company-selection-list" aria-label="企業を選択">{filtered.map((company) => <li key={company.id}><label className={`company-selection-row${checked.has(company.id) ? " checked" : ""}`}><input type="checkbox" className="selection-circle" aria-label={`${company.name}を選択`} checked={checked.has(company.id)} onChange={(event) => { const next = new Set(checked); if (event.target.checked) next.add(company.id); else next.delete(company.id); setChecked(next); }} /><span className="company-selection-content">{cells(company)}</span></label></li>)}</ul> :
            <ul className="company-list" aria-label="企業一覧">{filtered.map((company) => <li key={company.id}><div className="company-list-row" onClick={() => { if (ready) openDialog({ kind: "detail", id: company.id }); }}>{cells(company)}</div></li>)}</ul>}
        </div> : <EmptyState title={companies.length ? "該当する企業はありません" : "企業を登録しましょう"} description="検索条件を変更するか、企業を追加してください。" />}
      </div>
    </div>

    {(dialog?.kind === "add" || (dialog?.kind === "edit" && company)) && <Modal title={company ? "企業情報を編集" : "企業を追加"} onClose={closeDialog}><CompanyForm key={company?.id ?? "new"} company={company} lists={lists} defaultListId={knownListIds.has(activeList) ? activeList : ""} error={error} onSubmit={saveCompany} onClose={closeDialog} /></Modal>}

    {dialog?.kind === "detail" && company && <Modal title={company.name} onClose={closeDialog}><div className="detail-stack">
      {error && <p className="error-message" role="alert">{error}</p>}
      <div className="detail-header"><div className="meta-row"><SelectionStatusBadge status={company.selectionStatus} onChange={(status) => changeSelectionStatus(company.id, status)} disabled={!ready} /><StatusBadge tone="green">志望度 {company.interestLevel}</StatusBadge></div><button className="secondary-button" onClick={() => openDialog({ kind: "edit", id: company.id })}><Pencil size={16} />編集する</button></div>
      <dl className="detail-list"><div><dt>所属リスト</dt><dd>{lists.find((list) => list.id === company.listId)?.name ?? "未分類"}</dd></div><div><dt>業界</dt><dd>{company.industry || "未設定"}</dd></div><div><dt>希望職種</dt><dd>{company.desiredRole || "未設定"}</dd></div><div><dt>エントリー締切</dt><dd>{formatDate(company.entryDeadline)}</dd></div><div><dt>次回選考日</dt><dd>{formatDate(company.nextSelectionDate)}</dd></div>{company.location && <div><dt>所在地</dt><dd>{company.location}</dd></div>}</dl>
      <section><h3>企業研究メモ</h3><p>{company.companyResearch || "まだメモはありません。"}</p></section><div className="company-detail-delete"><button type="button" className="danger-button" onClick={() => { if (confirmDelete("この企業")) deleteCompanies([company.id]); }}><Trash2 size={16} />この企業を削除</button></div>
    </div></Modal>}

    {(dialog?.kind === "new-list" || (dialog?.kind === "list-settings" && currentList)) && <Modal title={currentList ? "リストの設定" : "リストを作成"} onClose={closeDialog}><form className="company-form" onSubmit={saveList} key={currentList?.id ?? "new-list"}>
      {error && <p className="error-message" role="alert">{error}</p>}
      <FormField label="リスト名" htmlFor="list-name"><input id="list-name" name="name" defaultValue={currentList?.name} maxLength={40} placeholder="例：エントリー予定" required autoFocus /></FormField>
      <div className="company-form-actions"><button type="button" className="secondary-button" onClick={closeDialog}>キャンセル</button><button className="primary-button">{currentList ? "変更を保存" : "作成する"}</button></div>
      {currentList && <button type="button" className="danger-button" onClick={() => openDialog({ kind: "list-delete", id: currentList.id })}>このリストを削除</button>}
    </form></Modal>}

    {dialog?.kind === "list-delete" && currentList && <Modal title="リストを削除" onClose={closeDialog}><div className="company-form">
      {error && <p className="error-message" role="alert">{error}</p>}
      <p>「{currentList.name}」を削除します。所属する{companies.filter((company) => company.listId === currentList.id).length}社は未分類に戻ります。</p><div className="company-form-actions"><button type="button" className="secondary-button" onClick={closeDialog}>キャンセル</button><button type="button" className="danger-button" onClick={deleteList}>リストを削除する</button></div>
    </div></Modal>}

    {(dialog?.kind === "move" || dialog?.kind === "bulk-delete") && <Modal title={dialog.kind === "move" ? "リスト移動" : `${batch.length}社を削除しますか？`} onClose={closeDialog}><form className="company-form" onSubmit={(event) => { if (dialog.kind === "move") moveCompanies(event); else { event.preventDefault(); deleteCompanies(batch.map((company) => company.id)); } }}>
      {error && <p className="error-message" role="alert">{error}</p>}
      <ul className="company-batch-names">{batch.map((company) => <li key={company.id}>{company.name}</li>)}</ul>
      {dialog.kind === "move" ? <FormField label="移動先" htmlFor="move-list"><select id="move-list" name="listId" defaultValue={lists.find((list) => list.id !== activeList)?.id ?? ""}><option value="">未分類</option>{lists.map((list) => <option key={list.id} value={list.id}>{list.name}</option>)}</select></FormField> : <p className="muted">企業情報と企業研究メモを削除します。この操作は取り消せません。</p>}
      <div className="company-form-actions"><button type="button" className="secondary-button" onClick={closeDialog}>キャンセル</button><button disabled={!batch.length} className={dialog.kind === "move" ? "primary-button" : "danger-button"}>{dialog.kind === "move" ? "移動する" : "企業を削除する"}</button></div>
    </form></Modal>}
  </>;
}

function companyListDate(company: Company) {
  const dates = [...(company.entryDeadline ? [{ label: "締切", value: company.entryDeadline }] : []), ...(company.nextSelectionDate ? [{ label: "次回", value: company.nextSelectionDate }] : [])].sort((a, b) => a.value.localeCompare(b.value));
  return dates.find((date) => date.value >= todayKey()) ?? dates.at(-1);
}
