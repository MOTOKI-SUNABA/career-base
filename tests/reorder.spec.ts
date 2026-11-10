import { expect, test, type Locator, type Page } from "@playwright/test";

const stamp = "2026-01-01T00:00:00.000Z";
const memos = [
  { id: "a", title: "対象A", category: "研究" },
  { id: "b", title: "その他B", category: "通常メモ" },
  { id: "c", title: "対象C", category: "研究" },
].map((memo) => ({ ...memo, content: `${memo.title}の本文`, tags: ["タグ", memo.category], companyId: "company", createdAt: stamp, updatedAt: stamp }));
const companies = [
  { id: "a", name: "対象A", selectionStatus: "面接" },
  { id: "b", name: "その他B", selectionStatus: "検討中" },
  { id: "c", name: "対象C", selectionStatus: "面接" },
].map((company) => ({ ...company, interestLevel: "高", companyResearch: "企業のメモ", createdAt: stamp, updatedAt: stamp }));

async function seed(page: Page) {
  await page.goto("/career");
  await page.evaluate(({ memos, companies }) => {
    localStorage.clear();
    localStorage.setItem("career-base-memos", JSON.stringify(memos));
    localStorage.setItem("career-base-companies", JSON.stringify(companies));
  }, { memos, companies });
  await page.reload();
  await expect(page.locator(".company-list-row")).toHaveCount(3);
}

async function savedIds(page: Page, key: string) {
  return page.evaluate((key) => { const data = JSON.parse(localStorage.getItem(key) || "[]"); return ((Array.isArray(data) ? data : data.companies) as { id: string }[]).map((item) => item.id); }, key);
}

async function dragRow(page: Page, from: Locator, to: Locator) {
  const start = (await from.boundingBox())!;
  const end = (await to.boundingBox())!;
  const x = start.x + start.width / 2;
  await page.mouse.move(x, start.y + start.height / 2);
  await page.mouse.down();
  await page.mouse.move(x, start.y + start.height / 2 + 10, { steps: 3 });
  await expect(page.locator(".sortable-overlay")).toBeVisible();
  await page.mouse.move(x, end.y + end.height / 2, { steps: 12 });
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await page.mouse.up();
  await expect(page.locator(".sortable-overlay")).toHaveCount(0);
}

test("mouse drags whole company rows, saves order and does not open the detail", async ({ page }) => {
  await seed(page);
  await dragRow(page, page.locator(".company-list-row").first(), page.locator(".company-list-row").last());
  await expect(page.locator(".company-list-name")).toHaveText(["その他B", "対象C", "対象A"]);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(await savedIds(page, "career-base-companies")).toEqual(["b", "c", "a"]);
  await page.reload();
  await expect(page.locator(".company-list-name")).toHaveText(["その他B", "対象C", "対象A"]);
  await page.locator(".company-list-row").first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
});

test("dragging filtered memos preserves hidden slots and the open editor", async ({ page }) => {
  await seed(page); await page.goto("/memos");
  await page.getByRole("button", { name: "対象A タグ 研究", exact: true }).click();
  await page.getByRole("textbox", { name: "メモ本文" }).fill("編集中の本文");
  await page.getByRole("combobox", { name: "タグで絞り込み" }).selectOption("研究");
  const rows = page.locator(".memo-compact-list .memo-list-item");
  await dragRow(page, rows.first(), rows.last());
  await expect(page.locator(".memo-list-title")).toHaveText(["対象C", "対象A"]);
  await expect(page.getByRole("textbox", { name: "メモ本文" })).toContainText("編集中の本文");
  expect(await savedIds(page, "career-base-memos")).toEqual(["c", "b", "a"]);
  await page.getByRole("combobox", { name: "タグで絞り込み" }).selectOption("");
  await expect(page.locator(".memo-list-title")).toHaveText(["対象C", "その他B", "対象A"]);
  await page.reload();
  await page.getByRole("button", { name: "対象A タグ 研究", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "メモ本文" })).toContainText("編集中の本文");
});

test("filtered company keyboard reorder can be cancelled and committed", async ({ page }) => {
  await seed(page);
  await page.getByRole("combobox", { name: "選考状況で絞り込み" }).selectOption("面接");
  const handle = page.getByRole("button", { name: "対象Aを並べ替え", exact: true });
  await handle.focus(); await handle.press("Space"); await handle.press("ArrowDown"); await handle.press("Escape");
  expect(await savedIds(page, "career-base-companies")).toEqual(["a", "b", "c"]);
  await handle.press("Space"); await handle.press("ArrowDown"); await handle.press("Space");
  await expect(page.locator(".company-list-name")).toHaveText(["対象C", "対象A"]);
  expect(await savedIds(page, "career-base-companies")).toEqual(["c", "b", "a"]);
});

test("failed reorder keeps the original order and records intact", async ({ page }) => {
  await seed(page);
  await page.evaluate(() => {
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "career-base-companies") throw new DOMException("Full", "QuotaExceededError");
      return setItem.call(this, key, value);
    };
  });
  await dragRow(page, page.locator(".company-list-row").first(), page.locator(".company-list-row").last());
  await expect(page.locator(".reorder-error")).toContainText("並び順を保存できませんでした");
  await expect(page.locator(".company-list-name")).toHaveText(["対象A", "その他B", "対象C"]);
  expect(await savedIds(page, "career-base-companies")).toEqual(["a", "b", "c"]);
});

test.describe("touch", () => {
  test.use({ hasTouch: true, viewport: { width: 375, height: 812 } });
  test("touch handles reorder both lists without opening an item", async ({ page, context }) => {
    await seed(page);
    const session = await context.newCDPSession(page);
    for (const { route, list, key } of [
      { route: "/career", list: ".company-list", key: "career-base-companies" },
      { route: "/memos", list: ".memo-compact-list", key: "career-base-memos" },
    ]) {
      await page.goto(route);
      const handles = page.locator(`${list} .reorder-handle`);
      await expect(handles).toHaveCount(3);
      const start = (await handles.first().boundingBox())!;
      const end = (await handles.last().boundingBox())!;
      const x = start.x + start.width / 2;
      await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y: start.y + start.height / 2 }] });
      await expect(page.locator(".sortable-overlay")).toBeVisible();
      await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: end.y + end.height / 2 }] });
      await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
      await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await expect(page.locator(".sortable-overlay")).toHaveCount(0);
      expect(await savedIds(page, key)).toEqual(["b", "c", "a"]);
      await expect(page.getByRole("dialog")).toHaveCount(0);
      if (route === "/memos") await expect(page.getByRole("textbox", { name: "メモ本文" })).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
  });
});
