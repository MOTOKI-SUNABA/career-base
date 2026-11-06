import type { Company, CompanyList, CompanyWorkspace } from "@/types";
import { STORAGE_KEYS } from "./storage";

export const EMPTY_COMPANY_WORKSPACE: CompanyWorkspace = { version: 1, companies: [], lists: [] };

function isNamedRecord(value: unknown): value is CompanyList {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return typeof item.id === "string" && typeof item.name === "string" && typeof item.createdAt === "string" && typeof item.updatedAt === "string";
}

export function isCompanyListArray(value: unknown): value is CompanyList[] {
  return Array.isArray(value) && value.every(isNamedRecord) && new Set(value.map((item) => item.id)).size === value.length;
}

/** Read legacy company arrays and the new atomic companies/lists document. */
export function parseCompanyWorkspace(value: unknown): CompanyWorkspace | null {
  if (Array.isArray(value) && value.every(isNamedRecord)) return { version: 1, companies: value as Company[], lists: [] };
  if (!value || typeof value !== "object") return null;
  const data = value as Partial<CompanyWorkspace>;
  if (data.version !== 1 || !Array.isArray(data.companies) || !data.companies.every(isNamedRecord) || !isCompanyListArray(data.lists)) return null;
  return { version: 1, companies: data.companies, lists: data.lists };
}

export function readCompanyWorkspace(): CompanyWorkspace {
  if (typeof window === "undefined") return EMPTY_COMPANY_WORKSPACE;
  try { return parseCompanyWorkspace(JSON.parse(window.localStorage.getItem(STORAGE_KEYS.companies) ?? "null")) ?? EMPTY_COMPANY_WORKSPACE; }
  catch { return EMPTY_COMPANY_WORKSPACE; }
}

export function writeCompanyWorkspace(workspace: CompanyWorkspace): boolean {
  if (typeof window === "undefined") return false;
  try { window.localStorage.setItem(STORAGE_KEYS.companies, JSON.stringify(workspace)); return true; }
  catch { return false; }
}

export function reorderVisible<T extends { id: string }>(items: T[], activeId: string, overId: string, visibleIds: string[]): T[] {
  const visible = new Set(visibleIds);
  const ordered = items.filter((item) => visible.has(item.id));
  const from = ordered.findIndex((item) => item.id === activeId);
  const to = ordered.findIndex((item) => item.id === overId);
  if (from < 0 || to < 0 || from === to) return items;
  ordered.splice(to, 0, ordered.splice(from, 1)[0]);
  let index = 0;
  return items.map((item) => visible.has(item.id) ? ordered[index++] : item);
}
