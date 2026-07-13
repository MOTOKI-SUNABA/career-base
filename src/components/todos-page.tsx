"use client";

import { useState, type FormEvent } from "react";
import { CalendarClock, Pencil, Trash2 } from "lucide-react";
import { EmptyState, FormField, Modal, PageHeader, StatusBadge, confirmDelete } from "./ui";
import { useLocalStorageCollection } from "@/hooks/use-local-storage-collection";
import { formatDate, todayKey } from "@/lib/date";
import { seedTodos } from "@/lib/seed";
import { STORAGE_KEYS } from "@/lib/storage";
import { categories, type Todo } from "@/types";

export function TodosPage() {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Todo | null>(null);
  const [error, setError] = useState("");
  const { items, add, remove, replace } = useLocalStorageCollection(STORAGE_KEYS.todos, seedTodos);
  const pending = items.filter((item) => !item.completed).sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"));
  const done = items.filter((item) => item.completed);

  function openAddForm() { setEditing(null); setError(""); setFormOpen(true); }
  function openEditForm(item: Todo) { setEditing(item); setError(""); setFormOpen(true); }
  function closeForm() { setFormOpen(false); setEditing(null); setError(""); }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget); const title = String(form.get("title") ?? "").trim();
    if (!title) return setError("ToDoのタイトルを入力してください。");
    const stamp = new Date().toISOString();
    const value: Todo = {
      id: editing?.id ?? crypto.randomUUID(), title, description: String(form.get("description")).trim() || undefined,
      dueDate: String(form.get("dueDate")) || undefined, priority: String(form.get("priority")) as Todo["priority"],
      category: String(form.get("category")) as Todo["category"], completed: editing?.completed ?? false,
      companyId: editing?.companyId, createdAt: editing?.createdAt ?? stamp, updatedAt: stamp,
    };
    if (editing) replace(value); else add(value); closeForm();
  }
  function renderItem(todo: Todo) {
    const overdue = !todo.completed && !!todo.dueDate && todo.dueDate < todayKey();
    return <article className={`card todo-item ${overdue ? "overdue" : ""}`} key={todo.id}>
      <label className="todo-check"><input type="checkbox" checked={todo.completed} onChange={() => replace({ ...todo, completed: !todo.completed, updatedAt: new Date().toISOString() })} /><span className={todo.completed ? "done" : ""}>{todo.title}</span></label>
      <div className="todo-details"><div className="meta-row"><StatusBadge tone={todo.priority === "高" ? "red" : todo.priority === "中" ? "amber" : "neutral"}>優先度 {todo.priority}</StatusBadge><StatusBadge>{todo.category}</StatusBadge>{todo.dueDate && <span className={overdue ? "due overdue-text" : "due"}><CalendarClock size={14} />{overdue ? "期限切れ: " : "締切: "}{formatDate(todo.dueDate)}</span>}</div>
        <div className="card-actions"><button className="icon-button" onClick={() => openEditForm(todo)} aria-label={`${todo.title}を編集`}><Pencil size={17} /></button><button className="icon-button" onClick={() => confirmDelete("このToDo") && remove(todo.id)} aria-label={`${todo.title}を削除`}><Trash2 size={17} /></button></div>
      </div>{todo.description && <p className="muted">{todo.description}</p>}
    </article>;
  }

  return <>
    <PageHeader title="ToDo" description="やるべきことを期限順に整理" onAdd={openAddForm} />
    <div className="section-heading"><h2>未完了</h2><span>{pending.length}件</span></div><div className="list">{pending.length ? pending.map(renderItem) : <EmptyState title="未完了のToDoはありません" description="新しいタスクを追加してみましょう。" />}</div>
    <div className="section-heading"><h2>完了済み</h2><span>{done.length}件</span></div><div className="list">{done.length ? done.map(renderItem) : <EmptyState title="完了済みはありません" description="完了した項目がここに移動します。" />}</div>
    {formOpen && <Modal title={editing ? "ToDoを編集" : "ToDoを追加"} onClose={closeForm}><form className="form-grid" onSubmit={submit} key={editing?.id ?? "new"}>
      {error && <p className="error-message">{error}</p>}
      <FormField label="タイトル *" htmlFor="todo-title"><input id="todo-title" name="title" defaultValue={editing?.title} autoFocus /></FormField>
      <FormField label="締切日" htmlFor="todo-due"><input id="todo-due" name="dueDate" type="date" defaultValue={editing?.dueDate} /></FormField>
      <FormField label="優先度" htmlFor="todo-priority"><select id="todo-priority" name="priority" defaultValue={editing?.priority ?? "中"}><option>高</option><option>中</option><option>低</option></select></FormField>
      <FormField label="カテゴリ" htmlFor="todo-category"><select id="todo-category" name="category" defaultValue={editing?.category ?? categories[0]}>{categories.map((category) => <option key={category}>{category}</option>)}</select></FormField>
      <div className="form-field full"><FormField label="詳細" htmlFor="todo-description"><textarea id="todo-description" name="description" defaultValue={editing?.description} /></FormField></div>
      <div className="form-actions"><button type="button" className="secondary-button" onClick={closeForm}>キャンセル</button><button className="primary-button">{editing ? "変更を保存" : "登録する"}</button></div>
    </form></Modal>}
  </>;
}
