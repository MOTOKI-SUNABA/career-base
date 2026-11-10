import { selectionStatuses, type Company } from "@/types";

const legacyStatuses: Record<string, Company["selectionStatus"]> = {
  "エントリー予定": "応募準備中",
  "エントリー済み": "選考中",
  "ES提出済み": "選考中",
  "Webテスト": "選考中",
  "面接": "選考中",
  "インターン参加決定": "イベント参加",
  "合格・参加決定": "合格",
  "落選": "不合格",
};

export function normalizeSelectionStatus(value: unknown): Company["selectionStatus"] {
  if (typeof value !== "string") return "検討中";
  if (selectionStatuses.includes(value as Company["selectionStatus"])) return value as Company["selectionStatus"];
  return legacyStatuses[value] ?? "検討中";
}

export function normalizeCompanyStatuses(companies: Company[]): Company[] {
  return companies.map((company) => ({ ...company, selectionStatus: normalizeSelectionStatus(company.selectionStatus) }));
}
