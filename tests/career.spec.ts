import { expect, test } from "@playwright/test";

test.use({ timezoneId: "Asia/Tokyo" });
const stamp = "2026-01-01T00:00:00.000Z";
const company = { id: "aoba", name: "青葉テック", selectionStatus: "選考中", interestLevel: "第一志望群", industry: "IT・ソフトウェア", desiredRole: "開発職", location: "東京", companyResearch: "事業内容と質問を整理する。", startingSalary: "25万円", portalUrl: "https://example.com", esNotes: "ESのメモ", interviewNotes: "面接のメモ", entryDeadline: "2026-11-06", nextSelectionDate: "2026-11-09", createdAt: stamp, updatedAt: stamp };
const companies = [company,
  { ...company, id: "minato", name: "みなと電機", selectionStatus: "検討中", entryDeadline: "2026-11-08", nextSelectionDate: "2026-11-12" },
  { ...company, id: "past", name: "終了した企業", selectionStatus: "辞退", entryDeadline: "2026-11-06", nextSelectionDate: "2026-11-05" },
  { ...company, id: "none", name: "とても長い企業名でもスマホで横にはみ出さないことを確認する企業", selectionStatus: "合格", entryDeadline: undefined, nextSelectionDate: undefined },
];

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-11-07T03:00:00Z"));
  await page.goto("/career");
  await page.evaluate((values) => { localStorage.clear(); localStorage.setItem("career-base-companies", JSON.stringify(values)); }, companies);
  await page.reload();
  await expect(page.locator(".company-list-row")).toHaveCount(4);
});

test("compact rows show the nearest upcoming date and keep details behind a keyboard-accessible button", async ({ page }) => {
  const rows = page.locator(".company-list-row");
  await expect(rows.nth(0).locator("time")).toHaveAttribute("dateTime", "2026-11-09");
  await expect(rows.nth(0)).toContainText("次回");
  await expect(rows.nth(1).locator("time")).toHaveAttribute("dateTime", "2026-11-08");
  await expect(rows.nth(1)).toContainText("締切");
  await expect(rows.nth(2).locator("time")).toHaveAttribute("dateTime", "2026-11-06");
  await expect(rows.nth(3)).toContainText("日付なし");
  await expect(page.getByRole("button", { name: "編集する", exact: true })).toHaveCount(0);
  await expect(page.getByText("志望度 第一志望群", { exact: true })).toHaveCount(0);
  if (process.env.CAPTURE_CAREER_UI) await page.screenshot({ path: "work/career-desktop.png", fullPage: true });
  await rows.nth(0).getByRole("button").focus(); await rows.nth(0).getByRole("button").press("Enter");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("志望度 第一志望群");
  await expect(dialog).toContainText("事業内容と質問を整理する。");
  await expect(dialog.getByRole("button", { name: "この企業を削除", exact: true })).toBeVisible();
});

test("selection status changes directly in the list and details and persists", async ({ page }) => {
  await page.getByRole("combobox", { name: "青葉テックの選考状況", exact: true }).selectOption("合格");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("combobox", { name: "青葉テックの選考状況", exact: true })).toHaveValue("合格");
  await page.getByRole("button", { name: "青葉テック", exact: true }).click();
  await page.getByRole("dialog").getByRole("combobox", { name: "選考状況を変更", exact: true }).selectOption("辞退");
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("combobox", { name: "青葉テックの選考状況", exact: true })).toHaveValue("辞退");
  const saved = await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem("career-base-companies") || "{}");
    return data.companies.find((item: { id: string }) => item.id === "aoba");
  });
  expect(saved).toMatchObject({ ...company, selectionStatus: "辞退", updatedAt: expect.any(String) });
});

test("failed quick status save preserves the previous status and reports an error", async ({ page }) => {
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw new Error("full"); }; });
  const status = page.getByRole("combobox", { name: "青葉テックの選考状況", exact: true });
  await status.selectOption("合格");
  await expect(status).toHaveValue("選考中");
  await expect(page.getByRole("alert").filter({ hasText: "保存できませんでした" })).toBeVisible();
});

