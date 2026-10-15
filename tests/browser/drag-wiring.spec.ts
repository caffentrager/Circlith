import { test, expect, type Page } from "@playwright/test";
import { wheelToZoom } from "./zoom-helper";

async function dragPart(page: Page, kind: string, x: number, y: number) {
  const button = page
    .locator(".library")
    .getByRole("button", { name: kind, exact: true });
  const source = (await button.boundingBox())!;
  const canvas = (await page.locator("main svg").boundingBox())!;
  await page.mouse.move(
    source.x + source.width / 2,
    source.y + source.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(canvas.x + x, canvas.y + y, { steps: 8 });
  await expect(
    page.locator('main [data-layer="preview"] [data-component]'),
  ).toHaveCount(1);
  await page.mouse.up();
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("palette drop and pin dragging use drawing coordinates at 50% zoom", async ({
  page,
}) => {
  const c = (await page.locator("main svg").boundingBox())!;
  await page.mouse.move(c.x + 640, c.y + 400);
  await wheelToZoom(page, 0.5);
  await expect(page.locator("main svg > g").first()).toHaveAttribute(
    "transform",
    /scale\(0.5\)/,
  );
  await dragPart(page, "Input", 420, 300);
  await expect(
    page.locator('main [data-layer="symbols"] [data-component]').first(),
  ).toHaveAttribute("transform", "translate(200 200) rotate(0)");
  await dragPart(page, "Output", 620, 400);
  const pins = page.locator('main [data-layer="pins"] [data-pin]');
  const a = (await pins.nth(0).boundingBox())!,
    b = (await pins.nth(1).boundingBox())!;
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 8 });
  await page.mouse.up();
  await expect(page.locator("main [data-wire]")).toHaveAttribute(
    "points",
    "240,200 550,200 550,400 560,400",
  );
});

test("palette drag previews and drops exactly one component; Undo and Redo restore it", async ({
  page,
}) => {
  await dragPart(page, "AND", 200, 200);
  const components = page.locator(
    'main [data-layer="symbols"] [data-component]',
  );
  await expect(components).toHaveCount(1);
  await expect(components).toHaveAttribute(
    "transform",
    "translate(200 200) rotate(0)",
  );
  await expect(page.locator("main svg")).toHaveAttribute(
    "data-operation",
    "NONE",
  );
  await expect(page.getByText("1 committed edits")).toBeVisible();
  await page.keyboard.press("Control+z");
  await expect(components).toHaveCount(0);
  await page.keyboard.press("Control+y");
  await expect(components).toHaveCount(1);
  await dragPart(page, "Output", 400, 300);
  await expect(components).toHaveCount(2);
});

test("drop outside canvas and interrupted palette drag never commit", async ({
  page,
}) => {
  await dragPart(page, "Input", 100, 100);
  const button = page
    .locator(".library")
    .getByRole("button", { name: "AND", exact: true });
  const b = (await button.boundingBox())!,
    c = (await page.locator("main svg").boundingBox())!;
  await page.mouse.move(b.x + 20, b.y + 20);
  await page.mouse.down();
  await page.mouse.move(c.x + 200, c.y + 200, { steps: 5 });
  await page.mouse.move(b.x + 20, b.y + 20);
  await page.mouse.up();
  await expect(
    page.locator('main [data-layer="symbols"] [data-component]'),
  ).toHaveCount(1);
  await expect(page.locator("main svg")).toHaveAttribute(
    "data-operation",
    "NONE",
  );
  await page.mouse.move(b.x + 20, b.y + 20);
  await page.mouse.down();
  await page.mouse.move(c.x + 200, c.y + 200, { steps: 5 });
  await button.dispatchEvent("pointercancel");
  await page.mouse.up();
  await expect(
    page.locator('main [data-layer="symbols"] [data-component]'),
  ).toHaveCount(1);
  await expect(page.getByText("1 committed edits")).toBeVisible();
});

test("pin click starts wire directly in Select tool and next pin click commits one wire", async ({
  page,
}) => {
  await dragPart(page, "Input", 100, 100);
  await dragPart(page, "Output", 400, 300);
  const svg = page.locator("main svg"),
    pins = page.locator('main [data-layer="pins"] [data-pin]');
  await expect(svg).toHaveAttribute("data-tool", "SELECT");
  await pins.nth(0).click();
  await expect(svg).toHaveAttribute("data-operation", "WIRE_DRAFT");
  await expect(page.locator("main [data-wire]")).toHaveCount(0);
  await pins.nth(1).click();
  await expect(page.locator("main [data-wire]")).toHaveCount(1);
  await expect(page.getByText("3 committed edits")).toBeVisible();
  await page.keyboard.press("Control+z");
  await expect(page.locator("main [data-wire]")).toHaveCount(0);
  await expect(
    page.locator('main [data-layer="symbols"] [data-component]'),
  ).toHaveCount(2);
});

test("pin drag snaps at release, preserves orthogonal wire, and cancelled wire drag does not affect history", async ({
  page,
}) => {
  await dragPart(page, "Input", 100, 100);
  await dragPart(page, "Output", 400, 300);
  const pins = page.locator('main [data-layer="pins"] [data-pin]');
  const a = (await pins.nth(0).boundingBox())!,
    b = (await pins.nth(1).boundingBox())!;
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 8 });
  await expect(page.locator("main [data-wire]")).toHaveCount(0);
  await page.mouse.up();
  await expect(page.locator("main [data-wire]")).toHaveCount(1);
  await expect(page.locator("main [data-wire]")).toHaveAttribute(
    "points",
    "140,100 350,100 350,300 360,300",
  );
  await page.keyboard.press("Escape");
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(a.x + 60, a.y + 90);
  await page.locator("main svg").dispatchEvent("pointercancel");
  await page.mouse.up();
  await expect(page.locator("main svg")).toHaveAttribute(
    "data-operation",
    "NONE",
  );
  await expect(page.getByText("3 committed edits")).toBeVisible();
});

test("wire drag released in empty space continues as draft and Enter after canvas leave does not use stale hover", async ({
  page,
}) => {
  await dragPart(page, "Input", 100, 100);
  await dragPart(page, "Output", 400, 300);
  const pins = page.locator('main [data-layer="pins"] [data-pin]');
  const a = (await pins.nth(0).boundingBox())!,
    b = (await pins.nth(1).boundingBox())!;
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(a.x + 80, a.y + 60);
  await page.mouse.up();
  await expect(page.locator("main svg")).toHaveAttribute(
    "data-operation",
    "WIRE_DRAFT",
  );
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.move(2, 2);
  await page.keyboard.press("Enter");
  await expect(page.locator("main [data-wire]")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(page.getByText("2 committed edits")).toBeVisible();
});
