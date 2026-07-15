"use client";

import { useMemo, useRef, useState, type FormEvent } from "react";
import { ChevronLeft, ChevronRight, Clock3, Pencil, Trash2 } from "lucide-react";
import { EmptyState, FormField, Modal, PageHeader, StatusBadge, confirmDelete } from "./ui";
import { useLocalStorageCollection } from "@/hooks/use-local-storage-collection";
import { calendarDays, toDateKey, todayKey } from "@/lib/date";
import { STORAGE_KEYS } from "@/lib/storage";
import { categories, type CalendarEvent } from "@/types";

export function CalendarPage() {
  const now = new Date();
  const [month, setMonth] = useState(new Date(now.getFullYear(), now.getMonth(), 1));
  const [selected, setSelected] = useState(todayKey());
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CalendarEvent | null>(null);
  const [error, setError] = useState("");
  const scheduleRef = useRef<HTMLElement>(null);
  const { items, add, remove, replace } = useLocalStorageCollection<CalendarEvent>(STORAGE_KEYS.events);
  const days = useMemo(() => calendarDays(month), [month]);
  const selectedEvents = items.filter((item) => item.date === selected).sort((a, b) => (a.startTime ?? "").localeCompare(b.startTime ?? ""));

  function openAddForm() { setEditing(null); setError(""); setFormOpen(true); }
  function openEditForm(item: CalendarEvent) { setEditing(item); setError(""); setFormOpen(true); }
  function closeForm() { setFormOpen(false); setEditing(null); setError(""); }
  function selectDate(date: string) {
    setSelected(date);
    if (window.matchMedia("(max-width: 699px)").matches) {
      window.requestAnimationFrame(() => scheduleRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    }
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const title = String(form.get("title") ?? "").trim();
    if (!title) return setError("予定名を入力してください。");
    const stamp = new Date().toISOString();
    const value: CalendarEvent = {
      id: editing?.id ?? crypto.randomUUID(), title, date: String(form.get("date")),
      startTime: String(form.get("startTime")) || undefined, endTime: String(form.get("endTime")) || undefined,
      category: String(form.get("category")) as CalendarEvent["category"], description: String(form.get("description")).trim() || undefined,
      createdAt: editing?.createdAt ?? stamp, updatedAt: stamp,
    };
    if (editing) replace(value); else add(value);
    setSelected(value.date); closeForm();
  }

  return <>
    <PageHeader title="カレンダー" description="授業・研究・就活の予定をひと目で確認" onAdd={openAddForm} />
    <div className="content-columns">
      <section className="card calendar-card">
        <div className="month-controls">
          <button className="icon-button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} aria-label="前月"><ChevronLeft /></button>
          <h2>{month.getFullYear()}年 {month.getMonth() + 1}月</h2>
          <button className="icon-button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} aria-label="翌月"><ChevronRight /></button>
        </div>
        <div className="weekdays">{["月", "火", "水", "木", "金", "土", "日"].map((day) => <span key={day}>{day}</span>)}</div>
        <div className="calendar-grid">{days.map((day) => {
          const key = toDateKey(day); const outside = day.getMonth() !== month.getMonth(); const has = items.some((item) => item.date === key);
          return <button key={key} className={`${outside ? "outside " : ""}${key === selected ? "selected " : ""}${key === todayKey() ? "today" : ""}`} onClick={() => selectDate(key)} aria-label={`${key}${has ? " 予定あり" : ""}`}><span>{day.getDate()}</span>{has && <i aria-hidden />}</button>;
        })}</div>
      </section>
      <section ref={scheduleRef} className="schedule-section">
        <div className="section-heading"><h2>{new Intl.DateTimeFormat("ja-JP", { month: "long", day: "numeric", weekday: "short" }).format(new Date(`${selected}T00:00:00`))}</h2><span>{selectedEvents.length}件</span></div>
        <div className="list">{selectedEvents.length === 0 ? <EmptyState title="予定はありません" description="追加ボタンから予定を登録できます。" /> : selectedEvents.map((item) => <article className="card event-card" key={item.id}>
          <div><div className="meta-row"><StatusBadge tone="green">{item.category}</StatusBadge>{item.startTime && <span className="muted"><Clock3 size={13} />{item.startTime}{item.endTime && `–${item.endTime}`}</span>}</div><h3 className="card-title">{item.title}</h3>{item.description && <p className="muted">{item.description}</p>}</div>
          <div className="card-actions"><button className="icon-button" onClick={() => openEditForm(item)} aria-label={`${item.title}を編集`}><Pencil size={17} /></button><button className="icon-button" onClick={() => confirmDelete("この予定") && remove(item.id)} aria-label={`${item.title}を削除`}><Trash2 size={17} /></button></div>
        </article>)}</div>
      </section>
    </div>
    {formOpen && <Modal title={editing ? "予定を編集" : "予定を追加"} onClose={closeForm}>
      <form className="form-grid" onSubmit={submit} key={editing?.id ?? `new-${selected}`}>
        {error && <p className="error-message">{error}</p>}
        <FormField label="予定名 *" htmlFor="event-title"><input id="event-title" name="title" defaultValue={editing?.title} autoFocus /></FormField>
        <FormField label="日付 *" htmlFor="event-date"><input id="event-date" name="date" type="date" defaultValue={editing?.date ?? selected} required /></FormField>
        <FormField label="開始時刻" htmlFor="start-time"><input id="start-time" name="startTime" type="time" defaultValue={editing?.startTime} /></FormField>
        <FormField label="終了時刻" htmlFor="end-time"><input id="end-time" name="endTime" type="time" defaultValue={editing?.endTime} /></FormField>
        <FormField label="カテゴリ" htmlFor="event-category"><select id="event-category" name="category" defaultValue={editing?.category ?? categories[0]}>{categories.map((category) => <option key={category}>{category}</option>)}</select></FormField><div />
        <div className="form-field full"><FormField label="詳細" htmlFor="event-description"><textarea id="event-description" name="description" defaultValue={editing?.description} /></FormField></div>
        <div className="form-actions"><button type="button" className="secondary-button" onClick={closeForm}>キャンセル</button><button className="primary-button">{editing ? "変更を保存" : "登録する"}</button></div>
      </form>
    </Modal>}
  </>;
}
