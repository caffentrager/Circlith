import { test, expect, type Page } from "@playwright/test";

async function at(page: Page, x: number, y: number) {
  const box = (await page.locator("main svg").boundingBox())!;
  return { x: box.x + x, y: box.y + y };
}
async function click(page: Page, x: number, y: number) {
  const p = await at(page, x, y); await page.mouse.click(p.x, p.y);
}
async function move(page: Page, x: number, y: number) {
  const p = await at(page, x, y); await page.mouse.move(p.x, p.y);
}
async function place(page: Page, kind: string, x: number, y: number) {
  await page.locator(".library").getByRole("button", { name: kind, exact: true }).click();
  await click(page, x, y);
}
async function fixture(page: Page, extra = "Output") {
  await page.goto(process.env.CIRCLITH_BASE_PATH ?? "/");
  await place(page, "Input", 100, 100); await place(page, "Output", 400, 300);
  await place(page, extra, extra === "Input" ? 100 : 600, extra === "Input" ? 400 : 200);
  const pins = page.locator('main [data-layer="pins"] [data-pin]');
  await pins.nth(0).click(); await pins.nth(1).click();
  await page.keyboard.press("Escape");
  return page.locator("main svg");
}

test("W starts a tentative middle branch, cancellation keeps history, commit splits and Undo restores IDs", async ({ page }) => {
  const svg = await fixture(page);
  const wire = page.locator("main [data-wire]");
  const original = { id: await wire.getAttribute("data-wire"), points: await wire.getAttribute("points") };
  await move(page, 240, 100); await page.keyboard.press("w");
  await expect(svg).toHaveAttribute("data-operation", "WIRE_DRAFT");
  await expect(page.locator('[data-layer="pending-junction"]')).toHaveCount(1);
  await expect(svg).toHaveAttribute("data-junction-count", "0");
  await expect(wire).toHaveCount(1);
  await page.keyboard.press("Escape"); await expect(wire).toHaveAttribute("points", original.points!);
  await move(page, 240, 100); await page.keyboard.press("w");
  await page.locator('main [data-layer="pins"] [data-pin]').nth(2).click();
  await expect(svg).toHaveAttribute("data-junction-count", "1");
  await expect(svg).toHaveAttribute("data-net-count", "1");
  await expect(wire).toHaveCount(3);
  await expect(page.locator("main .pin.connected")).toHaveCount(3);
  await page.keyboard.press("Control+z");
  await expect(wire).toHaveCount(1); await expect(wire).toHaveAttribute("data-wire", original.id!);
  await expect(wire).toHaveAttribute("points", original.points!);
  await expect(svg).toHaveAttribute("data-junction-count", "0");
  await page.keyboard.press("Control+y"); await expect(wire).toHaveCount(3);
});

