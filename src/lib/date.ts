export const toDateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
export const todayKey = () => toDateKey(new Date());
export const formatDate = (value?: string) => value ? new Intl.DateTimeFormat("ja-JP", { month: "short", day: "numeric", weekday: "short" }).format(new Date(`${value}T00:00:00`)) : "未設定";
export function calendarDays(month: Date) { const first = new Date(month.getFullYear(), month.getMonth(), 1); const offset = first.getDay(); const count = Math.ceil((offset + new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()) / 7) * 7; return Array.from({ length: count }, (_, index) => new Date(month.getFullYear(), month.getMonth(), index - offset + 1)); }
