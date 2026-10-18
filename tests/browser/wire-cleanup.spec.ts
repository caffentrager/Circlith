import { test, expect, type Page } from "@playwright/test";

async function pointer(page: Page, x: number, y: number, click = true) {
  const b = (await page.locator("main svg").boundingBox())!;
  if (click) await page.mouse.click(b.x + x, b.y + y); else await page.mouse.move(b.x + x, b.y + y);
}
async function place(page: Page, kind: string, x: number, y: number) {
  await page.locator(".library").getByRole("button", { name: kind, exact: true }).click(); await pointer(page, x, y);
}
async function wires(page: Page) {
  return page.locator("main [data-wire]").evaluateAll((els) => els.map((e) => ({ id: e.getAttribute("data-wire"), points: e.getAttribute("points") })).sort((a, b) => a.id!.localeCompare(b.id!)));
}
async function fixture(page: Page) {
  await page.goto(process.env.CIRCLITH_BASE_PATH ?? "/");
  await place(page, "Input", 200, 100); await page.keyboard.press("Shift+r");
  await place(page, "Output", 200, 450); await page.keyboard.press("Shift+r");
  const pins = page.locator('main [data-layer="pins"] [data-pin]'); await pins.nth(0).click(); await pins.nth(1).click();
  await page.keyboard.press("Escape"); await pointer(page, 200, 220, false); await page.keyboard.press("w");
  await pointer(page, 240, 220); await pointer(page, 240, 320); await pointer(page, 200, 320); await page.keyboard.press("Escape");
  await expect(page.locator("main [data-wire]")).toHaveCount(4);
  await pointer(page, 240, 270);
  return page.locator("main svg");
}

test("the reported loop previews red removal and green retention, then cleans in one Undo with exact restoration", async ({ page }) => {
  const svg = await fixture(page), before = await wires(page), junctions = await page.locator("main [data-junction]").evaluateAll((els) => els.map((e) => e.outerHTML));
  const selected = await page.locator("main .wire.selected").getAttribute("data-wire");
  await page.getByRole("button", { name: /^연결망 중복 정리/ }).click();
  await expect(svg).toHaveAttribute("data-operation", "WIRE_CLEANUP"); await expect(page.locator("[data-cleanup-remove]")).toHaveAttribute("data-cleanup-remove", selected!);
  await expect(page.locator("[data-cleanup-keep]")).toHaveCount(1); expect(await wires(page)).toEqual(before);
  await expect(page.getByRole("region", { name: "중복 우회 정리 미리보기" })).toBeVisible();
  await expect(page.getByText("제거할 배선 1개의 수동 경유점도 함께 정리합니다.")).toBeVisible();
  await expect(page.getByText("6 committed edits")).toBeVisible(); await page.screenshot({ path: "build/wire-cleanup-preview.png" });
  await page.keyboard.press("Enter"); await expect(svg).toHaveAttribute("data-operation", "NONE");
  await expect(page.locator("main [data-wire]")).toHaveCount(3); await expect(page.getByText("7 committed edits")).toBeVisible();
  expect(await wires(page)).toEqual(before.filter((w) => w.id !== selected));
  expect(await page.locator("main [data-junction]").evaluateAll((els) => els.map((e) => e.outerHTML))).toEqual(junctions);
  await expect(svg).toHaveAttribute("data-net-count", "1"); await expect(page.locator("main .pin.connected")).toHaveCount(2);
  const after = await wires(page); await page.screenshot({ path: "build/wire-cleanup-after.png" });
  await page.keyboard.press("Control+z"); expect(await wires(page)).toEqual(before);
  await page.keyboard.press("Control+y"); expect(await wires(page)).toEqual(after);
});

test("Escape, draft Undo and the cancel button discard only the cleanup preview", async ({ page }) => {
  const svg = await fixture(page), before = await wires(page);
  for (const cancel of ["Escape", "Control+z", "button", "focused-button"]) {
    await page.getByRole("button", { name: /^연결망 중복 정리/ }).click();
    if (cancel === "button") await page.getByRole("button", { name: "정리 취소", exact: true }).click();
    else if (cancel === "focused-button") { await page.getByRole("button", { name: "정리 적용", exact: true }).focus(); await page.keyboard.press("Escape"); }
    else await page.keyboard.press(cancel);
    await expect(svg).toHaveAttribute("data-operation", "NONE"); expect(await wires(page)).toEqual(before);
    await expect(page.getByText("6 committed edits")).toBeVisible(); await expect(page.locator("[data-cleanup-remove]")).toHaveCount(0);
  }
  await page.getByRole("button", { name: /^연결망 중복 정리/ }).click();
  await page.getByRole("button", { name: "정리 적용", exact: true }).click();
  await expect(page.locator("main [data-wire]")).toHaveCount(3);
  await page.getByRole("button", { name: /^연결망 중복 정리/ }).click();
  await expect(page.getByRole("status")).toContainText("중복 배선이 없습니다");
  await expect(page.getByText("7 committed edits")).toBeVisible();
});

test("a real branch on the detour is preserved and cannot be mistaken for a redundant parallel edge", async ({ page }) => {
  const svg = await fixture(page); await place(page, "Output", 600, 270);
  await page.locator('main [data-layer="pins"] [data-pin]').nth(2).click(); await pointer(page, 240, 270); await page.keyboard.press("Escape");
  await expect(page.locator("main [data-wire]")).toHaveCount(6); await expect(svg).toHaveAttribute("data-junction-count", "3");
  await pointer(page, 200, 270); const before = await wires(page);
  await page.getByRole("button", { name: /^연결망 중복 정리/ }).click();
  await expect(page.getByRole("status")).toContainText("중간 분기가 있는 경로는 보존합니다");
  await expect(svg).toHaveAttribute("data-operation", "NONE"); expect(await wires(page)).toEqual(before);
  await expect(page.locator("main .pin.connected")).toHaveCount(3);
});
