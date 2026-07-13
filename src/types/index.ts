export const categories = ["大学", "研究", "就活", "アルバイト", "プライベート", "その他"] as const;
export type Category = (typeof categories)[number];
export interface CalendarEvent { id: string; title: string; date: string; startTime?: string; endTime?: string; category: Category; description?: string; createdAt: string; updatedAt: string }
export interface Todo { id: string; title: string; description?: string; dueDate?: string; priority: "高" | "中" | "低"; category: Category; completed: boolean; companyId?: string; createdAt: string; updatedAt: string }
export const interestLevels = ["第一志望群", "高", "中", "低", "未設定"] as const;
export const selectionStatuses = ["検討中", "エントリー予定", "エントリー済み", "ES提出済み", "Webテスト", "面接", "インターン参加決定", "合格", "落選", "辞退"] as const;
export const industries = ["IT・ソフトウェア", "メーカー", "商社", "金融", "コンサルティング", "広告・出版・メディア", "人材・教育", "不動産・建設", "医療・福祉", "官公庁・団体", "その他"] as const;
export interface Company { id: string; name: string; industry?: string; desiredRole?: string; interestLevel: (typeof interestLevels)[number]; selectionStatus: (typeof selectionStatuses)[number]; entryDeadline?: string; nextSelectionDate?: string; location?: string; startingSalary?: string; portalUrl?: string; companyResearch?: string; esNotes?: string; interviewNotes?: string; createdAt: string; updatedAt: string }
export const memoCategories = ["通常メモ", "研究", "授業", "自己分析", "ES", "面接対策", "企業研究", "その他"] as const;
export interface Memo { id: string; title: string; content: string; category: (typeof memoCategories)[number]; tags: string[]; companyId?: string; createdAt: string; updatedAt: string }
