import { test, expect, type Page } from "@playwright/test";
import { wheelToZoom } from "./zoom-helper";

async function canvasPoint(page: Page, x: number, y: number) {
  const box = (await page.locator("main svg").boundingBox())!;
  return { x: box.x + x, y: box.y + y };
}
async function setup(page: Page) {
  await page.goto(process.env.CIRCLITH_BASE_PATH ?? "/");
  for (const [kind, x, y] of [["Input", 100, 100], ["Output", 400, 300]] as const) {
    await page.locator(".library").getByRole("button", { name: kind, exact: true }).click();
    const p = await canvasPoint(page, x, y); await page.mouse.click(p.x, p.y);
  }
  const pins = page.locator('main [data-layer="pins"] [data-pin]');
  await pins.nth(0).click(); await pins.nth(1).click();
  await page.keyboard.press("Escape");
  const p = await canvasPoint(page, 200, 100); await page.mouse.click(p.x, p.y);
  return page.locator("main [data-wire]");
}
async function dragTo(page: Page, x1: number, y1: number, x2: number, y2: number) {
  const a = await canvasPoint(page, x1, y1), b = await canvasPoint(page, x2, y2);
  await page.mouse.move(a.x, a.y); await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 5 });
}
async function dragHandle(page: Page, kind: string, x: number, y: number) {
  const handle = page.locator(`[data-wire-handle][data-kind="${kind}"]`).first();
  const box = (await handle.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  const p = await canvasPoint(page, x, y);
  await page.mouse.move(p.x, p.y, { steps: 5 });
}
function assertPath(points: string | null) {
  const path = points!.split(" ").map((p) => p.split(",").map(Number));
  expect(path[0]).toEqual([140, 100]); expect(path.at(-1)).toEqual([360, 300]);
  for (let i = 1; i < path.length; i++)
    expect(path[i][0] === path[i - 1][0] || path[i][1] === path[i - 1][1]).toBe(true);
}

test("direct segment dragging previews, preserves pins, and has exact single-step Undo/Redo", async ({ page }) => {
  const wire = await setup(page), original = await wire.getAttribute("points");
  await dragTo(page, 200, 100, 200, 160);
  await expect(page.locator("main svg")).toHaveAttribute("data-operation", "SEGMENT_MOVE");
  await expect(page.locator("header")).toHaveAttribute("data-edit-count", "3");
  await page.mouse.up();
  const changed = await wire.getAttribute("points");
  expect(changed).not.toBe(original); assertPath(changed);
  await expect(page.locator("header")).toHaveAttribute("data-edit-count", "4");
  await page.keyboard.press("Control+z"); await expect(wire).toHaveAttribute("points", original!);
  await page.keyboard.press("Control+y"); await expect(wire).toHaveAttribute("points", changed!);
});

test("corner and jog handles reshape routes without moving components", async ({ page }) => {
  const wire = await setup(page);
  const components = page.locator('main [data-layer="symbols"] [data-component]');
  const before = await components.evaluateAll((els) => els.map((e) => e.getAttribute("transform")));
  await dragHandle(page, "corner", 320, 160); await page.mouse.up();
  const corner = await wire.getAttribute("points"); assertPath(corner);
  expect(corner).toContain("320,160");
  await dragHandle(page, "jog", 230, 220); await page.mouse.up();
  assertPath(await wire.getAttribute("points"));
  expect(await wire.getAttribute("points")).not.toBe(corner);
  expect(await components.evaluateAll((els) => els.map((e) => e.getAttribute("transform")))).toEqual(before);
  await page.keyboard.press("Control+z"); await expect(wire).toHaveAttribute("points", corner!);
});

test("Escape, Ctrl+Z, Tab, capture loss, blur and outside release roll back only the drag", async ({ page }) => {
  const wire = await setup(page), original = await wire.getAttribute("points");
  for (const cancel of ["Escape", "Control+z", "Tab", "capture", "blur", "outside"]) {
    await page.locator("main svg").focus();
    await dragTo(page, 200, 100, 200, 160);
    if (cancel === "capture") await page.locator("main svg").dispatchEvent("lostpointercapture");
    else if (cancel === "blur") await page.evaluate(() => window.dispatchEvent(new Event("blur")));
    else if (cancel === "outside") await page.mouse.move(20, 20);
    else await page.keyboard.press(cancel);
    await page.mouse.up();
    await expect(wire).toHaveAttribute("points", original!);
    await expect(page.locator("main svg")).toHaveAttribute("data-operation", "NONE");
    await expect(page.locator("header")).toHaveAttribute("data-edit-count", "3");
  }
});

test("redraw supports checkpoints and bend switching, fixes endpoints, and tidies with Undo", async ({ page }) => {
  const wire = await setup(page), original = await wire.getAttribute("points");
  if (!await page.locator(".advanced-wire-tools").getAttribute("open").then(v => v !== null)) await page.locator(".advanced-wire-tools summary").click();
  await page.getByRole("button", { name: "경로 다시 그리기", exact: true }).click();
  await expect(page.locator("main svg")).toHaveAttribute("data-operation", "WIRE_ROUTE");
  let p = await canvasPoint(page, 220, 200); await page.mouse.click(p.x, p.y);
  p = await canvasPoint(page, 300, 240); await page.mouse.move(p.x, p.y);
  const before = await wire.getAttribute("points");
  await page.keyboard.press("Shift+Space");
  expect(await wire.getAttribute("points")).not.toBe(before);
  await page.mouse.click(p.x, p.y); await page.keyboard.press("Backspace");
  await page.keyboard.press("Enter");
  const redrawn = await wire.getAttribute("points"); assertPath(redrawn);
  await expect(page.locator("header")).toHaveAttribute("data-edit-count", "4");
  if (!await page.locator(".advanced-wire-tools").getAttribute("open").then(v => v !== null)) await page.locator(".advanced-wire-tools summary").click();
  await page.getByRole("button", { name: "세로 우선 정리", exact: true }).click();
  await expect(wire).toHaveAttribute("points", "140,100 140,300 360,300");
  await page.locator("main svg").focus(); await page.keyboard.press("Control+z");
  await expect(wire).toHaveAttribute("points", redrawn!);
  await page.keyboard.press("Control+z"); await expect(wire).toHaveAttribute("points", original!);
  if (!await page.locator(".advanced-wire-tools").getAttribute("open").then(v => v !== null)) await page.locator(".advanced-wire-tools summary").click();
  await page.getByRole("button", { name: "경로 다시 그리기", exact: true }).click();
  await page.keyboard.press("Escape"); await expect(wire).toHaveAttribute("points", original!);
  await page.keyboard.press("Control+y"); await expect(wire).toHaveAttribute("points", redrawn!);
});

test("editing follows drawing coordinates at 50% and 200% zoom", async ({ page }) => {
  const wire = await setup(page), original = await wire.getAttribute("points");
  for (const zoom of [0.5, 2]) {
    const anchor = await canvasPoint(page, 200, 100);
    await page.mouse.move(anchor.x, anchor.y);
    await wheelToZoom(page, zoom);
    await expect(page.locator("main svg > g").first()).toHaveAttribute("transform", new RegExp(`scale\\(${zoom}\\)`));
    const handle = page.locator('[data-wire-handle][data-kind="segment"]').first();
    const b = (await handle.boundingBox())!;
    // The visible hit bounds include the fixed 1.5px outline.
    expect(b.width).toBeCloseTo(11.5, 0);
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await page.mouse.down();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2 + 40 * zoom, { steps: 5 });
    await page.mouse.up();
    await expect(wire).toHaveAttribute("points", "140,100 140,140 350,140 350,300 360,300");
    await page.keyboard.press("Control+z"); await expect(wire).toHaveAttribute("points", original!);
  }
});
