import { test, expect, type Page } from "@playwright/test";

type ContextRecord = { prevented: boolean; target: string };
async function records(page: Page): Promise<ContextRecord[]> {
  return page.evaluate(() => (window as any).__contextRecords);
}
async function clear(page: Page) {
  await page.evaluate(() => { (window as any).__contextRecords = []; });
}
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    (window as any).__contextRecords = [];
    (window as any).__contextBubbles = 0;
    document.addEventListener("contextmenu", (event) => {
      // Read after propagation: the contextmenu target may be the overlay mounted on pointerup.
      setTimeout(() => (window as any).__contextRecords.push({ prevented: event.defaultPrevented, target: (event.target as Element).tagName }), 0);
    }, true);
    document.addEventListener("contextmenu", () => { (window as any).__contextBubbles++; });
  });
  await page.goto(process.env.CIRCLITH_BASE_PATH ?? "/");
});

test("a real right click cancels the browser menu even when pointerup opens the app overlay", async ({ page }) => {
  const svg = page.locator("main svg"), box = (await svg.boundingBox())!;
  await page.mouse.click(box.x + 450, box.y + 350, { button: "right" });
  await expect(page.getByRole("dialog", { name: "도면 메뉴" })).toHaveCount(1);
  await expect.poll(async () => (await records(page)).length).toBeGreaterThan(0);
  expect((await records(page)).every((r) => r.prevented)).toBe(true);
  expect(await page.evaluate(() => (window as any).__contextBubbles)).toBe(0);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "도면 메뉴" })).toHaveCount(0);
  await expect(page.locator("header")).toHaveAttribute("data-edit-count", "0");
});

test("repeated right clicks over menu, settings, and app chrome never open a native menu", async ({ page }) => {
  await page.locator("main svg").click({ button: "right", position: { x: 450, y: 350 } });
  const menu = page.getByRole("dialog", { name: "도면 메뉴" });
  await menu.getByRole("button", { name: "Undo", exact: true }).click({ button: "right" });
  await page.locator(".overlay").click({ button: "right", position: { x: 20, y: 20 } });
  await expect(menu).toHaveCount(1); await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "설정", exact: true }).click();
  await page.getByRole("group", { name: "배선 설정", exact: true }).click({ button: "right", position: { x: 600, y: 20 } });
  await page.keyboard.press("Escape");
  await page.locator("header strong").click({ button: "right" });
  await expect.poll(async () => (await records(page)).length).toBe(5);
  expect((await records(page)).every((r) => r.prevented)).toBe(true);
  await expect(page.locator("header")).toHaveAttribute("data-edit-count", "0");
});

test("text fields retain native editing menus and compatible right-drag pan remains isolated", async ({ page }) => {
  const input = page.getByRole("textbox", { name: "프로젝트 이름" });
  await input.dispatchEvent("contextmenu", { bubbles: true, cancelable: true, button: 2 });
  await expect.poll(async () => (await records(page)).length).toBe(1);
  expect((await records(page))[0].prevented).toBe(false);
  expect(await page.evaluate(() => (window as any).__contextBubbles)).toBe(1);
  await page.getByRole("button", { name: "설정", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Input & Controls" });
  await dialog.getByLabel("Control Preset").selectOption("altium-designer-2026");
  await dialog.getByRole("button", { name: "닫기", exact: true }).click();
  await clear(page);
  const box = (await page.locator("main svg").boundingBox())!;
  await page.mouse.move(box.x + 450, box.y + 350); await page.mouse.down({ button: "right" });
  await page.mouse.move(box.x + 510, box.y + 380, { steps: 5 }); await page.mouse.up({ button: "right" });
  await expect(page.getByRole("dialog", { name: "도면 메뉴" })).toHaveCount(0);
  await expect(page.locator("main svg > g").first()).toHaveAttribute("transform", "translate(60 30) scale(1)");
  await expect.poll(async () => (await records(page)).length).toBeGreaterThan(0);
  expect((await records(page)).every((r) => r.prevented)).toBe(true);
  await expect(page.locator("header")).toHaveAttribute("data-edit-count", "0");
});

test("opening and dismissing the app menu keeps a stable wire draft and history intact", async ({ page }) => {
  await page.locator(".library").getByRole("button", { name: "Input", exact: true }).click();
  const svg = page.locator("main svg"), box = (await svg.boundingBox())!;
  await page.mouse.click(box.x + 100, box.y + 100);
  await page.locator('main [data-layer="pins"] [data-pin]').click();
  await page.mouse.click(box.x + 450, box.y + 350, { button: "right" });
  await expect(page.getByRole("dialog", { name: "도면 메뉴" })).toBeVisible();
  const preview = page.locator('main [data-layer="preview"] polyline'), points = await preview.getAttribute("points");
  await expect(svg).toHaveAttribute("data-operation", "WIRE_DRAFT");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "도면 메뉴" })).toHaveCount(0);
  await expect(svg).toHaveAttribute("data-operation", "WIRE_DRAFT");
  await expect(preview).toHaveAttribute("points", points!);
  await expect(page.locator("main [data-wire]")).toHaveCount(0);
  await expect(page.locator("header")).toHaveAttribute("data-edit-count", "1");
  await page.keyboard.press("Escape"); await expect(svg).toHaveAttribute("data-operation", "NONE");
});
