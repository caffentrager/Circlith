import { test, expect, type Page } from "@playwright/test";
import { wheelToZoom } from "./zoom-helper";
async function place(page: Page, kind: string, x: number, y: number) {
  await page
    .locator(".library")
    .getByRole("button", { name: kind, exact: true })
    .click();
  const c = (await page.locator("main svg").boundingBox())!;
  await page.mouse.click(c.x + x, c.y + y);
}
async function drag(
  page: Page,
  a: { x: number; y: number },
  b: { x: number; y: number },
  button: "left" | "right" = "left",
) {
  const c = (await page.locator("main svg").boundingBox())!;
  await page.mouse.move(c.x + a.x, c.y + a.y);
  await page.mouse.down({ button });
  await page.mouse.move(c.x + b.x, c.y + b.y, { steps: 5 });
}
test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("Space left drag pans without changing selection, components or history; draft survives", async ({
  page,
}) => {
  await place(page, "AND", 200, 200);
  const comp = page.locator('main svg > g > [data-layer="symbols"] [data-component]');
  const original = await comp.getAttribute("transform");
  await page
    .locator(".library")
    .getByRole("button", { name: "Input", exact: true })
    .click();
  await page.keyboard.down('Space');
  await drag(page, { x: 500, y: 400 }, { x: 580, y: 450 });
  await page.mouse.up(); await page.keyboard.up('Space');
  await expect(page.locator("main svg > g").first()).toHaveAttribute(
    "transform",
    "translate(80 50) scale(1)",
  );
  await expect(page.locator("main svg")).toHaveAttribute(
    "data-operation",
    "PLACE",
  );
  await expect(comp).toHaveAttribute("transform", original!);
  await expect(page.getByRole("dialog", { name: "도면 메뉴" })).toHaveCount(0);
  await expect(page.locator("header")).toHaveAttribute("data-edit-count", "1");
  await page.keyboard.press("Escape");
  await expect(page.locator("main .symbol.selected")).toHaveCount(1);
  await page.keyboard.press("Control+z");
  await expect(comp).toHaveCount(0);
});

test("left box selects contained objects, right-to-left crosses objects, Shift adds, empty click clears", async ({
  page,
}) => {
  await place(page, "Input", 200, 200);
  await place(page, "AND", 400, 200);
  await place(page, "Output", 600, 200);
  const selected = page.locator("main .symbol.selected");
  await drag(page, { x: 140, y: 160 }, { x: 450, y: 240 });
  await expect(page.locator('[data-layer="selection-box"]')).toBeVisible();
  await expect(page.locator("main svg")).toHaveAttribute(
    "data-operation",
    "BOX_SELECT",
  );
  await page.mouse.up();
  await expect(selected).toHaveCount(2);
  await drag(page, { x: 140, y: 160 }, { x: 410, y: 240 });
  await page.mouse.up();
  await expect(selected).toHaveCount(1);
  await page.keyboard.down("Shift");
  await drag(page, { x: 610, y: 240 }, { x: 590, y: 160 });
  await page.mouse.up();
  await page.keyboard.up("Shift");
  await expect(selected).toHaveCount(2);
  await expect(page.locator("header")).toHaveAttribute("data-edit-count", "3");
  const c = (await page.locator("main svg").boundingBox())!;
  await page.mouse.click(c.x + 700, c.y + 400);
  await expect(selected).toHaveCount(0);
});

test("selection rollback on Escape and capture loss restores selection and rotated bounds work at 50% zoom", async ({
  page,
}) => {
  await place(page, "AND", 200, 200);
  await page.keyboard.press("r");
  await drag(page, { x: 100, y: 100 }, { x: 500, y: 400 });
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await expect(page.locator("main .symbol.selected")).toHaveCount(1);
  await expect(page.locator('[data-layer="selection-box"]')).toHaveCount(0);
  await drag(page, { x: 100, y: 100 }, { x: 500, y: 400 });
  await page.locator("main svg").dispatchEvent("pointercancel");
  await page.mouse.up();
  await expect(page.locator("main .symbol.selected")).toHaveCount(1);
  const c = (await page.locator("main svg").boundingBox())!;
  await page.mouse.move(c.x + 640, c.y + 400);
  await wheelToZoom(page, 0.5);
  await expect(page.locator("main svg > g").first()).toHaveAttribute(
    "transform",
    /scale\(0.5\)/,
  );
  await drag(page, { x: 395, y: 280 }, { x: 445, y: 320 });
  await page.mouse.up();
  await expect(page.locator("main .symbol.selected")).toHaveCount(1);
  await expect(page.locator("header")).toHaveAttribute("data-edit-count", "2");
});
