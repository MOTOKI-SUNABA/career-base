import { expect, test, type Page } from "@playwright/test";

const stamp = "2026-01-01T00:00:00.000Z";
const legacyCompanies = ["青葉テック", "みなと電機", "そらデザイン"].map((name, index) => ({ id: String(index), name, selectionStatus: index === 1 ? "検討中" : "面接", interestLevel: "高", companyResearch: "元の企業研究メモ", createdAt: stamp, updatedAt: stamp }));

async function seed(page: Page) {
  await page.goto("/career");
  await page.evaluate((companies) => { localStorage.clear(); localStorage.setItem("career-base-companies", JSON.stringify(companies)); }, legacyCompanies);
  await page.reload();
  await expect(page.locator(".company-list-row")).toHaveCount(3);
}

async function workspace(page: Page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem("career-base-companies") || "{}"));
}

async function createList(page: Page, name: string) {
  await page.getByRole("button", { name: "リスト", exact: true }).click();
  await page.getByRole("textbox", { name: "リスト名", exact: true }).fill(name);
  await page.getByRole("button", { name: "作成する", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}

async function chooseList(page: Page, name: string) {
  await page.locator(".career-list-link").filter({ hasText: name }).click();
}

test("empty lists persist; minimal company entry defaults to the active list", async ({ page }) => {
  await seed(page); await createList(page, "エントリー予定");
  await page.reload();
  await expect(page.getByRole("button", { name: "エントリー予定の設定", exact: true })).toBeVisible();
  await chooseList(page, "エントリー予定");
  await page.getByRole("button", { name: "＋ 追加", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "企業名 *", exact: true })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "所属リスト", exact: true })).toHaveValue((await workspace(page)).lists[0].id);
  await expect(page.getByRole("combobox", { name: "業界", exact: true })).toBeHidden();
  await expect(page.getByRole("combobox", { name: "選考状況", exact: true })).toBeHidden();
  await page.getByRole("textbox", { name: "企業名 *", exact: true }).fill("企業名だけで登録");
  await page.getByRole("button", { name: "登録する", exact: true }).click();
  await expect(page.locator(".company-list-name")).toHaveText(["企業名だけで登録"]);
  const saved = await workspace(page);
  expect(saved.companies).toHaveLength(4);
  expect(saved.companies[0]).toMatchObject({ name: "企業名だけで登録", listId: saved.lists[0].id, selectionStatus: "検討中" });
  expect(saved.companies.find((company: { id: string }) => company.id === "0")).toMatchObject(legacyCompanies[0]);
});

