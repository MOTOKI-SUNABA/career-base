import type { CalendarEvent, Company, Memo, Todo } from "@/types";
import { STORAGE_KEYS, readStorage } from "./storage";

export interface CareerBaseBackup {
  app: "career-base";
  version: 1;
  exportedAt: string;
  data: {
    events: CalendarEvent[];
    todos: Todo[];
    companies: Company[];
    memos: Memo[];
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isBaseItem(value: unknown): value is Record<string, unknown> {
  return isRecord(value) && typeof value.id === "string" && typeof value.createdAt === "string" && typeof value.updatedAt === "string";
}

function isBackup(value: unknown): value is CareerBaseBackup {
  if (!isRecord(value) || value.app !== "career-base" || value.version !== 1 || !isRecord(value.data)) return false;
  const { events, todos, companies, memos } = value.data;
  if (!Array.isArray(events) || !Array.isArray(todos) || !Array.isArray(companies) || !Array.isArray(memos)) return false;
  return events.every((item) => isBaseItem(item) && typeof item.title === "string" && typeof item.date === "string")
    && todos.every((item) => isBaseItem(item) && typeof item.title === "string" && typeof item.completed === "boolean")
    && companies.every((item) => isBaseItem(item) && typeof item.name === "string")
    && memos.every((item) => isBaseItem(item) && typeof item.title === "string" && typeof item.content === "string" && Array.isArray(item.tags));
}

export function createBackup(): CareerBaseBackup {
  return {
    app: "career-base",
    version: 1,
    exportedAt: new Date().toISOString(),
    data: {
      events: readStorage<CalendarEvent>(STORAGE_KEYS.events, []),
      todos: readStorage<Todo>(STORAGE_KEYS.todos, []),
      companies: readStorage<Company>(STORAGE_KEYS.companies, []),
      memos: readStorage<Memo>(STORAGE_KEYS.memos, []),
    },
  };
}

export function parseBackup(text: string): CareerBaseBackup | null {
  try { const value: unknown = JSON.parse(text); return isBackup(value) ? value : null; } catch { return null; }
}

export function restoreBackup(backup: CareerBaseBackup): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(STORAGE_KEYS.events, JSON.stringify(backup.data.events));
    window.localStorage.setItem(STORAGE_KEYS.todos, JSON.stringify(backup.data.todos));
    window.localStorage.setItem(STORAGE_KEYS.companies, JSON.stringify(backup.data.companies));
    window.localStorage.setItem(STORAGE_KEYS.memos, JSON.stringify(backup.data.memos));
    return true;
  } catch { return false; }
}

export function clearCareerBaseData(): boolean {
  if (typeof window === "undefined") return false;
  try { Object.values(STORAGE_KEYS).forEach((key) => window.localStorage.removeItem(key)); return true; } catch { return false; }
}
