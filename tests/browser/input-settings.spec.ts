import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
async function settings(page: Page) {
  await page.getByRole("button", { name: "설정", exact: true }).click();
  return page.getByRole("dialog", { name: "Input & Controls" });
}
async function choose(page: Page, id: string) {
  const dialog = await settings(page);
  await dialog.getByLabel("Control Preset").selectOption(id);
  await dialog.getByRole("button", { name: "닫기", exact: true }).click();
}
async function part(page: Page) {
  await page
    .locator(".library")
    .getByRole("button", { name: "AND", exact: true })
    .click();
  const c = (await page.locator("main svg").boundingBox())!;
  await page.mouse.click(c.x + 200, c.y + 200);
}
test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("a visible settings modal owns commands even if canvas receives focus", async ({
  page,
}) => {
  await part(page);
  await settings(page);
  await page.locator("main svg").focus();
  await page.keyboard.press("r");
  await page.keyboard.press("Control+z");
  await expect(page.locator("main [data-component]")).toHaveAttribute(
    "transform",
    "translate(200 200) rotate(0)",
  );
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("dialog", { name: "Input & Controls" }),
  ).toHaveCount(0);
});

test("native RMB click opens modal on empty canvas, Escape closes it; MMB pans", async ({
  page,
}) => {
  await part(page);
  const c = (await page.locator("main svg").boundingBox())!;
  await page.mouse.click(c.x + 500, c.y + 400, { button: "right" });
  await expect(page.getByRole("dialog", { name: "도면 메뉴" })).toBeVisible();
  await page.keyboard.press("r");
  await expect(page.locator("main [data-component]")).toHaveAttribute(
    "transform",
    "translate(200 200) rotate(0)",
  );
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "도면 메뉴" })).toHaveCount(0);
  await page.mouse.move(c.x + 500, c.y + 400);
  await page.mouse.down({ button: "middle" });
  await page.mouse.move(c.x + 560, c.y + 430, { steps: 5 });
  await page.mouse.up({ button: "middle" });
  await expect(page.locator("main svg > g").first()).toHaveAttribute(
    "transform",
    "translate(60 30) scale(1)",
  );
});

