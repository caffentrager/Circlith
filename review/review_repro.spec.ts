import { test, expect, type Page } from "@playwright/test";
async function clickWorld(page: Page, x: number, y: number) {
  const box = await page.locator("main svg").boundingBox();
  await page.mouse.click(box!.x + x, box!.y + y);
}
async function place(page: Page, kind: string, x: number, y: number) {
  await page.locator(".library").getByRole("button", { name: kind, exact: true }).click();
  await clickWorld(page, x, y);
}
test.beforeEach(async ({ page }) => { await page.goto("/"); });

test("B1 context menu: Esc must close it (modal owns input)", async ({ page }) => {
  await place(page, "AND", 200, 200);
  const box = (await page.locator("main svg").boundingBox())!;
  await page.mouse.click(box.x + 200, box.y + 200, { button: "right" });
  await expect(page.getByRole("dialog", { name: "도면 메뉴" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "도면 메뉴" })).toHaveCount(0);
});

test("B2 at 50% zoom a pin 4 screen-px away is not snapped (2 candidates => none)", async ({ page }) => {
  await place(page, "Input", 100, 150);
  await place(page, "AND", 400, 150);
  const box = (await page.locator("main svg").boundingBox())!;
  await page.mouse.move(box.x + 640, box.y + 400);
  for (let i = 0; i < 8; i++) await page.mouse.wheel(0, 100);
  await page.keyboard.press("w");
  const pins = page.locator('main [data-layer="pins"] [data-pin]');
  await pins.nth(0).click({ force: true });                       // Input out pin
  await expect(page.locator("main svg")).toHaveAttribute("data-operation", "WIRE_DRAFT");
  const target = (await pins.nth(1).boundingBox())!;               // AND in0
  const tx = target.x + target.width / 2, ty = target.y + target.height / 2;
  await page.mouse.move(tx, ty + 4);                               // 4px toward in1
  await page.mouse.click(tx, ty + 4);
  await expect(page.locator("main [data-wire]")).toHaveCount(1);   // fails: waypoint added instead
});

test("B3 stale 'Redo blocked' message survives after the draft is gone", async ({ page }) => {
  await place(page, "AND", 200, 200);
  await page.locator(".library").getByRole("button", { name: "Input", exact: true }).click();
  await page.keyboard.press("Control+y");
  await page.keyboard.press("Escape");
  await expect(page.locator("footer")).not.toContainText("Redo를 실행하세요");
});

test("B4 window blur during pointer-drag rolls back; Ctrl+Z mid-drag leaves no history", async ({ page }) => {
  await place(page, "AND", 200, 200);
  const comp = page.locator('main [data-layer="symbols"] [data-component]');
  const original = await comp.getAttribute("transform");
  const box = (await page.locator("main svg").boundingBox())!;
  await page.mouse.move(box.x + 200, box.y + 200);
  await page.mouse.down();
  await page.mouse.move(box.x + 300, box.y + 300);
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await page.mouse.up();
  await expect(comp).toHaveAttribute("transform", original!);
  await page.mouse.move(box.x + 200, box.y + 200);
  await page.mouse.down();
  await page.mouse.move(box.x + 300, box.y + 300);
  await page.keyboard.press("Control+z");
  await page.mouse.up();
  await expect(comp).toHaveAttribute("transform", original!);
  await expect(page.getByText("1 committed edits")).toBeVisible();
});

test("B5 Enter in WIRE_DRAFT after pointer left a pin region uses stale hover", async ({ page }) => {
  await place(page, "Input", 100, 100);
  await place(page, "Output", 400, 300);
  await page.keyboard.press("w");
  const pins = page.locator('main [data-layer="pins"] [data-pin]');
  await pins.nth(0).click();
  const b = (await pins.nth(1).boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);    // hover target pin
  await page.mouse.move(2, 2, { steps: 1 });                       // leave svg straight to chrome
  await page.keyboard.press("Enter");
  await expect(page.locator("main [data-wire]")).toHaveCount(0);   // fails if stale hover connects
});

test("B2b diagnostics: zoom value and pin screen distances", async ({ page }) => {
  await place(page, "AND", 400, 150);
  const box = (await page.locator("main svg").boundingBox())!;
  await page.mouse.move(box.x + 640, box.y + 400);
  for (let i = 0; i < 8; i++) await page.mouse.wheel(0, 100);
  await page.waitForTimeout(100);
  console.log("TRANSFORM", await page.locator("main svg > g").first().getAttribute("transform"));
  const pins = page.locator('main [data-layer="pins"] [data-pin]');
  for (let i = 0; i < 3; i++) console.log("PIN", i, JSON.stringify(await pins.nth(i).boundingBox()));
});

test("B6 pan starting on a pin leaves stale hover; Enter then connects to it", async ({ page }) => {
  await place(page, "Input", 100, 100);
  await place(page, "Output", 400, 300);
  await page.keyboard.press("w");
  const pins = page.locator('main [data-layer="pins"] [data-pin]');
  await pins.nth(0).click();
  const b = (await pins.nth(1).boundingBox())!;
  const cx = b.x + b.width / 2, cy = b.y + b.height / 2;
  await page.mouse.move(cx, cy);                    // hover target pin
  await page.keyboard.down("Space");
  await page.mouse.down();
  await page.mouse.move(cx + 200, cy + 150, { steps: 5 });   // pan: pin leaves the pointer
  await page.mouse.up();
  await page.keyboard.up("Space");
  await page.keyboard.press("Enter");               // pointer is now over empty canvas
  await expect(page.locator("main [data-wire]")).toHaveCount(0);
});
