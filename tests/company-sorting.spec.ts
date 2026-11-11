import { expect, test } from "@playwright/test";

const stamp = "2026-11-01T00:00:00Z";
const companies = [
  { id: "minato", name: "みなと電機", entryDeadline: undefined },
  { id: "sora", name: "そらデザイン", entryDeadline: "2026-11-12" },
  { id: "aoba", name: "青葉テック", entryDeadline: "2026-11-20" },
].map((company) => ({ ...company, selectionStatus: "検討中", interestLevel: "高", companyResearch: "企業研究", createdAt: stamp, updatedAt: stamp }));

for (const width of [390, 1280]) {
  test(`company information switches between default and deadline order without drag handles (${width}px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/career");
    await page.evaluate((companies) => { localStorage.clear(); localStorage.setItem("career-base-companies", JSON.stringify(companies)); }, companies);
    await page.reload();
    await expect(page.getByRole("heading", { name: "企業情報", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "企業情報", exact: true })).toBeVisible();
    await expect(page).toHaveTitle("企業情報 | Career Base");
    await expect(page.locator(".reorder-handle")).toHaveCount(0);
    await expect(page.locator(".company-list-name")).toHaveText(["みなと電機", "そらデザイン", "青葉テック"]);
    const sort = page.getByRole("combobox", { name: "企業の並び順", exact: true });
    await sort.selectOption("deadline");
    await expect(page.locator(".company-list-name")).toHaveText(["そらデザイン", "青葉テック", "みなと電機"]);
    await page.getByRole("combobox", { name: "青葉テックの選考状況", exact: true }).selectOption("選考中");
    await page.getByRole("combobox", { name: "選考状況で絞り込み", exact: true }).selectOption("検討中");
    await expect(page.locator(".company-list-name")).toHaveText(["そらデザイン", "みなと電機"]);
    await sort.selectOption("default");
    await expect(page.locator(".company-list-name")).toHaveText(["みなと電機", "そらデザイン"]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("career-base-companies") || "{}").companies);
    expect(stored.map((company: { id: string }) => company.id)).toEqual(companies.map((company) => company.id));
    await page.getByRole("button", { name: "そらデザイン", exact: true }).click();
    await page.getByRole("button", { name: "編集する", exact: true }).click();
    await page.getByText("その他の情報を追加", { exact: true }).click();
    await expect(page.getByLabel("企業名のよみ（任意）", { exact: true })).toHaveCount(0);
    await page.getByLabel("企業名 *", { exact: true }).fill("さくらデザイン");
    await page.getByRole("button", { name: "変更を保存", exact: true }).click();
    await page.reload();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("career-base-companies") || "{}").companies.find((company: { id: string }) => company.id === "sora").name)).toBe("さくらデザイン");
  });
}
