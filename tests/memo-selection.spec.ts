import { expect, test, type Page } from "@playwright/test";

const stamp = "2026-01-01T00:00:00.000Z";
const notes = [
  { id: "a", title: "対象A", category: "研究" },
  { id: "b", title: "その他B", category: "通常メモ" },
  { id: "c", title: "対象C", category: "研究" },
].map((note) => ({ ...note, content: `${note.title}の本文`, richContent: `<p><strong>${note.title}の本文</strong></p>`, tags: ["タグ"], companyId: "company-1", createdAt: stamp, updatedAt: stamp }));

async function seed(page: Page) {
  await page.goto("/memos");
  await page.evaluate((notes) => { localStorage.clear(); localStorage.setItem("career-base-memos", JSON.stringify(notes)); }, notes);
  await page.reload();
  await expect(page.locator(".memo-list-item")).toHaveCount(3);
}

async function saved(page: Page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem("career-base-memos") || "[]") as typeof notes);
}

test("bulk category move keeps rich content, order and the open editor in sync", async ({ page }) => {
  await seed(page);
  await page.getByRole("button", { name: "対象A タグ", exact: true }).click();
  await page.getByRole("combobox", { name: "カテゴリで絞り込み", exact: true }).selectOption("研究");
  await page.getByRole("button", { name: "選択", exact: true }).click();
  await expect(page.locator(".reorder-handle")).toHaveCount(0);
  await page.getByRole("button", { name: "表示中をすべて選択", exact: true }).click();
  await expect(page.getByRole("checkbox", { checked: true })).toHaveCount(2);
  await page.getByRole("button", { name: "カテゴリ移動", exact: true }).click();
  await page.getByRole("combobox", { name: "移動先", exact: true }).selectOption("面接対策");
  await page.getByRole("button", { name: "移動する", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "メモ本文", exact: true }).locator("strong")).toHaveText("対象Aの本文");
  await expect(page.getByRole("combobox", { name: "カテゴリ", exact: true })).toHaveValue("面接対策");
  await page.getByRole("textbox", { name: "タイトル", exact: true }).fill("移動後の編集");
  const values = await saved(page);
  expect(values.map((note) => note.id)).toEqual(["a", "b", "c"]);
  expect(values[0]).toMatchObject({ ...notes[0], title: "移動後の編集", category: "面接対策", updatedAt: expect.any(String) });
  expect(values[1]).toEqual(notes[1]);
  expect(values[2]).toMatchObject({ ...notes[2], category: "面接対策", updatedAt: expect.any(String) });
  await page.reload();
  await page.getByRole("button", { name: "移動後の編集 タグ", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "カテゴリ", exact: true })).toHaveValue("面接対策");
});

test("search clears selections; confirmed deletion affects only displayed selected memos and closes a deleted editor", async ({ page }) => {
  await seed(page);
  await page.getByRole("button", { name: "対象A タグ", exact: true }).click();
  await page.getByRole("button", { name: "選択", exact: true }).click();
  await page.getByRole("checkbox", { name: "その他Bを選択", exact: true }).check();
  await page.getByRole("textbox", { name: "メモを検索", exact: true }).fill("対象");
  await expect(page.getByRole("button", { name: "メモ削除", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "表示中をすべて選択", exact: true }).click();
  await page.getByRole("button", { name: "メモ削除", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveAccessibleName("2件のメモを削除しますか？");
  await expect(page.getByRole("dialog")).not.toContainText("その他B");
  await page.getByRole("button", { name: "キャンセル", exact: true }).click();
  await expect(page.getByRole("checkbox", { checked: true })).toHaveCount(2);
  await page.getByRole("button", { name: "メモ削除", exact: true }).click();
  await page.getByRole("button", { name: "メモを削除する", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "メモ本文", exact: true })).toHaveCount(0);
  expect(await saved(page)).toEqual([notes[1]]);
  await page.reload();
  await expect(page.locator(".memo-list-title")).toHaveText(["その他B"]);
});

for (const action of ["move", "delete"] as const) {
  test(`failed bulk ${action} leaves the stored data and selections intact`, async ({ page }) => {
    await seed(page);
    await page.getByRole("button", { name: "選択", exact: true }).click();
    await page.getByRole("button", { name: "表示中をすべて選択", exact: true }).click();
    await page.getByRole("button", { name: action === "move" ? "カテゴリ移動" : "メモ削除", exact: true }).click();
    await page.evaluate(() => { const original = Storage.prototype.setItem; Storage.prototype.setItem = function (key, value) { if (key === "career-base-memos") throw new DOMException("Full", "QuotaExceededError"); return original.call(this, key, value); }; });
    await page.getByRole("button", { name: action === "move" ? "移動する" : "メモを削除する", exact: true }).click();
    await expect(page.getByRole("dialog").getByRole("alert")).toContainText("保存できませんでした");
    expect(await saved(page)).toEqual(notes);
    await page.getByRole("button", { name: "キャンセル", exact: true }).click();
    await expect(page.getByRole("checkbox", { checked: true })).toHaveCount(3);
  });
}

test("keyboard selection, category clearing, select all and deselect fit on mobile", async ({ page }) => {
  await seed(page); await page.setViewportSize({ width: 320, height: 812 });
  await page.getByRole("button", { name: "選択", exact: true }).click();
  const checkbox = page.getByRole("checkbox", { name: "対象Aを選択", exact: true });
  await checkbox.focus(); await checkbox.press("Space");
  await expect(checkbox).toBeChecked();
  await page.getByRole("combobox", { name: "カテゴリで絞り込み", exact: true }).selectOption("研究");
  await expect(page.getByRole("checkbox", { checked: true })).toHaveCount(0);
  await page.getByRole("button", { name: "表示中をすべて選択", exact: true }).click();
  await expect(page.getByRole("checkbox", { checked: true })).toHaveCount(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  if (process.env.CAPTURE_MEMO_UI) await page.screenshot({ path: "work/memo-selection-mobile.png", fullPage: true });
  await page.getByRole("button", { name: "選択をすべて解除", exact: true }).click();
  await expect(page.getByRole("button", { name: "カテゴリ移動", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "完了", exact: true }).click();
  await expect(page.locator(".reorder-handle")).toHaveCount(2);
});

test("storage restore closes the bulk dialog and discards the old selection", async ({ page }) => {
  await seed(page);
  await page.getByRole("button", { name: "選択", exact: true }).click();
  await page.getByRole("button", { name: "表示中をすべて選択", exact: true }).click();
  await page.getByRole("button", { name: "メモ削除", exact: true }).click();
  await page.evaluate(() => { localStorage.setItem("career-base-memos", "[]"); window.dispatchEvent(new Event("career-base-storage-restored")); });
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("checkbox")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "選択", exact: true })).toHaveAttribute("aria-pressed", "false");
  expect(await saved(page)).toEqual([]);
});
