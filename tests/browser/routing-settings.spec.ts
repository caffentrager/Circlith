import { test, expect, type Page } from "@playwright/test";

async function point(page: Page, x: number, y: number) {
  const b = (await page.locator("main svg").boundingBox())!; return { x: b.x + x, y: b.y + y };
}
async function part(page: Page, kind: string, x: number, y: number) {
  await page.locator(".library").getByRole("button", { name: kind, exact: true }).click();
  const p = await point(page, x, y); await page.mouse.click(p.x, p.y);
}
async function settings(page: Page, mode: string, overlap = "avoid") {
  await page.getByRole("button", { name: "설정", exact: true }).click();
  const d = page.getByRole("dialog", { name: "Input & Controls" });
  await d.getByLabel("경로 생성 방식").selectOption(mode); await d.getByLabel("부품과 겹칠 때").selectOption(overlap);
  await d.getByRole("button", { name: "닫기", exact: true }).click();
}
async function connect(page: Page) {
  const pins = page.locator('main [data-layer="pins"] [data-pin]');
  await pins.nth(0).click(); await pins.nth(1).click(); await page.keyboard.press("Escape");
}
async function drag(page: Page, x: number, y: number, dx: number, dy: number) {
  const a = await point(page, x, y), b = await point(page, dx, dy);
  await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move(b.x, b.y, { steps: 5 });
}
test.beforeEach(async ({ page }) => { await page.goto(process.env.CIRCLITH_BASE_PATH ?? "/"); });

test("routing choices change new routes, persist independently of controls, and leave existing wires untouched", async ({ page }) => {
  const svg = page.locator("main svg"); await expect(svg).toHaveAttribute("data-routing-mode", "smart");
  await part(page, "Input", 100, 100); await part(page, "Output", 400, 300);
  await settings(page, "horizontal", "warn"); await connect(page);
  const wire = page.locator("main [data-wire]"); await expect(wire).toHaveAttribute("points", "140,100 360,100 360,300");
  await settings(page, "vertical"); await expect(wire).toHaveAttribute("points", "140,100 360,100 360,300");
  const p = await point(page, 220, 100); await page.mouse.click(p.x, p.y);
  if (!await page.locator(".advanced-wire-tools").getAttribute("open").then(v => v !== null)) await page.locator(".advanced-wire-tools summary").click();
  await page.getByRole("button", { name: "설정대로 정리", exact: true }).click();
  await expect(wire).toHaveAttribute("points", "140,100 140,300 360,300");
  await page.keyboard.press("Control+z"); await expect(wire).toHaveAttribute("points", "140,100 360,100 360,300");
  await page.reload(); await expect(svg).toHaveAttribute("data-routing-mode", "vertical");
  await page.getByRole("button", { name: "설정", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Input & Controls" });
  await expect(dialog.getByLabel("경로 생성 방식")).toHaveValue("vertical"); await expect(dialog.getByLabel("부품과 겹칠 때")).toHaveValue("avoid");
  await dialog.getByRole("button", { name: "배선 설정 초기화" }).click();
  await expect(dialog.getByLabel("경로 생성 방식")).toHaveValue("smart");
  await page.screenshot({ path: "build/routing-settings.png" });
});

test("smart routing avoids bodies, warn mode reveals hidden wires, and moving an obstacle reroutes with one Undo", async ({ page }) => {
  await part(page, "Input", 100, 200); await part(page, "Output", 600, 200); await part(page, "AND", 330, 200);
  await connect(page); const wire = page.locator("main [data-wire]");
  await expect(page.locator('[data-layer="wire-collisions"] polyline')).toHaveCount(0);
  const routed = await wire.getAttribute("points"); expect(routed).not.toBe("140,200 560,200");
  await page.screenshot({ path: "build/routing-auto.png" });
  await page.keyboard.press("Control+z"); await settings(page, "horizontal", "warn"); await connect(page);
  await expect(wire).toHaveAttribute("points", "140,200 560,200");
  await expect(page.locator('[data-layer="wire-collisions"] polyline')).toHaveCount(1);
  await expect(page.getByText("부품과 겹치는 배선이 있습니다. 점선으로 표시했습니다.")).toBeVisible();
  await settings(page, "smart"); await drag(page, 330, 200, 330, 210); await page.mouse.up();
  await expect(page.locator('[data-layer="wire-collisions"] polyline')).toHaveCount(0);
  expect(await wire.getAttribute("points")).not.toBe("140,200 560,200");
  await page.keyboard.press("Control+z"); await expect(wire).toHaveAttribute("points", "140,200 560,200");
  await page.screenshot({ path: "build/routing-warning.png" });
});

test("group drag rotates the selected components together and reverses the entire gesture in one Undo", async ({ page }) => {
  await part(page, "Input", 100, 150); await part(page, "Output", 400, 250); await connect(page);
  const svg = page.locator("main svg"), components = page.locator('main [data-layer="symbols"] [data-component]'), wire = page.locator("main [data-wire]");
  const before = await components.evaluateAll((els) => els.map((e) => e.getAttribute("transform"))), original = await wire.getAttribute("points");
  await svg.focus(); await page.keyboard.press("Control+a"); await drag(page, 100, 150, 150, 200); await page.keyboard.press("r");
  await expect(components.nth(0)).toHaveAttribute("transform", "translate(250 400) rotate(270)");
  await expect(components.nth(1)).toHaveAttribute("transform", "translate(350 100) rotate(270)");
  await expect(svg).toHaveAttribute("data-routing-blocked", "false"); await page.mouse.up();
  await expect(page.locator("header")).toHaveAttribute("data-edit-count", "4"); await page.keyboard.press("Control+z");
  expect(await components.evaluateAll((els) => els.map((e) => e.getAttribute("transform")))).toEqual(before);
  await expect(wire).toHaveAttribute("points", original!);
});

test("corrupt routing storage recovers visibly and unavailable storage still applies settings to the session", async ({ page }) => {
  await page.evaluate(() => localStorage.setItem("circlith.simulation.routing.v1", '{"version":9}'));
  await page.reload(); await expect(page.getByRole("status")).toContainText("배선 설정을 복구하지 못해 기본값");
  await expect(page.locator("main svg")).toHaveAttribute("data-routing-mode", "smart");
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw new Error("disabled"); }; });
  await settings(page, "vertical", "warn");
  await expect(page.getByRole("status")).toContainText("브라우저 저장에 실패");
  await expect(page.locator("main svg")).toHaveAttribute("data-routing-mode", "vertical");
});