test("selection replaces drag handles; bulk move preserves statuses and clears hidden selections", async ({ page }) => {
  await seed(page); await createList(page, "面接準備"); await chooseList(page, "すべて");
  await page.getByRole("button", { name: "選択", exact: true }).click();
  await expect(page.locator(".reorder-handle")).toHaveCount(0);
  await page.getByRole("checkbox", { name: "みなと電機を選択", exact: true }).check();
  await page.getByRole("textbox", { name: "企業名を検索", exact: true }).fill("青葉");
  await expect(page.getByRole("button", { name: "リスト移動", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "表示中をすべて選択", exact: true }).click();
  await page.getByRole("button", { name: "リスト移動", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("青葉テック");
  await expect(dialog).not.toContainText("みなと電機");
  const listId = (await workspace(page)).lists[0].id;
  await page.getByRole("combobox", { name: "移動先", exact: true }).selectOption(listId);
  await page.getByRole("button", { name: "移動する", exact: true }).click();
  const saved = await workspace(page);
  expect(saved.companies[0]).toMatchObject({ ...legacyCompanies[0], listId, updatedAt: expect.any(String) });
  expect(saved.companies[1].listId).toBeUndefined();
  await page.getByRole("textbox", { name: "企業名を検索", exact: true }).fill("");
  await chooseList(page, "面接準備");
  await expect(page.locator(".company-list-name")).toHaveText(["青葉テック"]);
  if (process.env.CAPTURE_CAREER_UI) await page.screenshot({ path: "work/company-lists-desktop.png", fullPage: true });
  await page.reload(); await chooseList(page, "面接準備");
  await expect(page.locator(".company-list-name")).toHaveText(["青葉テック"]);
});

test("bulk deletion confirms targets and supports cancellation", async ({ page }) => {
  await seed(page);
  await page.getByRole("button", { name: "選択", exact: true }).click();
  await page.getByRole("checkbox", { name: "青葉テックを選択", exact: true }).check();
  await page.getByRole("checkbox", { name: "そらデザインを選択", exact: true }).check();
  await page.getByRole("button", { name: "企業削除", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toHaveAccessibleName("2社を削除しますか？");
  await expect(dialog).toContainText("青葉テック"); await expect(dialog).not.toContainText("みなと電機");
  await page.getByRole("button", { name: "キャンセル", exact: true }).click();
  await expect(page.getByRole("checkbox", { checked: true })).toHaveCount(2);
  await page.getByRole("button", { name: "企業削除", exact: true }).click();
  await page.getByRole("button", { name: "企業を削除する", exact: true }).click();
  await expect(page.locator(".company-list-name")).toHaveText(["みなと電機"]);
  expect((await workspace(page)).companies.map((company: { id: string }) => company.id)).toEqual(["1"]);
});

test("list rename preserves membership; list deletion returns companies to unfiled atomically", async ({ page }) => {
  await seed(page); await createList(page, "元のリスト"); await chooseList(page, "すべて");
  await page.getByRole("button", { name: "選択", exact: true }).click();
  await page.getByRole("button", { name: "表示中をすべて選択", exact: true }).click();
  await page.getByRole("button", { name: "リスト移動", exact: true }).click();
  await page.getByRole("button", { name: "移動する", exact: true }).click();
  const id = (await workspace(page)).lists[0].id;
  await page.getByRole("button", { name: "元のリストの設定", exact: true }).click();
  await page.getByRole("textbox", { name: "リスト名", exact: true }).fill("変更後のリスト");
  await page.getByRole("button", { name: "変更を保存", exact: true }).click();
  expect((await workspace(page)).companies.every((company: { listId: string }) => company.listId === id)).toBe(true);
  await page.getByRole("button", { name: "変更後のリストの設定", exact: true }).click();
  await page.getByRole("button", { name: "このリストを削除", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("3社は未分類に戻ります");
  await page.getByRole("button", { name: "リストを削除する", exact: true }).click();
  const saved = await workspace(page);
  expect(saved.lists).toEqual([]); expect(saved.companies).toHaveLength(3);
  expect(saved.companies.every((company: { listId?: string }) => !company.listId)).toBe(true);
  await expect(page.locator(".company-list-name")).toHaveCount(3);
});

test("storage failure leaves both the list and memberships intact", async ({ page }) => {
  await seed(page); await createList(page, "失敗時も残すリスト");
  const before = await workspace(page);
  await page.evaluate(() => { const original = Storage.prototype.setItem; Storage.prototype.setItem = function (key, value) { if (key === "career-base-companies") throw new DOMException("Full", "QuotaExceededError"); return original.call(this, key, value); }; });
  await page.getByRole("button", { name: "失敗時も残すリストの設定", exact: true }).click();
  await page.getByRole("button", { name: "このリストを削除", exact: true }).click();
  await page.getByRole("button", { name: "リストを削除する", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText("保存できませんでした");
  expect(await workspace(page)).toEqual(before);
});

test("duplicate list names are rejected and mobile list switching and selection fit", async ({ page }) => {
  await seed(page); await createList(page, "エントリー予定");
  await page.getByRole("button", { name: "リスト", exact: true }).click();
  await page.getByRole("textbox", { name: "リスト名", exact: true }).fill("エントリー予定");
  await page.getByRole("button", { name: "作成する", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();
  await page.getByRole("button", { name: "キャンセル", exact: true }).click();
  await page.setViewportSize({ width: 320, height: 812 });
  await page.getByRole("combobox", { name: "表示リスト", exact: true }).selectOption("__all");
  await page.getByRole("button", { name: "選択", exact: true }).click();
  await page.getByRole("button", { name: "表示中をすべて選択", exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  if (process.env.CAPTURE_CAREER_UI) await page.screenshot({ path: "work/company-lists-mobile.png", fullPage: true });
  await page.getByRole("button", { name: "リスト移動", exact: true }).click();
  await page.getByRole("button", { name: "移動する", exact: true }).click();
  await page.getByRole("combobox", { name: "表示リスト", exact: true }).selectOption((await workspace(page)).lists[0].id);
  await expect(page.locator(".company-list-name")).toHaveCount(3);
});

test("backup exports and restores empty lists and membership, and accepts legacy backups", async ({ page }) => {
  await seed(page); await createList(page, "空のリスト");
  await page.getByRole("link", { name: "設定を開く", exact: true }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "書き出す", exact: true }).click();
  const stream = await (await downloadPromise).createReadStream(); const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  const backup = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  expect(backup.data.companyLists[0].name).toBe("空のリスト"); expect(backup.data.companies).toHaveLength(3);
  await page.evaluate(() => localStorage.setItem("career-base-companies", "[]"));
  page.once("dialog", (dialog) => dialog.accept());
  await page.locator("#backup-file").setInputFiles({ name: "backup.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(backup)) });
  expect((await workspace(page)).lists[0].name).toBe("空のリスト");
  delete backup.data.companyLists;
  page.once("dialog", (dialog) => dialog.accept());
  await page.locator("#backup-file").setInputFiles({ name: "legacy.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(backup)) });
  expect((await workspace(page)).lists).toEqual([]); expect((await workspace(page)).companies).toHaveLength(3);
});

test("cloud accepts legacy companies and roundtrips the list catalog in the existing JSONB column", async ({ page }) => {
  await page.goto("/settings");
  test.skip(await page.getByText("Supabaseの接続情報を設定すると、スマートフォンとパソコンで同じデータを使えます。", { exact: true }).isVisible(), "Cloud configuration is not available in this build.");
  let remoteCompanies: unknown = legacyCompanies;
  let uploaded = false;
  let extraColumnSent = false;
  await page.route("**/rest/v1/career_base_data**", async (route) => {
    if (route.request().method() === "POST") {
      const body = route.request().postDataJSON();
      remoteCompanies = body.companies; uploaded = true; extraColumnSent = "companyLists" in body;
      await route.fulfill({ status: 201, contentType: "application/json", body: "[]" });
    } else {
      await route.fulfill({ contentType: "application/json", body: JSON.stringify([{ user_id: "test-user", events: [], todos: [], memos: [], companies: remoteCompanies, updated_at: stamp }]) });
    }
  });
  await page.route("**/auth/v1/logout**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
  await page.addInitScript(() => {
    if (sessionStorage.getItem("cloud-fixture-initialized")) return;
    sessionStorage.setItem("cloud-fixture-initialized", "true");
    localStorage.clear();
    localStorage.setItem("career-base-cloud-session", JSON.stringify({ access_token: "test-token", refresh_token: "test-refresh", expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: "test-user", email: "test@example.invalid" } }));
  });
  await page.goto("/career");
  await expect(page.locator(".company-list-row")).toHaveCount(3);
  expect((await workspace(page)).lists).toEqual([]);
  await createList(page, "同期したリスト");
  await expect.poll(() => uploaded).toBe(true);
  await expect.poll(() => page.evaluate(() => localStorage.getItem("career-base-cloud-dirty"))).toBeNull();
  expect(extraColumnSent).toBe(false);
  expect(remoteCompanies).toMatchObject({ version: 1, companies: legacyCompanies, lists: [{ name: "同期したリスト" }] });
  await page.evaluate(() => localStorage.setItem("career-base-companies", "[]"));
  await page.reload();
  await expect(page.getByRole("button", { name: "同期したリストの設定", exact: true })).toBeVisible();
  expect((await workspace(page)).companies).toHaveLength(3);
  await page.getByRole("link", { name: "設定を開く", exact: true }).click();
  await page.getByRole("button", { name: "ログアウト", exact: true }).click();
  await expect.poll(() => page.evaluate(() => localStorage.getItem("career-base-companies"))).toBeNull();
});