test("pin-to-wire drag commits a T and existing junction clicks reuse it", async ({ page }) => {
  const svg = await fixture(page, "Input");
  const pin = page.locator('main [data-layer="pins"] [data-pin]').nth(2), b = (await pin.boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await page.mouse.down();
  await move(page, 240, 104);
  await expect(svg).toHaveAttribute("data-snap-kind", "wire");
  await page.mouse.up();
  await expect(svg).toHaveAttribute("data-junction-count", "1");
  await expect(page.locator("main [data-wire]")).toHaveCount(3);
  await page.keyboard.press("Escape");
  await page.locator("main [data-junction]").click();
  await expect(svg).toHaveAttribute("data-operation", "WIRE_DRAFT");
  await page.locator('main [data-layer="pins"] [data-pin]').nth(1).click();
  await expect(svg).toHaveAttribute("data-junction-count", "1");
  await expect(page.locator("main [data-wire]")).toHaveCount(4);
});

test("wire-to-wire joins two nets and connected-net selection includes every split segment", async ({ page }) => {
  const svg = await fixture(page, "Input");
  await place(page, "Output", 600, 450);
  const pins = page.locator('main [data-layer="pins"] [data-pin]');
  await pins.nth(2).click(); await pins.nth(3).click();
  await expect(svg).toHaveAttribute("data-net-count", "2");
  await move(page, 240, 100); await page.keyboard.press("w");
  await click(page, 300, 400);
  await expect(svg).toHaveAttribute("data-net-count", "1");
  await expect(svg).toHaveAttribute("data-junction-count", "2");
  await expect(page.locator("main [data-wire]")).toHaveCount(5);
  await page.keyboard.press("Escape"); await click(page, 200, 100);
  await page.getByRole("button", { name: "연결망 전체 선택", exact: true }).click();
  await expect(page.locator("main .wire.selected")).toHaveCount(5);
  await page.keyboard.press("Control+z");
  await expect(svg).toHaveAttribute("data-net-count", "2");
  await expect(svg).toHaveAttribute("data-junction-count", "0");
});

test("crossings stay separate; ambiguity chooser cancels safely or explicitly joins all four arms", async ({ page }) => {
  await page.goto(process.env.CIRCLITH_BASE_PATH ?? "/");
  await place(page, "Input", 100, 100); await place(page, "Output", 400, 300);
  const pins = page.locator('main [data-layer="pins"] [data-pin]');
  await pins.nth(0).click(); await pins.nth(1).click();
  await place(page, "Input", 300, 40); await page.keyboard.press("Shift+r");
  await place(page, "Output", 300, 300); await page.keyboard.press("Shift+r");
  await pins.nth(2).click(); await pins.nth(3).click();
  const svg = page.locator("main svg");
  await expect(svg).toHaveAttribute("data-net-count", "2");
  await expect(svg).toHaveAttribute("data-junction-count", "0");
  await move(page, 300, 100); await page.keyboard.press("w");
  const chooser = page.getByRole("dialog", { name: "접속 대상 선택" });
  await expect(chooser).toBeVisible(); await page.keyboard.press("Escape");
  await expect(chooser).toHaveCount(0); await expect(svg).toHaveAttribute("data-net-count", "2");
  await move(page, 300, 100); await page.keyboard.press("w");
  await chooser.getByRole("button", { name: "이 교차점을 접속", exact: true }).click();
  await expect(svg).toHaveAttribute("data-net-count", "1");
  await expect(svg).toHaveAttribute("data-junction-count", "1");
  await expect(page.locator("main [data-wire]")).toHaveCount(4);
  await page.keyboard.press("Control+z"); await expect(svg).toHaveAttribute("data-net-count", "2");
  await expect(page.locator("main [data-wire]")).toHaveCount(2);
});

test("branch button, wire tool and snap thresholds work at 50% and 200% zoom", async ({ page }) => {
  const svg = await fixture(page);
  await click(page, 240, 100);
  await page.getByRole("button", { name: "이 선에서 분기", exact: true }).click();
  await expect(svg).toHaveAttribute("data-operation", "WIRE_DRAFT");
  await page.keyboard.press("Escape");
  for (const zoom of [.5, 2]) {
    await move(page, 240, 100);
    for (let i = 0; i < 16; i++) await page.mouse.wheel(0, zoom < 1 ? 100 : -100);
    await expect(page.locator("main svg > g").first()).toHaveAttribute("transform", new RegExp(`scale\\(${zoom}\\)`));
    await page.keyboard.press("w");
    await expect(svg).toHaveAttribute("data-operation", "WIRE_DRAFT");
    await expect(svg).toHaveAttribute("data-junction-count", "0");
    await page.keyboard.press("Escape");
  }
  await page.getByRole("button", { name: /^배선 W/ }).click();
  await expect(svg).toHaveAttribute("data-tool", "WIRE");
});

test("ambiguous finish chooses one wire and Escape closes only the chooser", async ({ page }) => {
  await page.goto(process.env.CIRCLITH_BASE_PATH ?? "/");
  await place(page, "Input", 100, 100); await place(page, "Output", 400, 300);
  const pins = page.locator('main [data-layer="pins"] [data-pin]');
  await pins.nth(0).click(); await pins.nth(1).click();
  await place(page, "Input", 300, 40); await page.keyboard.press("Shift+r");
  await place(page, "Output", 300, 300); await page.keyboard.press("Shift+r");
  await pins.nth(2).click(); await pins.nth(3).click();
  await place(page, "Input", 100, 400); await pins.nth(4).click();
  await click(page, 300, 100);
  const chooser = page.getByRole("dialog", { name: "접속 대상 선택" }), svg = page.locator("main svg");
  await expect(chooser).toBeVisible();
  await expect(chooser.getByRole("button", { name: "이 교차점을 접속", exact: true })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(chooser).toHaveCount(0);
  await expect(svg).toHaveAttribute("data-operation", "WIRE_DRAFT");
  await expect(svg).toHaveAttribute("data-net-count", "2");
  await click(page, 300, 100);
  await chooser.getByRole("button", { name: /^1\./ }).click();
  await expect(svg).toHaveAttribute("data-operation", "NONE");
  await expect(svg).toHaveAttribute("data-net-count", "2");
  await expect(svg).toHaveAttribute("data-junction-count", "1");
  await page.keyboard.press("Control+z");
  await expect(svg).toHaveAttribute("data-junction-count", "0");
  await expect(page.locator("main [data-wire]")).toHaveCount(2);
});

test("component move removes the spur while preserving branch dots and Undo", async ({ page }) => {
  const svg = await fixture(page);
  await move(page, 240, 100); await page.keyboard.press("w");
  await page.locator('main [data-layer="pins"] [data-pin]').nth(2).click();
  const junction = page.locator("main [data-junction]");
  const original = await page.locator("main [data-wire]").evaluateAll((els) => els.map((e) => e.getAttribute("points")));
  const dot = { x: await junction.getAttribute("cx"), y: await junction.getAttribute("cy") };
  await page.keyboard.press("Escape");
  await move(page, 100, 100); await page.mouse.down(); await move(page, 300, 250); await page.mouse.up();
  await expect(svg).toHaveAttribute("data-net-count", "1"); await expect(svg).toHaveAttribute("data-junction-count", "1");
  await expect(junction).toHaveAttribute("cx", dot.x!); await expect(junction).toHaveAttribute("cy", dot.y!);
  const paths = await page.locator("main [data-wire]").evaluateAll((els) => els.map((e) => e.getAttribute("points")!));
  for (const path of paths) {
    const points = path.split(" ").map((p) => p.split(",").map(Number));
    for (let i = 2; i < points.length; i++)
      expect((points[i - 2][0] === points[i - 1][0] && points[i - 1][0] === points[i][0]) ||
        (points[i - 2][1] === points[i - 1][1] && points[i - 1][1] === points[i][1])).toBe(false);
  }
  await page.keyboard.press("Control+z");
  expect(await page.locator("main [data-wire]").evaluateAll((els) => els.map((e) => e.getAttribute("points")))).toEqual(original);
});
