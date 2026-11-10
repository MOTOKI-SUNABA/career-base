import data from "@/data/japanese-holidays.json";

// Derived from the Cabinet Office's 国民の祝日 CSV; refresh with npm run update:holidays.
const holidays: Readonly<Record<string, string>> = data.holidays;
export const holidayYears = { first: data.firstYear, last: data.lastYear };
export function holidayName(date: string): string | undefined { return holidays[date]; }
