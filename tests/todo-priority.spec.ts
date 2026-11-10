import { expect, test } from "@playwright/test";

const todo = { id: "priority", title: "ESを書く", priority: "中", completed: false, category: "就活", description: "企業研究を反映する", dueDate: "2026-11-20", companyId: "company", createdAt: "2026-11-01T00:00:00Z", updatedAt: "2026-11-01T00:00:00Z" };

test.beforeEach(async ({ page }) => {
  await page.goto("/todos");
  await page.evaluate((todo) => { localStorage.clear(); localStorage.setItem("career-base-todos", JSON.stringify([todo])); }, todo);
  await page.reload();
});

for (const width of [390, 1280]) {
  test(`priority changes from the list and persists without modifying other fields (${width}px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const priority = page.getByRole("combobox", { name: "ESを書くの優先度", exact: true });
    await priority.selectOption("高");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.reload();
    await expect(priority).toHaveValue("高");
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("career-base-todos") || "[]")[0])).toMatchObject({ ...todo, priority: "高", updatedAt: expect.any(String) });
    await page.getByRole("checkbox").check();
    await priority.selectOption("低");
    await expect(page.getByRole("checkbox")).toBeChecked();
    await expect(priority).toHaveValue("低");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test("failed priority save keeps the previous value and shows an error", async ({ page }) => {
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw new Error("full"); }; });
  const priority = page.getByRole("combobox", { name: "ESを書くの優先度", exact: true });
  await priority.selectOption("高");
  await expect(priority).toHaveValue("中");
  await expect(page.getByRole("alert").filter({ hasText: "優先度を保存できませんでした" })).toBeVisible();
});
