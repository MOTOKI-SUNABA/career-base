import type { Memo } from "@/types";

/** Legacy notes are text, even when they contain HTML-looking characters. */
export function memoEditorContent(memo: Pick<Memo, "content" | "richContent">): string {
  if (typeof memo.richContent === "string") return memo.richContent;
  return memo.content.split(/\r\n|\r|\n/).map((line) => `<p>${line.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;")}</p>`).join("");
}
