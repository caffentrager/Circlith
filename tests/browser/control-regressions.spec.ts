import { test, expect, type Page } from "@playwright/test";
import { readZoom } from "./zoom-helper";

async function point(page: Page, x: number, y: number, click = true) {
  const b = (await page.locator("main svg").boundingBox())!;
  if (click) await page.mouse.click(b.x + x, b.y + y); else await page.mouse.move(b.x + x, b.y + y);
}
async function part(page: Page, kind: string, x: number, y: number) {
  await page.locator(".library").getByRole("button", { name: kind, exact: true }).click(); await point(page, x, y);
}
async function drag(page: Page, x: number, y: number, toX: number, toY: number) {
  await point(page, x, y, false); await page.mouse.down();
  const b = (await page.locator("main svg").boundingBox())!;
  await page.mouse.move(b.x + toX, b.y + toY, { steps: 4 });
}
async function wheel(page: Page, deltaY: number, deltaMode = 0, deltaX = 0) {
  const b = (await page.locator("main svg").boundingBox())!;
  await page.locator("main svg").dispatchEvent("wheel", { deltaY, deltaMode, deltaX, bubbles: true, cancelable: true, clientX: b.x + 400, clientY: b.y + 300 });
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
}
test.beforeEach(async ({ page }) => { await page.goto(process.env.CIRCLITH_BASE_PATH ?? "/"); });

test("toolbar commands restore canvas wheel and keyboard ownership, including Undo and Redo", async ({ page }) => {
  await part(page, "Input", 100, 100);
  const svg = page.locator("main svg"), components = page.locator('main [data-layer="symbols"] [data-component]');
  await page.locator('header').getByRole("button", { name: /^선택 / }).click(); await expect(svg).toBeFocused();
  await wheel(page, 100); expect(await readZoom(page)).toBeLessThan(1);
  await page.keyboard.press("Control+z"); await expect(components).toHaveCount(0);
  await page.keyboard.press("Control+y"); await expect(components).toHaveCount(1);
  await page.locator("header").getByRole("button", { name: "Undo", exact: true }).click(); await expect(svg).toBeFocused();
  await expect(components).toHaveCount(0);
  await page.locator("header").getByRole("button", { name: "Redo", exact: true }).click(); await expect(svg).toBeFocused();
  await expect(components).toHaveCount(1); await page.keyboard.press("Control+z"); await expect(components).toHaveCount(0);
});

