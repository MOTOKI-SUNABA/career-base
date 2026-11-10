import { expect, test } from "@playwright/test";

test.use({ timezoneId: "Asia/Tokyo" });

for (const width of [390, 1280]) {
  test(`holiday names are red and selected date marks stay centered and separated (${width}px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.clock.setFixedTime(new Date("2026-11-11T03:00:00Z"));
    await page.goto("/calendar");
    await page.evaluate(() => {
      const stamp = "2026-11-01T00:00:00Z";
      localStorage.clear();
      localStorage.setItem("career-base-events", JSON.stringify(["就活", "研究"].map((category, index) => ({ id: String(index), title: "祝日の予定", date: "2026-11-23", category, createdAt: stamp, updatedAt: stamp }))));
    });
    await page.reload();
    await expect(page.getByRole("button", { name: "2026-11-03 文化の日", exact: true })).toBeVisible();
    const holiday = page.getByRole("button", { name: "2026-11-23 勤労感謝の日 予定2件", exact: true });
    await holiday.click();
    await expect(page.locator(".agenda-holiday")).toHaveText("勤労感謝の日");
    expect(await page.locator(".agenda-holiday").evaluate((label) => getComputedStyle(label).color)).toBe("rgb(184, 67, 67)");
    const geometry = await holiday.evaluate((button) => {
      const number = button.querySelector(".calendar-day-number")!;
      const dots = button.querySelector(".calendar-event-dots")!;
      const circle = number.getBoundingClientRect();
      const text = document.createRange(); text.selectNodeContents(number);
      const glyph = text.getBoundingClientRect();
      return { color: getComputedStyle(number).color, background: getComputedStyle(dots).backgroundColor, centeredX: Math.abs(glyph.x + glyph.width / 2 - circle.x - circle.width / 2), centeredY: Math.abs(glyph.y + glyph.height / 2 - circle.y - circle.height / 2), separated: circle.bottom <= dots.getBoundingClientRect().top };
    });
    expect(geometry.color).toBe("rgb(184, 67, 67)");
    await expect(page.locator(".calendar-holiday-name")).toHaveCount(0);
    expect(geometry.background).toBe("rgba(0, 0, 0, 0)");
    expect(geometry.centeredX).toBeLessThan(2);
    expect(geometry.centeredY).toBeLessThan(3);
    expect(geometry.separated).toBe(true);
    const selectedStyle = await holiday.locator(".calendar-day-number").evaluate((number) => ({ fontFamily: getComputedStyle(number).fontFamily, lineHeight: getComputedStyle(number).lineHeight, width: number.clientWidth, height: number.clientHeight }));
    await page.getByRole("button", { name: "今日", exact: true }).click();
    const todayStyle = await page.locator(".calendar-grid button.today .calendar-day-number").evaluate((number) => ({ fontFamily: getComputedStyle(number).fontFamily, lineHeight: getComputedStyle(number).lineHeight, width: number.clientWidth, height: number.clientHeight }));
    expect(selectedStyle).toEqual(todayStyle);
    for (let i = 0; i < 4; i++) await page.getByRole("button", { name: "翌月", exact: true }).click();
    await expect(page.getByRole("button", { name: "2027-03-22 休日", exact: true })).toBeVisible();
  });

  test(`calendar marks event counts and categories with matching colors (${width}px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.clock.setFixedTime(new Date("2026-11-11T03:00:00Z"));
    await page.goto("/calendar");
    await page.evaluate(() => {
      const stamp = "2026-11-11T00:00:00Z";
      const categories = ["大学", "研究", "就活", "アルバイト", "プライベート"];
      localStorage.clear();
      localStorage.setItem("career-base-events", JSON.stringify([1, 2, 5].flatMap((count, day) => Array.from({ length: count }, (_, index) => ({ id: `${day}-${index}`, title: `予定${index}`, category: categories[index], date: `2026-11-${11 + day}`, startTime: `1${index}:00`, createdAt: stamp, updatedAt: stamp })))));
    });
    await page.reload();
    const single = page.getByRole("button", { name: "2026-11-11 予定1件", exact: true });
    const double = page.getByRole("button", { name: "2026-11-12 予定2件", exact: true });
    const many = page.getByRole("button", { name: "2026-11-13 予定5件", exact: true });
    await expect(single.locator("i")).toHaveCount(1);
    await expect(double.locator("i")).toHaveCount(2);
    await expect(many.locator("i")).toHaveCount(3);
    await expect(many.locator("small")).toHaveText("+2");
    await double.click();
    const dotColors = await double.locator("i").evaluateAll((items) => items.map((item) => getComputedStyle(item).backgroundColor));
    const lineColors = await page.locator(".agenda-accent").evaluateAll((items) => items.map((item) => getComputedStyle(item).backgroundColor));
    expect(dotColors).toEqual(lineColors);
    expect(new Set(dotColors).size).toBe(2);
    expect(await page.locator(".weekdays span").first().evaluate((item) => getComputedStyle(item).color)).toBe("rgb(184, 67, 67)");
    expect(await page.locator(".weekdays span").last().evaluate((item) => getComputedStyle(item).color)).toBe("rgb(36, 95, 157)");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });

  test(`minimal layout keeps branding in settings and equal memo rows (${width}px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/memos");
    await page.evaluate(() => {
      const stamp = "2026-11-11T00:00:00.000Z";
      localStorage.clear();
      localStorage.setItem("career-base-memos", JSON.stringify([
        { id: "tagged", title: "タグあり", content: "本文", tags: ["面接"], category: "通常メモ", createdAt: stamp, updatedAt: stamp },
        { id: "plain", title: "タグなし", content: "本文", tags: [], category: "通常メモ", createdAt: stamp, updatedAt: stamp },
      ]));
    });
    await page.reload();
    await expect(page.locator(".memo-list-item")).toHaveCount(2);
    const heights = await page.locator(".memo-list-item").evaluateAll((rows) => rows.map((row) => row.getBoundingClientRect().height));
    expect(heights[0]).toBe(heights[1]);
    expect(heights[0]).toBeGreaterThanOrEqual(64);
    for (const route of ["memos", "career", "calendar", "todos"]) {
      await page.goto(`/${route}`);
      await expect(page.locator(".brand-header")).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    await page.goto("/settings");
    await expect(page.locator(".brand-header")).toContainText("Career Base");
    await expect(page.locator(".brand-icon")).toBeVisible();
  });

  test(`compact calendar preserves date navigation, event editing and deletion (${width}px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.clock.setFixedTime(new Date("2026-11-11T03:00:00Z"));
    await page.goto("/calendar");
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem("career-base-events", JSON.stringify([{ id: "event", title: "企業説明会", date: "2026-11-11", startTime: "09:30", endTime: "10:00", category: "就活", description: "オンライン", createdAt: "2026-11-01T00:00:00Z", updatedAt: "2026-11-01T00:00:00Z" }]));
    });
    await page.reload();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("2026年11月");
    await expect(page.locator(".weekdays span").first()).toHaveText("日");
    await expect(page.locator(".calendar-grid button")).toHaveCount(35);
    await expect(page.locator(".agenda-row")).toHaveCount(1);
    await expect(page.locator(".agenda-row")).toContainText("09:30");
    await page.getByRole("button", { name: "翌月", exact: true }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("2026年12月");
    await page.getByRole("button", { name: "今日", exact: true }).click();
    await page.getByRole("button", { name: "企業説明会を編集", exact: true }).click();
    await page.getByLabel("予定名 *", { exact: true }).fill("一次面接");
    await page.getByRole("button", { name: "変更を保存", exact: true }).click();
    await expect(page.locator(".agenda-row")).toContainText("一次面接");
    await page.reload();
    await page.getByRole("button", { name: "一次面接を編集", exact: true }).click();
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("dialog").getByRole("button", { name: "削除", exact: true }).click();
    await expect(page.locator(".agenda-row")).toHaveCount(0);
    await expect(page.getByText("予定はありません", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "予定を追加", exact: true }).click();
    await page.getByLabel("予定名 *", { exact: true }).fill("研究ミーティング");
    await page.getByRole("button", { name: "登録する", exact: true }).click();
    await expect(page.locator(".agenda-row")).toContainText("研究ミーティング");
  });
}
