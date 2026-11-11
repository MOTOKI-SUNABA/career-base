import type { Company } from "@/types";

export function sortCompanies(companies: Company[], order: "default" | "deadline"): Company[] {
  if (order === "default") return companies;
  return [...companies].sort((a, b) => {
    return (a.entryDeadline || "9999-12-31").localeCompare(b.entryDeadline || "9999-12-31");
  });
}