test("text, settings and search retain ownership while normal buttons return to the canvas", async ({ page }) => {
  await part(page, "AND", 200, 200); const svg = page.locator("main svg");
  const name = page.getByRole("textbox", { name: "프로젝트 이름" }); await name.fill("Editing R");
  await name.press("r"); await name.press("Control+z"); await wheel(page, -100);
  expect(await readZoom(page)).toBe(1); await expect(name).toBeFocused();
  await expect(page.getByText("1 committed edits")).toBeVisible();
  await page.getByRole("button", { name: "설정", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Input & Controls" });
  await expect(dialog.getByRole("button", { name: "닫기", exact: true })).toBeFocused();
  await svg.focus(); await wheel(page, -100); await page.keyboard.press("Control+z");
  expect(await readZoom(page)).toBe(1); await expect(page.getByText("1 committed edits")).toBeVisible();
  await dialog.getByRole("button", { name: "닫기", exact: true }).focus();
  await page.keyboard.press("Escape"); await expect(dialog).toHaveCount(0); await expect(svg).toBeFocused();
  await page.getByRole("button", { name: /^검색 / }).click(); await expect(page.getByRole("textbox", { name: "부품 검색어" })).toBeFocused();
  await page.keyboard.press("Escape"); await expect(svg).toBeFocused();
});

test("a blocked wire drop rolls back and stops following the cursor without losing Redo", async ({ page }) => {
  await part(page, "Input", 100, 100); await part(page, "Output", 400, 300);
  const pins = page.locator('main [data-layer="pins"] [data-pin]'); await pins.nth(0).click(); await pins.nth(1).click(); await page.keyboard.press("Escape");
  await point(page, 200, 100); const wire = page.locator("main [data-wire]"), svg = page.locator("main svg"), original = await wire.getAttribute("points");
  await drag(page, 350, 200, 400, 200); await expect(svg).toHaveAttribute("data-routing-blocked", "true"); await page.mouse.up();
  await expect(svg).toHaveAttribute("data-operation", "NONE"); await expect(wire).toHaveAttribute("points", original!);
  await expect(page.getByRole("status")).toContainText("우회 경로가 없습니다");
  await point(page, 320, 200, false); await expect(wire).toHaveAttribute("points", original!); await expect(page.getByText("3 committed edits")).toBeVisible();
  await drag(page, 350, 200, 320, 200); await page.mouse.up(); const valid = await wire.getAttribute("points"); expect(valid).not.toBe(original);
  await page.keyboard.press("Control+z"); await drag(page, 350, 200, 400, 200); await page.mouse.up();
  await expect(svg).toHaveAttribute("data-operation", "NONE"); await page.keyboard.press("Control+y"); await expect(wire).toHaveAttribute("points", valid!);
});

test("failed one-shot rotation and blocked component drop leave no cursor-following move", async ({ page }) => {
  await part(page, "AND", 100, 100); await part(page, "Output", 500, 100);
  const pins = page.locator('main [data-layer="pins"] [data-pin]'); await pins.nth(2).click();
  for (const [x, y] of [[140, 130], [100, 130], [100, 200], [460, 200]]) await point(page, x, y);
  await pins.nth(3).click(); await page.keyboard.press("Escape"); await point(page, 100, 100);
  const svg = page.locator("main svg"), components = page.locator('main [data-layer="symbols"] [data-component]'), wire = page.locator("main [data-wire]"), original = await wire.getAttribute("points");
  await page.keyboard.press("r"); await expect(page.getByRole("status")).toContainText("우회 경로가 없습니다");
  await expect(svg).toHaveAttribute("data-operation", "NONE"); await point(page, 350, 250, false);
  await expect(components.first()).toHaveAttribute("transform", "translate(100 100) rotate(0)"); await expect(wire).toHaveAttribute("points", original!);
  await expect(page.getByText("3 committed edits")).toBeVisible();
  await part(page, "AND", 300, 350); await drag(page, 300, 350, 120, 150);
  await expect(svg).toHaveAttribute("data-routing-blocked", "true"); await page.mouse.up();
  await expect(svg).toHaveAttribute("data-operation", "NONE"); await point(page, 400, 400, false);
  await expect(components.last()).toHaveAttribute("transform", "translate(300 350) rotate(0)"); await expect(wire).toHaveAttribute("points", original!);
  await expect(page.getByText("4 committed edits")).toBeVisible();
});

test("wheel distance is proportional, horizontal input is ignored, and line/page impulses are bounded", async ({ page }) => {
  const svg = page.locator("main svg"); await svg.focus(); const initial = await page.locator("main svg > g").first().getAttribute("transform");
  await wheel(page, 0, 0, 100); await expect(page.locator("main svg > g").first()).toHaveAttribute("transform", initial!);
  await wheel(page, -1); const small = await readZoom(page); expect(small).toBeGreaterThan(1); expect(small).toBeLessThan(1.002);
  await page.reload(); await svg.focus(); await wheel(page, -100); const whole = await readZoom(page); expect(whole).toBeCloseTo(1.1, 10);
  await page.reload(); await svg.focus(); for (let i = 0; i < 10; i++) await wheel(page, -10);
  expect(await readZoom(page)).toBeCloseTo(whole, 10);
  await page.reload(); await svg.focus(); await wheel(page, -1, 1); const line = await readZoom(page);
  await page.reload(); await svg.focus(); await wheel(page, -16); expect(await readZoom(page)).toBe(line);
  await wheel(page, -1, 2); expect(await readZoom(page)).toBeLessThan(1.3);
});

test("wheel and keyboard zoom remain directional below 50% after fitting a wide circuit", async ({ page }) => {
  await part(page, "Input", 100, 100); await page.locator(".library").getByRole("button", { name: "Output", exact: true }).click();
  for (let i = 0; i < 5; i++) {
    await page.keyboard.down("Space"); await drag(page, 650, 350, 250, 350); await page.mouse.up(); await page.keyboard.up("Space");
  }
  await point(page, 600, 100); await page.keyboard.press("Home"); const fit = await readZoom(page); expect(fit).toBeLessThan(0.5);
  await wheel(page, 100); const out = await readZoom(page); expect(out).toBeLessThan(fit);
  await page.keyboard.press("-"); const keyOut = await readZoom(page); expect(keyOut).toBeLessThan(out);
  await page.keyboard.press("+"); const keyIn = await readZoom(page); expect(keyIn).toBeGreaterThan(keyOut); expect(keyIn).toBeCloseTo(out, 10);
  await expect(page.getByText("2 committed edits")).toBeVisible();
});
