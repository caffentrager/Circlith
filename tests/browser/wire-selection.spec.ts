import { test, expect, type Page } from "@playwright/test";
import { wheelToZoom } from "./zoom-helper";

async function clickCanvas(page: Page, x: number, y: number) {
  const canvas = (await page.locator("main svg").boundingBox())!;
  await page.mouse.click(canvas.x + x, canvas.y + y);
}

async function connectedCircuit(page: Page) {
  await page.goto("/");
  for (const [kind, x, y] of [["Input", 100, 100], ["Output", 400, 300]] as const) {
    await page.locator(".library").getByRole("button", { name: kind, exact: true }).click();
    await clickCanvas(page, x, y);
  }
  const pins = page.locator('main [data-layer="pins"] [data-pin]');
  await pins.nth(0).click();
  await pins.nth(1).click();
  await page.keyboard.press("Escape");
}

test("wire click, Shift selection, Escape and Undo preserve circuit and history", async ({ page }) => {
  await connectedCircuit(page);
  const wire = page.locator("main [data-wire]");
  const points = await wire.getAttribute("points");
  // SELECT clicks select; WIRE clicks now explicitly start a branch.
  await clickCanvas(page, 240, 104);
  await expect(wire).toHaveClass(/selected/);
  await expect(page.locator(".properties")).toContainText("1개 배선");
  await expect(page.locator("main .symbol.selected")).toHaveCount(0);
  await expect(page.locator("main svg")).toHaveAttribute("data-operation", "NONE");
  await page.keyboard.down("Shift");
  await clickCanvas(page, 100, 100);
  await page.keyboard.up("Shift");
  await expect(page.locator("main .symbol.selected")).toHaveCount(1);
  await expect(wire).toHaveClass(/selected/);
  await page.keyboard.down("Shift");
  await clickCanvas(page, 240, 100);
  await page.keyboard.up("Shift");
  await expect(wire).not.toHaveClass(/selected/);
  await page.keyboard.press("Control+a");
  await expect(wire).toHaveClass(/selected/);
  await expect(page.locator("main .symbol.selected")).toHaveCount(2);
  await page.keyboard.press("Escape");
  await expect(wire).not.toHaveClass(/selected/);
  await expect(wire).toHaveAttribute("points", points!);
  await expect(page.getByText("3 committed edits")).toBeVisible();
  await clickCanvas(page, 240, 100);
  await page.keyboard.press("Control+z");
  await expect(wire).toHaveCount(0);
  await expect(page.locator(".properties")).toContainText("0개 배선");
  await page.keyboard.press("Control+y");
  await expect(wire).toHaveAttribute("points", points!);
});

test("wire box selection uses complete containment or actual segment crossing", async ({ page }) => {
  await connectedCircuit(page);
  await page.keyboard.press("Escape");
  const wire = page.locator("main [data-wire]");
  const canvas = (await page.locator("main svg").boundingBox())!;
  const box = async (x1: number, y1: number, x2: number, y2: number) => {
    await page.mouse.move(canvas.x + x1, canvas.y + y1);
    await page.mouse.down();
    await page.mouse.move(canvas.x + x2, canvas.y + y2, { steps: 5 });
    await page.mouse.up();
  };
  await box(130, 80, 380, 320);
  await expect(wire).toHaveClass(/selected/);
  await expect(page.locator("main .symbol.selected")).toHaveCount(0);
  await box(200, 80, 280, 120);
  await expect(wire).not.toHaveClass(/selected/);
  await box(280, 120, 200, 80);
  await expect(wire).toHaveClass(/selected/);
  // Inside the L-shaped wire's bounding box but not touching a segment.
  await box(280, 240, 200, 160);
  await expect(wire).not.toHaveClass(/selected/);
  await clickCanvas(page, 240, 100);
  await clickCanvas(page, 600, 400);
  await expect(wire).not.toHaveClass(/selected/);
});

test("wire hit tolerance stays in screen pixels after zoom and pan; pins still start wiring", async ({ page }) => {
  await connectedCircuit(page);
  const canvas = (await page.locator("main svg").boundingBox())!;
  await page.mouse.move(canvas.x + 640, canvas.y + 400);
  await wheelToZoom(page, 0.5);
  await expect(page.locator("main svg > g").first()).toHaveAttribute("transform", /scale\(0.5\)/);
  await clickCanvas(page, 440, 254);
  await expect(page.locator("main [data-wire]")).toHaveClass(/selected/);
  await page.keyboard.down("Space");
  await page.mouse.move(canvas.x + 600, canvas.y + 400);
  await page.mouse.down();
  await page.mouse.move(canvas.x + 640, canvas.y + 430, { steps: 5 });
  await page.mouse.up();
  await page.keyboard.up("Space");
  await clickCanvas(page, 700, 450);
  await clickCanvas(page, 480, 284);
  await expect(page.locator("main [data-wire]")).toHaveClass(/selected/);
  await page.locator('main [data-layer="pins"] [data-pin]').first().click();
  await expect(page.locator("main svg")).toHaveAttribute("data-operation", "WIRE_DRAFT");
  await page.keyboard.press("Escape");
  await expect(page.getByText("3 committed edits")).toBeVisible();
});
