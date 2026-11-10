import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/memos");
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("career-base-memos", JSON.stringify([{ id: "scroll", title: "スクロール確認", content: "本文", category: "通常メモ", tags: [], createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" }]));
  });
  await page.reload();
  await page.getByRole("button", { name: "スクロール確認", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "メモ本文" })).toBeVisible();
});

for (const width of [390, 1280]) {
  test(`typing at the bottom keeps the caret above navigation (${width}px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    const body = page.getByRole("textbox", { name: "メモ本文" });
    await body.click();
    await body.press("ControlOrMeta+End");
    for (let line = 0; line < 40; line++) {
      await page.keyboard.press("Enter");
      await page.keyboard.insertText(`行 ${line}`);
    }
    await expect.poll(() => page.evaluate(() => {
      const selection = window.getSelection();
      const node = selection?.focusNode;
      const element = node?.nodeType === Node.TEXT_NODE ? node.parentElement : node as Element | null;
      const nav = document.querySelector(".bottom-nav");
      if (!element || !nav) return false;
      const caret = element.getBoundingClientRect();
      return caret.top >= 0 && caret.bottom < nav.getBoundingClientRect().top;
    })).toBe(true);
  });
}


