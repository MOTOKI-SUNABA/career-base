"use client";

import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Settings, Trash2 } from "lucide-react";
import { FormField, Modal, confirmDelete } from "./ui";
import { useLocalStorageCollection } from "@/hooks/use-local-storage-collection";
import { calendarDays, toDateKey, todayKey } from "@/lib/date";
import { STORAGE_KEYS } from "@/lib/storage";
import { holidayName, holidayYears } from "@/lib/holidays";
import { categories, type CalendarEvent, type Category } from "@/types";

const categoryColors: Record<Category, string> = {
  "大学": "#356dab", "研究": "#8059a4", "就活": "#00664b",
  "アルバイト": "#b07a20", "プライベート": "#b75b7c", "その他": "#718078",
};
const eventColor = (event: CalendarEvent) => categoryColors[event.category] ?? categoryColors["その他"];

export function CalendarPage() {
  const now = new Date();
  const [month, setMonth] = useState(new Date(now.getFullYear(), now.getMonth(), 1));
  const [selected, setSelected] = useState(todayKey());
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CalendarEvent | null>(null);
  const [error, setError] = useState("");
  const { items, add, remove, replace } = useLocalStorageCollection<CalendarEvent>(STORAGE_KEYS.events);
  const days = useMemo(() => calendarDays(month), [month]);
  const eventsByDate = useMemo(() => {
    const grouped = new Map<string, CalendarEvent[]>();
    for (const item of items) {
      const events = grouped.get(item.date) ?? [];
      events.push(item); grouped.set(item.date, events);
    }
    for (const events of grouped.values()) events.sort((a, b) => (a.startTime ?? "").localeCompare(b.startTime ?? ""));
    return grouped;
  }, [items]);
  const selectedEvents = items.filter((item) => item.date === selected).sort((a, b) => (a.startTime ?? "").localeCompare(b.startTime ?? ""));

  function openAddForm() { setEditing(null); setError(""); setFormOpen(true); }
  function openEditForm(item: CalendarEvent) { setEditing(item); setError(""); setFormOpen(true); }
  function closeForm() { setFormOpen(false); setEditing(null); setError(""); }
  function selectDate(date: string) {
    setSelected(date);
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

  return <div className="calendar-page">
    <header className="calendar-heading">
      <h1>{month.getFullYear()}年{month.getMonth() + 1}月</h1>
      <div className="calendar-month-buttons"><button className="icon-button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} aria-label="前月"><ChevronLeft size={18} /></button><button className="icon-button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} aria-label="翌月"><ChevronRight size={18} /></button><button className="secondary-button calendar-today" onClick={() => { const today = new Date(); setMonth(new Date(today.getFullYear(), today.getMonth(), 1)); setSelected(todayKey()); }}>今日</button></div>
      <div className="header-actions"><Link href="/settings" className="icon-button" aria-label="設定を開く"><Settings size={20} /></Link><button className="primary-button calendar-add" aria-label="予定を追加" onClick={openAddForm}>＋<span> 追加</span></button></div>
    </header>
    <div className="content-columns calendar-layout">
      <section className="card calendar-card">
        <div className="weekdays">{["日", "月", "火", "水", "木", "金", "土"].map((day) => <span key={day}>{day}</span>)}</div>
        <div className="calendar-grid">{days.map((day) => {
          const key = toDateKey(day); const outside = day.getMonth() !== month.getMonth(); const events = eventsByDate.get(key) ?? []; const holiday = holidayName(key);
          return <button key={key} aria-pressed={key === selected} className={`${outside ? "outside " : ""}${holiday ? "holiday " : ""}${key === selected ? "selected " : ""}${key === todayKey() ? "today" : ""}`} onClick={() => selectDate(key)} aria-label={`${key}${holiday ? ` ${holiday}` : ""}${events.length ? ` 予定${events.length}件` : ""}`}><span className="calendar-day-number">{day.getDate()}</span>{events.length > 0 && <span className="calendar-event-dots" aria-hidden="true">{events.slice(0, 3).map((event) => <i key={event.id} style={{ backgroundColor: eventColor(event) }} title={event.category} />)}{events.length > 3 && <small>+{events.length - 3}</small>}</span>}</button>;
        })}</div>
        {(month.getFullYear() < holidayYears.first || month.getFullYear() > holidayYears.last) && <p className="calendar-holiday-notice">{month.getFullYear()}年の祝日データは未取得です。</p>}
      </section>
      <section className="schedule-section">
        <div className="section-heading"><div className="agenda-date-heading"><h2>{new Intl.DateTimeFormat("ja-JP", { month: "long", day: "numeric", weekday: "short" }).format(new Date(`${selected}T00:00:00`))}</h2>{holidayName(selected) && <span className="agenda-holiday">{holidayName(selected)}</span>}</div><span>{selectedEvents.length}件</span></div>
        <div className="agenda-list">{selectedEvents.length === 0 ? <p className="agenda-empty">予定はありません</p> : selectedEvents.map((item) => <button type="button" className="agenda-row" key={item.id} onClick={() => openEditForm(item)} aria-label={`${item.title}を編集`}>
          <span className="agenda-time"><strong>{item.startTime || "終日"}</strong>{item.endTime && <span>{item.endTime}</span>}</span>
          <span className="agenda-accent" style={{ backgroundColor: eventColor(item) }} title={item.category} aria-hidden="true" />
          <span className="agenda-content"><strong>{item.title}</strong>{item.description && <span>{item.description}</span>}</span>
        </button>)}</div>
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
        <div className="form-actions">{editing && <button type="button" className="danger-button agenda-delete" onClick={() => { if (confirmDelete("この予定") && remove(editing.id)) closeForm(); }}><Trash2 size={16} />削除</button>}<button type="button" className="secondary-button" onClick={closeForm}>キャンセル</button><button className="primary-button">{editing ? "変更を保存" : "登録する"}</button></div>
      </form>
    </Modal>}
  </div>;
}
