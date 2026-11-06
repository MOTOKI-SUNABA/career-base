import { expect, test, type Page } from "@playwright/test";

const stamp = "2026-01-01T00:00:00.000Z";
const legacyMemo = { id: "legacy", title: "既存のメモ", content: '<script>alert("test")</script>\n\n\t字下げした本文', category: "面接対策", tags: ["面接"], companyId: "company-1", createdAt: stamp, updatedAt: stamp };
const secondMemo = { ...legacyMemo, id: "second", title: "研究アイデア", content: "別のメモの本文", category: "研究", tags: ["研究"] };

async function savedNotes(page: Page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem("career-base-memos") || "[]") as Array<typeof legacyMemo & { richContent?: string }>);
}

test.beforeEach(async ({ page }) => {
  await page.goto("/memos");
  await page.evaluate((notes) => { localStorage.clear(); localStorage.setItem("career-base-memos", JSON.stringify(notes)); }, [legacyMemo, secondMemo]);
  await page.reload();
  await page.getByRole("button", { name: "既存のメモ 面接", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "メモ本文" })).toBeVisible();
});

test("legacy text stays literal and retains blank lines, tabs, category and company", async ({ page }) => {
  const body = page.getByRole("textbox", { name: "メモ本文" });
  await expect(body).toContainText('<script>alert("test")</script>');
  expect(await body.textContent()).toContain("\t字下げした本文");
  expect(await body.locator("p").count()).toBe(3);
  await page.getByRole("textbox", { name: "タイトル", exact: true }).fill("更新したメモ");
  const note = (await savedNotes(page))[0];
  expect(note.companyId).toBe("company-1");
  expect(note.createdAt).toBe(stamp);
  expect(note.category).toBe("面接対策");
  expect(note.content).toBe(legacyMemo.content);
});

test("formatting and immediate autosave survive switching and reload", async ({ page }) => {
  const body = page.getByRole("textbox", { name: "メモ本文" });
  await body.fill("装飾する本文");
  await body.press("ControlOrMeta+a");
  await page.getByRole("button", { name: "太字", exact: true }).click();
  await page.getByRole("combobox", { name: "書体", exact: true }).selectOption({ label: "明朝" });
  await page.getByRole("combobox", { name: "文字サイズ", exact: true }).selectOption("24px");
  if (process.env.CAPTURE_MEMO_UI) await page.screenshot({ path: "work/memos-desktop.png", fullPage: true });
  await expect(body.locator("strong")).toHaveText("装飾する本文");
  const notes = await savedNotes(page);
  expect(notes[0].content).toBe("装飾する本文");
  expect(notes[0].richContent).toContain("font-size: 24px");
  await page.getByRole("button", { name: "研究アイデア 研究", exact: true }).click();
  await page.getByRole("button", { name: "既存のメモ 面接", exact: true }).click();
  await expect(body.locator("strong")).toHaveText("装飾する本文");
  await page.reload();
  await page.getByRole("button", { name: "既存のメモ 面接", exact: true }).click();
  await expect(body.locator("strong")).toHaveText("装飾する本文");
  await expect(body.locator('span[style*="24px"]')).toHaveCount(1);
});

test("Tab inserts whitespace, Shift+Tab removes it, and Escape leaves the editor", async ({ page }) => {
  const body = page.getByRole("textbox", { name: "メモ本文" });
  await body.fill("本文"); await body.press("End");
  await body.press("Tab");
  expect((await savedNotes(page))[0].content).toBe("本文\t");
  await body.press("Shift+Tab");
  expect((await savedNotes(page))[0].content).toBe("本文");
  await body.press("Tab"); await body.pressSequentially("追記");
  await page.reload(); await page.getByRole("button", { name: "既存のメモ 面接", exact: true }).click();
  expect(await body.textContent()).toBe("本文\t追記");
  await body.press("Escape");
  await expect(page.getByRole("combobox", { name: "書体", exact: true })).toBeFocused();
});

test("list indentation works with keyboard and toolbar", async ({ page }) => {
  const body = page.getByRole("textbox", { name: "メモ本文" });
  await body.fill("項目1"); await body.press("End"); await body.press("Enter"); await body.pressSequentially("項目2");
  await body.press("ControlOrMeta+a"); await page.getByRole("button", { name: "箇条書き", exact: true }).click();
  await body.locator("li").nth(1).click(); await body.press("End"); await body.press("Tab");
  await expect(body.locator("ul ul")).toHaveCount(1);
  await page.getByRole("button", { name: "字下げ解除", exact: true }).click();
  await expect(body.locator("ul ul")).toHaveCount(0);
});