test("legacy selection stages map to seven statuses without losing company data", async ({ page }) => {
  const oldStatuses = ["検討中", "エントリー予定", "エントリー済み", "ES提出済み", "Webテスト", "面接", "インターン参加決定", "合格", "落選", "辞退"];
  const expected = ["検討中", "応募準備中", "選考中", "選考中", "選考中", "選考中", "イベント参加", "合格", "不合格", "辞退"];
  await page.evaluate(({ company, oldStatuses }) => localStorage.setItem("career-base-companies", JSON.stringify(oldStatuses.map((selectionStatus, index) => ({ ...company, id: `legacy-${index}`, name: `旧企業${index}`, selectionStatus })))), { company, oldStatuses });
  await page.reload();
  const filter = page.getByRole("combobox", { name: "選考状況で絞り込み", exact: true });
  await expect(filter.locator("option")).toHaveText(["すべて", "検討中", "応募準備中", "選考中", "合格", "イベント参加", "不合格", "辞退"]);
  for (let index = 0; index < expected.length; index++) {
    await expect(page.getByRole("combobox", { name: `旧企業${index}の選考状況`, exact: true })).toHaveValue(expected[index]);
  }
  await filter.selectOption("選考中");
  await expect(page.locator(".company-list-row")).toHaveCount(4);
  await page.getByRole("combobox", { name: "旧企業5の選考状況", exact: true }).selectOption("合格");
  await expect(page.locator(".company-list-row")).toHaveCount(3);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("career-base-companies") || "{}").companies);
  expect(saved[5]).toMatchObject({ ...company, id: "legacy-5", name: "旧企業5", selectionStatus: "合格", updatedAt: expect.any(String) });
  expect(saved.map((item: { selectionStatus: string }) => item.selectionStatus)).toEqual(expected.map((status, index) => index === 5 ? "合格" : status));
});

test("search, filter, edit and delete work without dropping existing company fields", async ({ page }) => {
  await page.getByRole("textbox", { name: "企業名を検索", exact: true }).fill("青葉");
  await expect(page.locator(".company-list-row")).toHaveCount(1);
  await page.getByRole("textbox", { name: "企業名を検索", exact: true }).fill("");
  await page.getByRole("combobox", { name: "選考状況で絞り込み", exact: true }).selectOption("選考中");
  await expect(page.locator(".company-list-row")).toHaveCount(1);
  await page.locator(".company-list-row").click();
  await page.getByRole("button", { name: "編集する", exact: true }).click();
  await page.getByRole("textbox", { name: "企業名 *", exact: true }).fill("青葉テック更新");
  await page.getByRole("button", { name: "変更を保存", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("career-base-companies") || "{}").companies[0]);
  expect(saved).toMatchObject({ ...company, name: "青葉テック更新", updatedAt: expect.any(String) });
  await page.locator(".company-list-row").click();
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("button", { name: "この企業を削除", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "この企業を削除", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText("該当する企業はありません", { exact: true })).toBeVisible();
  const remaining = await page.evaluate(() => JSON.parse(localStorage.getItem("career-base-companies") || "{}").companies);
  expect(remaining).toHaveLength(3);
});

test("mobile rows and company details fit at 375px and 320px", async ({ page }) => {
  for (const width of [375, 320]) {
    await page.setViewportSize({ width, height: 812 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const row = page.locator(".company-list-row").last();
    const height = await row.evaluate((element) => element.getBoundingClientRect().height);
    expect(height).toBeGreaterThanOrEqual(44);
  }
  if (process.env.CAPTURE_CAREER_UI) await page.screenshot({ path: "work/career-mobile.png", fullPage: true });
  await page.locator(".company-list-row").last().getByRole("button").click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