test("dragging supports R and Shift+R, ignores repeats and composing keys, and commits one Undo with attached wires", async ({ page }) => {
  await part(page, "Input", 100, 150); await part(page, "Output", 500, 300); await connect(page);
  const comp = page.locator('main [data-layer="symbols"] [data-component]').first(), wire = page.locator("main [data-wire]"), svg = page.locator("main svg");
  const original = await wire.getAttribute("points"), before = await comp.getAttribute("transform");
  await drag(page, 100, 150, 180, 210); await page.keyboard.press("r"); await page.keyboard.press("r"); await page.keyboard.press("Shift+r");
  await expect(comp).toHaveAttribute("transform", "translate(180 210) rotate(270)");
  await svg.dispatchEvent("keydown", { key: "r", code: "KeyR", repeat: true });
  await svg.dispatchEvent("keydown", { key: "r", code: "KeyR", isComposing: true });
  await expect(comp).toHaveAttribute("transform", "translate(180 210) rotate(270)");
  await expect(page.locator("header")).toHaveAttribute("data-edit-count", "3");
  await expect(wire).toHaveAttribute("points", /^180,170 /); await expect(svg).toHaveAttribute("data-routing-blocked", "false");
  await page.mouse.up(); const after = await wire.getAttribute("points");
  await expect(page.locator("header")).toHaveAttribute("data-edit-count", "4"); await page.keyboard.press("Control+z");
  await expect(comp).toHaveAttribute("transform", before!); await expect(wire).toHaveAttribute("points", original!);
  await page.keyboard.press("Control+y"); await expect(wire).toHaveAttribute("points", after!);
  await page.screenshot({ path: "build/drag-rotation.png" });
});

test("rotated drag cancels safely on Escape, Undo, Tab, capture loss, blur, and outside release", async ({ page }) => {
  await part(page, "AND", 200, 200);
  const comp = page.locator('main [data-layer="symbols"] [data-component]'), svg = page.locator("main svg");
  for (const cancel of ["Escape", "Control+z", "Tab", "capture", "blur", "outside"]) {
    await svg.focus(); await drag(page, 200, 200, 280, 260); await page.keyboard.press("r");
    await expect(comp).toHaveAttribute("transform", "translate(280 260) rotate(270)");
    if (cancel === "capture") await svg.dispatchEvent("lostpointercapture");
    else if (cancel === "blur") await page.evaluate(() => window.dispatchEvent(new Event("blur")));
    else if (cancel === "outside") await page.mouse.move(20, 20);
    else await page.keyboard.press(cancel);
    await page.mouse.up(); await expect(comp).toHaveAttribute("transform", "translate(200 200) rotate(0)");
    await expect(svg).toHaveAttribute("data-operation", "NONE"); await expect(page.locator("header")).toHaveAttribute("data-edit-count", "1");
  }
});

test("a trapped manual waypoint blocks commit with visible feedback and remains cancellable", async ({ page }) => {
  await part(page, "Input", 100, 200); await part(page, "Output", 600, 200); await part(page, "AND", 330, 200);
  const pins = page.locator('main [data-layer="pins"] [data-pin]'); await pins.nth(0).click();
  const p = await point(page, 330, 200); await page.mouse.click(p.x, p.y); await pins.nth(1).click();
  await expect(page.locator("main [data-wire]")).toHaveCount(0);
  await expect(page.locator("main svg")).toHaveAttribute("data-routing-blocked", "true");
  await expect(page.getByRole("alert")).toContainText("우회할 수 없습니다");
  await page.keyboard.press("Escape"); await expect(page.locator("header")).toHaveAttribute("data-edit-count", "3");
});
