import type { Company } from "@/types";

const companyNameCollator = new Intl.Collator("ja", { sensitivity: "base", numeric: true });

function companyNameKey(name: string): string {
  return name.normalize("NFKC").trim()
    .replace(/^(?:株式会社|有限会社|合同会社|合資会社|合名会社|\(株\)|\(有\))\s*/u, "")
    .replace(/\s*(?:株式会社|有限会社|合同会社|合資会社|合名会社|\(株\)|\(有\))$/u, "")
    .replace(/[ァ-ヶ]/gu, (character) => String.fromCharCode(character.charCodeAt(0) - 0x60));
}

export function sortCompanies(companies: Company[], order: "default" | "deadline"): Company[] {
  return [...companies].sort((a, b) => {
    if (order === "deadline") {
      const deadlineOrder = (a.entryDeadline || "9999-12-31").localeCompare(b.entryDeadline || "9999-12-31");
      if (deadlineOrder) return deadlineOrder;
    }
    // Without readings, kanji use Japanese collation to keep similar names together.
    return companyNameCollator.compare(companyNameKey(a.name), companyNameKey(b.name));
  });
}
