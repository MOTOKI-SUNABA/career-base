import { expect, test } from "@playwright/test";

const createdAt = "2026-01-01T00:00:00.000Z";
const notes = [
  { id: "old", title: "古いメモ", updatedAt: "2026-11-01T00:00:00.000Z", tags: ["面接"] },
  { id: "new", title: "新しいメモ", updatedAt: "2026-11-08T00:00:00.000Z", tags: ["面接"] },
  { id: "middle", title: "中間のメモ", updatedAt: "2026-11-05T00:00:00.000Z", tags: [] },
].map((note) => ({ ...note, createdAt, content: "本文", category: "通常メモ" }));

for (const width of [390, 1280]) {
  test(`updated dates sort chronologically without drag controls or changing stored order (${width}px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.clock.setFixedTime(new Date("2026-11-11T03:45:00.000Z"));
    await page.goto("/memos");
    await page.evaluate((notes) => { localStorage.clear(); localStorage.setItem("career-base-memos", JSON.stringify(notes)); }, notes);
    await page.reload();
    const sort = page.getByRole("combobox", { name: "メモの並び順", exact: true });
    await expect(sort).toHaveValue("newest");
    await expect(sort.locator("option")).toHaveText(["新しい順", "古い順"]);
    await expect(page.locator(".memo-list-item time").first()).toHaveAttribute("datetime", notes[1].updatedAt);
    await sort.selectOption("newest");
    await expect(page.locator(".memo-list-title")).toHaveText(["新しいメモ", "中間のメモ", "古いメモ"]);
    await expect(page.locator(".reorder-handle")).toHaveCount(0);
    await sort.selectOption("oldest");
    await expect(page.locator(".memo-list-title")).toHaveText(["古いメモ", "中間のメモ", "新しいメモ"]);
    await sort.selectOption("newest");
    await page.getByRole("button", { name: "古いメモ 面接", exact: true }).click();
    await expect(page.locator(".memo-document-meta")).not.toContainText("作成日");
    await page.getByRole("textbox", { name: "メモ本文", exact: true }).fill("更新した本文");
    await expect(page.locator(".memo-date-tags time")).toHaveAttribute("datetime", "2026-11-11T03:45:00.000Z");
    if (width < 760) await page.getByRole("button", { name: "一覧に戻る", exact: true }).click();
    await expect(page.locator(".memo-list-title")).toHaveText(["古いメモ", "新しいメモ", "中間のメモ"]);
    await page.getByRole("combobox", { name: "タグで絞り込み", exact: true }).selectOption("面接");
    await expect(page.locator(".memo-list-title")).toHaveText(["古いメモ", "新しいメモ"]);
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("career-base-memos") || "[]"));
    expect(saved.map((note: { id: string }) => note.id)).toEqual(notes.map((note) => note.id));
    expect(saved[0]).toMatchObject({ createdAt, content: "更新した本文", updatedAt: "2026-11-11T03:45:00.000Z" });
  });
}
