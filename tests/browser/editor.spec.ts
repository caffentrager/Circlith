import { test, expect, type Page } from "@playwright/test";
async function clickWorld(page: Page, x: number, y: number) {
  const box = await page.locator("main svg").boundingBox();
  await page.mouse.click(box!.x + x, box!.y + y);
}
async function place(page: Page, kind: string, x: number, y: number) {
  await page
    .locator(".library")
    .getByRole("button", { name: kind, exact: true })
    .click();
  await clickWorld(page, x, y);
}
test.beforeEach(async ({ page }) => {
  await page.goto("/");
});
test("connected pointer move and rotation keep endpoints attached and Undo restores the exact wire", async ({
  page,
}) => {
  await place(page, "Input", 100, 100);
  await place(page, "Output", 400, 300);
  await page.keyboard.press("w");
  const pins = page.locator('main [data-layer="pins"] [data-pin]');
  await pins.nth(0).click();
  await pins.nth(1).click();
  await page.keyboard.press("Escape");
  const wire = page.locator("main [data-wire]");
  const original = await wire.getAttribute("points");
  const box = (await page.locator("main svg").boundingBox())!;
  await page.mouse.move(box.x + 100, box.y + 100);
  await page.mouse.down();
  await page.mouse.move(box.x + 150, box.y + 160);
  await page.mouse.up();
  await expect(wire).toHaveAttribute("points", /^190,160 /);
  await page.keyboard.press("r");
  await expect(wire).toHaveAttribute("points", /^150,120 /);
  await page.keyboard.press("Control+z");
  await expect(wire).toHaveAttribute("points", /^190,160 /);
  await page.keyboard.press("Control+z");
  await expect(wire).toHaveAttribute("points", original!);
  await expect(page.locator("main [data-wire]")).toHaveCount(1);
});
test("placement, move, rotate, draft cancellation and exact Undo/Redo", async ({
  page,
}) => {
  await place(page, "AND", 200, 200);
  const component = page
    .locator('main [data-layer="symbols"] [data-component]')
    .first();
  const original = await component.getAttribute("transform");
  await clickWorld(page, 200, 200);
  await page.keyboard.press("r");
  await expect(component).toHaveAttribute("transform", /rotate\(270\)/);
  await page.keyboard.press("Control+z");
  await expect(component).toHaveAttribute("transform", original!);
  await page.keyboard.press("m");
  await page.mouse.move(
    (await page.locator("main svg").boundingBox())!.x + 300,
    320,
  );
  await page.keyboard.press("Escape");
  await expect(component).toHaveAttribute("transform", original!);
  await clickWorld(page, 200, 200);
  await page.keyboard.press("m");
  await clickWorld(page, 300, 300);
  await expect(component).toHaveAttribute("transform", /translate\(300 300\)/);
  await page.keyboard.press("Control+z");
  await expect(component).toHaveAttribute("transform", original!);
  await page.keyboard.press("Control+Shift+z");
  await expect(component).toHaveAttribute("transform", /translate\(300 300\)/);
  await page
    .locator(".library")
    .getByRole("button", { name: "Input", exact: true })
    .click();
  await page.keyboard.press("Control+z");
  await expect(
    page.locator('main [data-layer="preview"] [data-component]'),
  ).toHaveCount(0);
  await expect(component).toHaveCount(1);
});
test("wire bend, waypoint Backspace, commit, escape and history restoration", async ({
  page,
}) => {
  await place(page, "Input", 100, 100);
  await place(page, "Output", 400, 300);
  await page.keyboard.press("w");
  const pins = page.locator('main [data-layer="pins"] [data-pin]');
  await pins.nth(0).click();
  await clickWorld(page, 220, 200);
  const ghost = page.locator('main [data-layer="preview"] polyline');
  await page.keyboard.press("Backspace");
  const before = await ghost.getAttribute("points");
  await page.keyboard.press("Shift+Space");
  expect(await ghost.getAttribute("points")).not.toBe(before);
  await expect(page.locator("main svg")).toHaveAttribute(
    "data-operation",
    "WIRE_DRAFT",
  );
  await pins.nth(1).click();
  await expect(page.locator("main [data-wire]")).toHaveCount(1);
  await page.keyboard.press("Control+z");
  await expect(page.locator("main [data-wire]")).toHaveCount(0);
  await page.keyboard.press("Control+y");
  await expect(page.locator("main [data-wire]")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(page.locator("main svg")).toHaveAttribute("data-tool", "SELECT");
});
test("text fields, IME, Tab and autorepeat protect circuit input", async ({
  page,
}) => {
  await place(page, "AND", 200, 200);
  const comp = page.locator('main [data-layer="symbols"] [data-component]');
  const original = await comp.getAttribute("transform");
  const input = page.getByRole("textbox", { name: "프로젝트 이름" });
  await input.fill("R");
  await input.press("r");
  await input.press("Control+z");
  await expect(comp).toHaveAttribute("transform", original!);
  const svg = page.locator("main svg");
  await svg.focus();
  await svg.dispatchEvent("keydown", {
    code: "KeyR",
    key: "r",
    isComposing: true,
  });
  await svg.dispatchEvent("keydown", { code: "KeyR", key: "r", repeat: true });
  await expect(comp).toHaveAttribute("transform", original!);
  await page.keyboard.press("a");
  await page.getByRole("textbox", { name: "부품 검색어" }).fill("input");
  await page.keyboard.press("Enter");
  await expect(svg).toHaveAttribute("data-operation", "PLACE");
  await page.keyboard.press("Tab");
  await expect(svg).toHaveAttribute("data-operation", "PLACE");
  await svg.focus();
  await page.keyboard.press("Escape");
  await expect(comp).toHaveCount(1);
});
test("pan keeps a stable draft and capture loss rolls back a drag", async ({
  page,
}) => {
  await place(page, "AND", 200, 200);
  const svg = page.locator("main svg");
  const box = (await svg.boundingBox())!;
  await page.keyboard.press("m");
  await page.keyboard.down("Space");
  await page.mouse.move(box.x + 500, box.y + 400);
  await page.mouse.down();
  await page.mouse.move(box.x + 540, box.y + 420);
  await page.mouse.up();
  await page.keyboard.up("Space");
  await expect(svg).toHaveAttribute("data-operation", "MOVE");
  await page.keyboard.press("Escape");
  const comp = page.locator('main [data-layer="symbols"] [data-component]');
  const original = await comp.getAttribute("transform");
  await comp.click();
  await page.mouse.move(box.x + 240, box.y + 220);
  await page.mouse.down();
  await page.mouse.move(box.x + 300, box.y + 250);
  await svg.dispatchEvent("pointercancel");
  await page.mouse.up();
  await expect(svg).toHaveAttribute("data-operation", "NONE");
  await expect(comp).toHaveAttribute("transform", original!);
});