test("storage failure keeps the draft, blocks switching and allows retry", async ({ page }) => {
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "career-base-memos" && !sessionStorage.getItem("allow-save")) throw new DOMException("Full", "QuotaExceededError");
      return original.call(this, key, value);
    };
  });
  const title = page.getByRole("textbox", { name: "タイトル", exact: true });
  await title.fill("未保存の変更");
  await expect(page.locator(".memo-save-state")).toContainText("保存できませんでした");
  await page.getByRole("button", { name: "研究アイデア 研究", exact: true }).click();
  await expect(title).toHaveValue("未保存の変更");
  expect((await savedNotes(page))[0].title).toBe("既存のメモ");
  await page.evaluate(() => sessionStorage.setItem("allow-save", "true"));
  await page.getByRole("button", { name: "再試行", exact: true }).click();
  await expect(page.locator(".memo-save-state")).toContainText("自動保存済み");
  expect((await savedNotes(page))[0].title).toBe("未保存の変更");
});

test("mobile uses one screen at a time without horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await expect(page.getByRole("complementary", { name: "メモ一覧" })).toBeHidden();
  await expect(page.getByRole("textbox", { name: "メモ本文" })).toBeVisible();
  if (process.env.CAPTURE_MEMO_UI) await page.screenshot({ path: "work/memos-mobile.png", fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("button", { name: "一覧に戻る" }).click();
  await expect(page.getByRole("complementary", { name: "メモ一覧" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "メモ本文" })).toHaveCount(0);
  await page.getByRole("button", { name: "研究アイデア 研究", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "タイトル", exact: true })).toHaveValue("研究アイデア");
  await page.setViewportSize({ width: 320, height: 640 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("create, search, filter, focus and delete retain existing behavior", async ({ page }) => {
  await page.getByRole("button", { name: "＋ 追加", exact: true }).click();
  const title = page.getByRole("textbox", { name: "タイトル", exact: true });
  await title.fill("新しいメモ");
  await page.getByRole("textbox", { name: "メモ本文" }).fill("検索用の本文");
  await page.getByLabel("タグ", { exact: true }).fill("就活, ES, 就活");
  expect((await savedNotes(page))[0].tags).toEqual(["就活", "ES"]);
  await page.getByRole("button", { name: "一覧を閉じる" }).click();
  await expect(page.getByRole("complementary", { name: "メモ一覧" })).toBeHidden();
  await page.getByRole("button", { name: "一覧を表示" }).click();
  await page.getByRole("textbox", { name: "メモを検索", exact: true }).fill("検索用");
  await expect(page.locator(".memo-list-item")).toHaveCount(1);
  await page.getByRole("textbox", { name: "メモを検索", exact: true }).fill("");
  await page.getByRole("combobox", { name: "カテゴリで絞り込み" }).selectOption("研究");
  await expect(page.locator(".memo-list-item")).toHaveCount(1);
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "このメモを削除" }).click();
  expect((await savedNotes(page)).some((memo) => memo.title === "新しいメモ")).toBe(false);
});

test("backup roundtrip preserves rich content and unsafe links are rejected", async ({ page }) => {
  const body = page.getByRole("textbox", { name: "メモ本文" });
  await body.fill("リンクの文字"); await body.press("ControlOrMeta+a");
  await page.getByRole("button", { name: "リンクを設定" }).click();
  await page.getByRole("textbox", { name: "リンク先", exact: true }).fill("javascript:alert(1)");
  await page.getByRole("button", { name: "適用", exact: true }).click();
  await expect(page.locator(".memo-link-form [role=alert]")).toBeVisible();
  await expect(body.locator("a")).toHaveCount(0);
  await page.getByRole("textbox", { name: "リンク先", exact: true }).fill("https://example.com");
  await page.getByRole("button", { name: "適用", exact: true }).click();
  await expect(body.locator("a")).toHaveAttribute("href", "https://example.com");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "設定を開く" }).click();
  await page.getByRole("button", { name: "書き出す", exact: true }).click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  const chunks: Buffer[] = []; for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  const backup = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  expect(backup.data.memos[0].richContent).toContain("https://example.com");
  expect(backup.data.memos[0].content).toBe("リンクの文字");
  await page.evaluate(() => localStorage.setItem("career-base-memos", "[]"));
  page.once("dialog", (dialog) => dialog.accept());
  await page.locator('#backup-file').setInputFiles({ name: "backup.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(backup)) });
  await expect(page.getByRole("status")).toContainText("データを復元しました");
  await page.getByRole("link", { name: "メモ", exact: true }).click();
  await page.getByRole("button", { name: "既存のメモ 面接", exact: true }).click();
  await expect(body.locator("a")).toHaveAttribute("href", "https://example.com");
});
