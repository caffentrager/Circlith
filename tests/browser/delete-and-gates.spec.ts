import { test, expect, type Page } from "@playwright/test";
async function click(page: Page, x: number, y: number) {
  const b = (await page.locator("main svg").boundingBox())!;
  await page.mouse.click(b.x + x, b.y + y);
}
async function place(page: Page, kind: string, x: number, y: number) {
  await page
    .locator(".library")
    .getByRole("button", { name: kind, exact: true })
    .click();
  await click(page, x, y);
}
async function wireFixture(page: Page) {
  await place(page, "Input", 100, 100);
  await place(page, "Output", 400, 300);
  const pins = page.locator("main [data-pin]");
  await pins.nth(0).click();
  await pins.nth(1).click();
  await page.keyboard.press("Escape");
  return page.locator("main [data-wire]");
}
test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("AND OR NOT render recognizable shapes, correct pins, place and rotate independently", async ({
  page,
}) => {
  for (const [kind, x] of [
    ["AND", 150],
    ["OR", 350],
    ["NOT", 550],
  ] as const)
    await place(page, kind, x, 200);
  for (const kind of ["AND", "OR", "NOT"])
    await expect(page.locator(`main [data-gate-shape="${kind}"]`)).toHaveCount(
      1,
    );
  await expect(page.locator("main [data-inversion-bubble]")).toHaveCount(1);
  await expect(page.locator("main [data-pin]")).toHaveCount(8);
  await page.keyboard.press("r");
  await expect(page.locator("main [data-component]").last()).toHaveAttribute(
    "transform",
    "translate(550 200) rotate(270)",
  );
  await page.keyboard.press("Control+z");
  await expect(page.locator("main [data-component]").last()).toHaveAttribute(
    "transform",
    "translate(550 200) rotate(0)",
  );
});
test("component Delete preserves external wire and dangling endpoint; wire Delete and Undo restore exactly", async ({
  page,
}) => {
  const wire = await wireFixture(page),
    original = await wire.getAttribute("points");
  await page.keyboard.press("Delete");
  await expect(page.locator("main [data-component]")).toHaveCount(1);
  await expect(wire).toHaveAttribute("points", original!);
  await expect(page.locator("main svg")).toHaveAttribute(
    "data-junction-count",
    "1",
  );
  await page.keyboard.press("Control+z");
  await expect(page.locator("main [data-component]")).toHaveCount(2);
  await expect(page.locator("main svg")).toHaveAttribute(
    "data-junction-count",
    "0",
  );
  await click(page, 240, 100);
  await page.keyboard.press("Delete");
  await expect(wire).toHaveCount(0);
  await expect(page.locator("main [data-component]")).toHaveCount(2);
  await expect(page.locator("main svg")).toHaveAttribute("data-net-count", "0");
  await page.keyboard.press("Control+z");
  await expect(wire).toHaveAttribute("points", original!);
  await page.keyboard.press("Control+y");
  await expect(wire).toHaveCount(0);
});
test("multi-select delete is one Undo; text and wire draft do not delete selected objects", async ({
  page,
}) => {
  await place(page, "OR", 200, 200);
  await place(page, "NOT", 500, 200);
  await page.getByRole("textbox", { name: "프로젝트 이름" }).fill("Edit");
  await page.keyboard.press("Delete");
  await expect(page.locator("main [data-component]")).toHaveCount(2);
  await page.locator("main svg").focus();
  await page.keyboard.press("Control+a");
  await page.keyboard.press("Delete");
  await expect(page.locator("main [data-component]")).toHaveCount(0);
  await page.keyboard.press("Control+z");
  await expect(page.locator("main [data-component]")).toHaveCount(2);
  await page.locator("main [data-pin]").first().click();
  await page.keyboard.press("Delete");
  await expect(page.locator("main [data-component]")).toHaveCount(2);
  await expect(page.locator("main svg")).toHaveAttribute(
    "data-operation",
    "WIRE_DRAFT",
  );
});
test("click checkpoints are visible and Backspace/Escape remove draft markers without modifying circuit", async ({
  page,
}) => {
  await place(page, "Input", 100, 100);
  await place(page, "Output", 500, 300);
  await page.locator("main [data-pin]").first().click();
  await click(page, 240, 170);
  await expect(page.locator("[data-draft-waypoint]")).toHaveCount(1);
  await click(page, 320, 230);
  await expect(page.locator("[data-draft-waypoint]")).toHaveCount(2);
  await page.keyboard.press("Backspace");
  await expect(page.locator("[data-draft-waypoint]")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-draft-waypoint]")).toHaveCount(0);
  await expect(page.locator("main [data-wire]")).toHaveCount(0);
  await expect(page.locator("header")).toHaveAttribute("data-edit-count", "2");
});
test("selecting a finished corner and Delete removes only that corner and one Undo restores geometry", async ({
  page,
}) => {
  const wire = await wireFixture(page),
    original = await wire.getAttribute("points");
  await click(page, 240, 100);
  const handle = page.locator('[data-wire-handle][data-kind="corner"]').first();
  await handle.click();
  await expect(handle).toHaveClass(/active-corner/);
  await page.keyboard.press("Delete");
  await expect(wire).toHaveCount(1);
  await expect(wire).not.toHaveAttribute("points", original!);
  await expect(page.locator("main svg")).toHaveAttribute("data-net-count", "1");
  await expect(page.locator("main [data-component]")).toHaveCount(2);
  await page.keyboard.press("Control+z");
  await expect(wire).toHaveAttribute("points", original!);
});
test("wider near-wire candidate can be clicked to start a branch without auto-connecting", async ({
  page,
}) => {
  const wire = await wireFixture(page);
  const b = (await page.locator("main svg").boundingBox())!;
  await page.mouse.move(b.x + 600, b.y + 400);
  await page.keyboard.press("w");
  await page.mouse.move(b.x + 240, b.y + 111);
  await expect(page.locator("main svg")).toHaveAttribute(
    "data-snap-kind",
    "wire",
  );
  await page.mouse.click(b.x + 240, b.y + 111);
  await expect(page.locator("main svg")).toHaveAttribute(
    "data-operation",
    "WIRE_DRAFT",
  );
  await expect(wire).toHaveCount(1);
  await expect(page.locator("main svg")).toHaveAttribute(
    "data-junction-count",
    "0",
  );
  await page.keyboard.press("Escape");
});
test("clicking near a crossing exposes a common-point choice and joins only after explicit confirmation", async ({
  page,
}) => {
  await place(page, "Input", 100, 100);
  await place(page, "Output", 400, 100);
  let pins = page.locator("main [data-pin]");
  await pins.nth(0).click();
  await pins.nth(1).click();
  await page.keyboard.press("Escape");
  await place(page, "Input", 240, 20);
  await page.keyboard.press("Shift+r");
  await place(page, "Output", 240, 300);
  await page.keyboard.press("Shift+r");
  pins = page.locator("main [data-pin]");
  await pins.nth(2).click();
  await pins.nth(3).click();
  await page.keyboard.press("Escape");
  const canvas = page.locator("main svg"),
    b = (await canvas.boundingBox())!;
  await page.mouse.move(b.x + 600, b.y + 400);
  await page.keyboard.press("w");
  await page.mouse.move(b.x + 246, b.y + 106);
  await expect(canvas).toHaveAttribute("data-snap-kind", "ambiguous");
  await expect(canvas).toHaveAttribute("data-net-count", "2");
  await expect(canvas).toHaveAttribute("data-junction-count", "0");
  await page.mouse.click(b.x + 246, b.y + 106);
  await page
    .getByRole("button", { name: "이 교차점을 접속", exact: true })
    .click();
  await expect(canvas).toHaveAttribute("data-net-count", "1");
  await expect(canvas).toHaveAttribute("data-junction-count", "1");
  await page.keyboard.press("Control+z");
  await expect(canvas).toHaveAttribute("data-net-count", "2");
});
