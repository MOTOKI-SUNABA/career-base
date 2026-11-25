import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const png = readFileSync("src/app/icon.png");
const notes = ["画像メモ", "別のメモ"].map((title, index) => ({ id: String(index), title, content: "画像の前の文章", tags: [], category: "通常メモ", createdAt: "2026-11-01T00:00:00Z", updatedAt: "2026-11-01T00:00:00Z" }));

test.beforeEach(async ({ page }) => {
  await page.goto("/memos");
  await page.evaluate((notes) => { localStorage.clear(); localStorage.setItem("career-base-memos", JSON.stringify(notes)); }, notes);
  await page.reload();
  await page.getByRole("button", { name: "画像メモ", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "メモ本文" })).toBeVisible();
});

for (const width of [390, 1280]) {
  test(`images from file survive reload, resize, delete and undo (${width}px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.getByLabel("メモに追加する画像", { exact: true }).setInputFiles({ name: "icon.png", mimeType: "image/png", buffer: png });
    const image = page.locator(".memo-rich-text img");
    await expect(image).toBeVisible();
    await expect(image).toHaveAttribute("src", /^data:image\/webp;base64,/);
    await page.reload();
    await page.getByRole("button", { name: "画像メモ", exact: true }).click();
    await expect(image).toBeVisible();
    await image.click();
    await page.getByRole("combobox", { name: "画像の表示サイズ", exact: true }).selectOption("160");
    await expect(image).toHaveAttribute("width", "160");
    await page.getByRole("button", { name: "選択した画像を削除", exact: true }).click();
    await expect(image).toHaveCount(0);
    await page.getByRole("button", { name: "元に戻す", exact: true }).click();
    await expect(image).toBeVisible();
    await expect(page.getByRole("textbox", { name: "メモ本文" })).toContainText("画像の前の文章");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

for (const action of ["paste", "drop"] as const) {
  test(`${action} inserts clipboard or dropped images`, async ({ page }) => {
    await page.getByRole("textbox", { name: "メモ本文" }).click();
    await page.locator(".memo-rich-text").evaluate((element, { base64, action }) => {
      const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
      const transfer = new DataTransfer();
      transfer.items.add(new File([bytes], "pasted.png", { type: "image/png" }));
      if (action === "paste") element.dispatchEvent(new ClipboardEvent("paste", { clipboardData: transfer, bubbles: true, cancelable: true }));
      else {
        const rect = element.getBoundingClientRect();
        element.dispatchEvent(new DragEvent("drop", { dataTransfer: transfer, clientX: rect.left + 10, clientY: rect.top + 10, bubbles: true, cancelable: true }));
      }
    }, { base64: png.toString("base64"), action });
    await expect(page.locator(".memo-rich-text img")).toBeVisible();
  });
}

test("unsupported images show an error without replacing the note", async ({ page }) => {
  await page.getByLabel("メモに追加する画像", { exact: true }).setInputFiles({ name: "drawing.svg", mimeType: "image/svg+xml", buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>') });
  await expect(page.locator(".memo-image-error")).toContainText("PNG・JPEG・WebP・GIF");
  await expect(page.locator(".memo-rich-text img")).toHaveCount(0);
  await expect(page.getByRole("textbox", { name: "メモ本文" })).toContainText("画像の前の文章");
});

test("embedded images roundtrip through JSON backup", async ({ page }) => {
  await page.getByLabel("メモに追加する画像", { exact: true }).setInputFiles({ name: "icon.png", mimeType: "image/png", buffer: png });
  await expect(page.locator(".memo-rich-text img")).toBeVisible();
  await page.getByRole("link", { name: "設定を開く", exact: true }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "書き出す", exact: true }).click();
  const stream = await (await download).createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  const backup = Buffer.concat(chunks);
  expect(JSON.parse(backup.toString("utf8")).data.memos[0].richContent).toContain("data:image/webp;base64,");
  await page.evaluate(() => localStorage.setItem("career-base-memos", "[]"));
  page.once("dialog", (dialog) => dialog.accept());
  await page.locator("#backup-file").setInputFiles({ name: "images.json", mimeType: "application/json", buffer: backup });
  await expect(page.getByRole("status")).toContainText("復元");
  await page.goto("/memos");
  await page.getByRole("button", { name: "画像メモ", exact: true }).click();
  await expect(page.locator(".memo-rich-text img")).toBeVisible();
});