test("KiCad has safe G, unmapped M, and survives reload; Delete uses the shared command", async ({
  page,
}) => {
  await part(page);
  await choose(page, "kicad-9");
  await page.keyboard.press("m");
  await expect(page.locator("main svg")).toHaveAttribute(
    "data-operation",
    "NONE",
  );
  await page.keyboard.press("g");
  await expect(page.locator("main svg")).toHaveAttribute(
    "data-operation",
    "MOVE",
  );
  await page.keyboard.press("Escape");
  await page.keyboard.press("Delete");
  await expect(page.locator("main [data-component]")).toHaveCount(0);
  await page.keyboard.press('Control+z');
  await expect(page.locator("main [data-component]")).toHaveCount(1);
  await page.reload();
  const dialog = await settings(page);
  await expect(dialog.getByLabel("Control Preset")).toHaveValue("kicad-9");
  await expect(
    dialog.getByRole("heading", { name: "Unavailable Circlith commands" }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("heading", {
      name: "Unsupported / unmapped target actions",
    }),
  ).toBeVisible();
});

test("Altium sequences and RMB click/drag are disambiguated and timeout/focus/IME clear pending", async ({
  page,
}) => {
  await part(page);
  await choose(page, "altium-designer-2026");
  await page.keyboard.press("p");
  await expect(page.locator("footer")).toContainText("순차 키 대기: P");
  await page.keyboard.press("w");
  await expect(page.locator("main svg")).toHaveAttribute("data-tool", "WIRE");
  await page.keyboard.press("Escape");
  await page.keyboard.press("m");
  await expect(page.locator("main svg")).toHaveAttribute(
    "data-operation",
    "NONE",
  );
  await page.keyboard.press("m");
  await expect(page.locator("main svg")).toHaveAttribute(
    "data-operation",
    "MOVE",
  );
  await page.keyboard.press("Escape");
  const c = (await page.locator("main svg").boundingBox())!;
  await page.mouse.move(c.x + 500, c.y + 400);
  await page.mouse.down({ button: "right" });
  await expect(page.getByRole("dialog", { name: "도면 메뉴" })).toHaveCount(0);
  await page.mouse.move(c.x + 580, c.y + 450, { steps: 5 });
  await page.mouse.up({ button: "right" });
  await expect(page.locator("main svg > g").first()).toHaveAttribute(
    "transform",
    "translate(80 50) scale(1)",
  );
  await expect(page.getByRole("dialog", { name: "도면 메뉴" })).toHaveCount(0);
  await page.keyboard.press("v");
  await page.keyboard.press("f");
  await expect(page.locator("main svg > g").first()).not.toHaveAttribute(
    "transform",
    "translate(80 50) scale(1)",
  );
  await page.keyboard.press("p");
  await page.keyboard.press("Escape");
  await expect(page.locator("footer")).not.toContainText("순차 키 대기:");
  await page.keyboard.press("p");
  await expect(page.locator("footer")).not.toContainText("순차 키 대기:", {
    timeout: 2000,
  });
  await page.keyboard.press("p");
  await page.getByRole("textbox", { name: "프로젝트 이름" }).focus();
  await expect(page.locator("footer")).not.toContainText("순차 키 대기:");
  await page.getByRole("textbox", { name: "프로젝트 이름" }).press("w");
  await expect(page.locator("main svg")).toHaveAttribute("data-tool", "SELECT");
  await page.locator("main svg").focus();
  await page
    .locator("main svg")
    .dispatchEvent("keydown", { code: "KeyP", key: "p", isComposing: true });
  await expect(page.locator("footer")).not.toContainText("순차 키 대기:");
});

test("binding edit/reset and hard conflict rejection preserve immutable preset; JSON export/import round trip", async ({
  page,
}) => {
  const dialog = await settings(page),
    row = dialog.locator("tbody tr").filter({
      has: page
        .locator("td:first-child")
        .filter({ hasText: /^component.moveSafe$/ }),
    });
  await row.getByRole("button", { name: "수정", exact: true }).click();
  const edit = dialog.getByLabel("Binding JSON");
  const binding = JSON.parse(await edit.inputValue());
  binding.input = { type: "key", key: "G" };
  await edit.fill(JSON.stringify(binding));
  await dialog
    .getByRole("button", { name: "바인딩 적용", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toContainText("충돌");
  binding.input = { type: "key", key: "J" };
  await edit.fill(JSON.stringify(binding));
  await dialog
    .getByRole("button", { name: "바인딩 적용", exact: true })
    .click();
  await expect(
    dialog.getByRole("heading", {
      name: "Circlith Modern (Modified)",
      exact: true,
    }),
  ).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "사용자 JSON 내보내기" }).click();
  const download = await downloadPromise;
  const json = await readFile((await download.path())!, "utf8");
  expect(JSON.parse(json).presetId).toBe("circlith-modern");
  await dialog.getByRole("button", { name: "프리셋 전체 초기화" }).click();
  await expect(
    dialog.getByRole("heading", { name: "Circlith Modern", exact: true }),
  ).toBeVisible();
  await dialog.getByLabel("Import profile JSON").setInputFiles({
    name: "profile.json",
    mimeType: "application/json",
    buffer: Buffer.from(json),
  });
  await expect(
    dialog.getByRole("heading", {
      name: "Circlith Modern (Modified)",
      exact: true,
    }),
  ).toBeVisible();
  await row.getByRole("button", { name: "개별 초기화" }).click();
  await expect(
    dialog.getByRole("heading", { name: "Circlith Modern", exact: true }),
  ).toBeVisible();
  await dialog.getByLabel("Import profile JSON").setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({ schemaVersion: "0.1" })),
  });
  await expect(dialog.getByRole("alert")).toContainText("버전");
  await expect(dialog.getByLabel("Control Preset")).toHaveValue(
    "circlith-modern",
  );
});

test("mix navigation and reverse wheel persist while leaving Altium accelerators effective", async ({
  page,
}) => {
  await choose(page, "altium-designer-2026");
  const dialog = await settings(page);
  await dialog.getByLabel("Navigation preset").selectOption("circlith-modern");
  await dialog.getByLabel("휠 확대 방향 반전").check();
  await dialog.getByRole("button", { name: "닫기", exact: true }).click();
  const c = (await page.locator("main svg").boundingBox())!;
  await page.mouse.move(c.x + 500, c.y + 300);
  await page.mouse.wheel(0, 100);
  await expect(page.locator("main svg > g").first()).toHaveAttribute(
    "transform",
    /scale\(1.1\)/,
  );
  await page.locator("main svg").focus();
  await page.keyboard.press("p");
  await page.keyboard.press("w");
  await expect(page.locator("main svg")).toHaveAttribute("data-tool", "WIRE");
  await page.reload();
  await expect(page.locator("footer")).toContainText(
    "Altium Designer 2026 (Modified)",
  );
});

test("storage corruption recovers safely and storage write failure is visible", async ({
  page,
}) => {
  await page.evaluate(() =>
    localStorage.setItem("circlith.simulation.input-profile.v1", "bad JSON"),
  );
  await page.reload();
  await expect(page.locator("footer")).toContainText("프로필 복구 실패");
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("quota", "QuotaExceededError");
    };
  });
  await choose(page, "kicad-9");
  await expect(page.locator("footer")).toContainText("프로필 저장 실패");
});
