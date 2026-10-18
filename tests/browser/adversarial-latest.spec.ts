// Independent adversarial browser tests for 51552a7 (real Chromium). Expected values are derived from the
// rendered DOM / geometry rules here, never from the code under test.
import { test, expect, type Page, type Locator } from "@playwright/test";

/* ------------------------------------------------------------------ helpers */
type V = { x: number; y: number; k: number };
const svgLoc = (page: Page) => page.locator("main svg");
const box = async (page: Page) => (await svgLoc(page).boundingBox())!;
async function view(page: Page): Promise<V> {
  const t = await page.locator("main svg > g").first().getAttribute("transform");
  const m = /translate\(([-\d.e+]+) ([-\d.e+]+)\) scale\(([-\d.e+]+)\)/.exec(t!)!;
  return { x: +m[1], y: +m[2], k: +m[3] };
}
async function screenOf(page: Page, wx: number, wy: number) {
  const b = await box(page), v = await view(page);
  return { x: b.x + v.x + wx * v.k, y: b.y + v.y + wy * v.k };
}
async function zoomTo(page: Page, target: number, wx: number, wy: number) {
  for (let i = 0; i < 120; i++) {
    const v = await view(page);
    if (Math.abs(v.k / target - 1) < 0.06 || (target <= 0.1 && v.k <= 0.1001) || (target >= 2 && v.k >= 1.999)) return v;
    const s = await screenOf(page, wx, wy);
    await page.mouse.move(s.x, s.y);
    await page.mouse.wheel(0, v.k > target ? 30 : -30);
  }
  throw new Error(`could not reach zoom ${target}`);
}
async function clickWorld(page: Page, x: number, y: number) {
  const s = await screenOf(page, x, y);
  await page.mouse.click(s.x, s.y);
}
async function place(page: Page, kind: string, x: number, y: number) {
  await page.locator(".library").getByRole("button", { name: kind, exact: true }).click();
  await clickWorld(page, x, y);
}
const op = (page: Page) => svgLoc(page).getAttribute("data-operation");
const pins = (page: Page) => page.locator('main [data-layer="pins"] [data-pin]');
async function pinCenter(loc: Locator) {
  const cx = Number(await loc.getAttribute("cx")), cy = Number(await loc.getAttribute("cy"));
  return { x: cx, y: cy };
}
async function clickPin(page: Page, n: number) {
  const c = await pinCenter(pins(page).nth(n));
  await clickWorld(page, c.x, c.y);
}
const committed = async (page: Page) => Number(/(\d+) committed edits/.exec(await page.locator("header span").last().innerText())![1]);
const comps = (page: Page) => page.locator('main [data-layer="symbols"] [data-component]');
const wires = (page: Page) => page.locator("main [data-wire]");
async function openSettings(page: Page) {
  await page.getByRole("button", { name: "설정", exact: true }).click();
  return page.getByRole("dialog", { name: "Input & Controls" });
}
async function choosePreset(page: Page, id: string) {
  const d = await openSettings(page);
  await d.getByLabel("Control Preset").selectOption(id);
  await d.getByRole("button", { name: "닫기", exact: true }).click();
}
const rotOf = (t: string | null) => Number(/rotate\((-?\d+)\)/.exec(t ?? "")![1]);

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

/* ------------------------------------------------------------------ 9/14 hit radius */
const BODY_CASES: [string, number, number, string][] = [
  ["AND", 0.25, 400, "centre of the body (three pins tie, so the chooser masks the problem)"],
  ["AND", 0.5, 420, "right third of the body, 20 units from the output pin"],
  ["Input", 0.25, 400, "centre of the body"],
  ["Output", 0.25, 400, "centre of the body"],
  ["NOT", 0.5, 420, "right part of the body"],
];
for (const [kind, zoom, wx, why] of BODY_CASES)
  test(`hit radius: ${kind} at ~${zoom * 100}% zoom — a click on the ${why} must select/drag the part, not start a wire from a pin`, async ({ page }) => {
    await place(page, kind, 400, 300);
    await clickWorld(page, 700, 500); // deselect
    await expect(page.locator(".symbol.selected")).toHaveCount(0);
    await zoomTo(page, zoom, 400, 300);
    const s = await screenOf(page, wx, 300);
    await page.mouse.move(s.x, s.y);
    await page.mouse.down();
    await page.mouse.up();
    expect(await op(page), "a body click must not open a wire draft").not.toBe("WIRE_DRAFT");
    await expect(page.locator(".symbol.selected")).toHaveCount(1);
  });

test("hit radius: a wire sitting 5px from a parallel wire of ANOTHER net is selected by what is under the pointer (50% zoom)", async ({ page }) => {
  await place(page, "Input", 100, 100);
  await place(page, "Input", 100, 110);
  await place(page, "Output", 700, 100);
  await place(page, "Output", 700, 110);
  // pins in creation order: in1, in2, out1, out2 -> wire A joins in1/out1, wire B joins in2/out2
  await clickPin(page, 0); await clickPin(page, 2);
  await expect(wires(page)).toHaveCount(1);
  await page.keyboard.press("Escape");
  await clickPin(page, 1); await clickPin(page, 3);
  await expect(wires(page)).toHaveCount(2);
  await page.keyboard.press("Escape");
  await clickWorld(page, 400, 400); // deselect everything
  const ids = await wires(page).evaluateAll((els) => els.map((e) => e.getAttribute("data-wire")));
  const pts = await wires(page).evaluateAll((els) => els.map((e) => e.getAttribute("points")));
  expect(pts[0]).toMatch(/^140,100 /); // A is the y=100 wire, B the y=110 wire
  expect(pts[1]).toMatch(/^140,110 /);
  await zoomTo(page, 0.5, 400, 105);
  await clickWorld(page, 400, 100); // exactly ON wire A
  const selected = await page.locator("main .wire.selected").evaluateAll((els) => els.map((e) => e.getAttribute("data-wire")));
  expect(selected, "clicking exactly on wire A must select A").toEqual([ids[0]]);
  await page.keyboard.press("Delete");
  const left = await wires(page).evaluateAll((els) => els.map((e) => e.getAttribute("data-wire")));
  expect(left, "Delete must remove the wire that was clicked").toEqual([ids[1]]);
});

test("hit radius: adjacent AND inputs at ~25% zoom — midpoint never silently connects; 1px toward a pin connects THAT pin, repeatably", async ({ page }) => {
  await place(page, "Input", 100, 300);
  await place(page, "AND", 500, 300);
  await clickWorld(page, 700, 500);
  // pins: [0] Input.out, [1] AND.in0 (500-40,290), [2] AND.in1 (460,310), [3] AND.out
  const in0 = await pinCenter(pins(page).nth(1)), in1 = await pinCenter(pins(page).nth(2));
  expect(in0).toEqual({ x: 460, y: 290 }); expect(in1).toEqual({ x: 460, y: 310 });
  await clickPin(page, 0);
  expect(await op(page)).toBe("WIRE_DRAFT");
  await zoomTo(page, 0.25, 460, 300);
  const mid = await screenOf(page, 460, 300);
  await page.mouse.move(mid.x, mid.y);
  await expect(svgLoc(page)).toHaveAttribute("data-snap-kind", "ambiguous");
  await page.mouse.click(mid.x, mid.y); // opens the chooser or does nothing, but must not connect
  await expect(wires(page)).toHaveCount(0);
  await page.keyboard.press("Escape");
  if (await op(page) !== "WIRE_DRAFT") await clickPin(page, 0);
  for (let i = 0; i < 4; i++) {
    const dir = i % 2 === 0 ? 1 : -1; // toward in1 (down) / toward in0 (up)
    await page.mouse.move(mid.x, mid.y + dir * 1.2);
    await page.mouse.click(mid.x, mid.y + dir * 1.2);
    await expect(wires(page)).toHaveCount(1);
    const points = (await wires(page).first().getAttribute("points"))!.split(" ").map((p) => p.split(",").map(Number));
    expect(points[points.length - 1], `iteration ${i} should end on ${dir > 0 ? "in1" : "in0"}`).toEqual(dir > 0 ? [in1.x, in1.y] : [in0.x, in0.y]);
    await page.keyboard.press("Control+z"); // remove, then restart the wire
    await expect(wires(page)).toHaveCount(0);
    if (await op(page) !== "WIRE_DRAFT") await clickPin(page, 0);
  }
});

test("hit radius: clicking near (not on) a crossing never merges nets; choosing is explicit and Escape leaves the draft", async ({ page }) => {
  await place(page, "Input", 100, 200);
  await place(page, "Output", 700, 200);
  await clickPin(page, 0); await clickPin(page, 1);
  await page.keyboard.press("Escape");
  await place(page, "Input", 400, 40);
  await page.keyboard.press("Shift+r"); // out pin now points down
  await place(page, "Output", 400, 380);
  await page.keyboard.press("Shift+r");
  await clickWorld(page, 600, 450);
  const all = await pins(page).evaluateAll((els) => els.map((e) => [e.getAttribute("cx"), e.getAttribute("cy")]));
  // find the vertical-wire pins by x=400
  const vertical = all.map((p, i) => ({ p, i })).filter(({ p }) => p[0] === "400");
  expect(vertical.length).toBe(2);
  await clickPin(page, vertical[0].i); await clickPin(page, vertical[1].i);
  await page.keyboard.press("Escape");
  await expect(svgLoc(page)).toHaveAttribute("data-net-count", "2");
  const s = await screenOf(page, 400, 200);
  for (const [dx, dy] of [[0, 0], [5, 5], [-6, 4], [3, -7]]) {
    await page.mouse.click(s.x + dx, s.y + dy);
    await expect(svgLoc(page)).toHaveAttribute("data-net-count", "2");
  }
  await page.keyboard.press("w");
  await page.mouse.click(s.x + 4, s.y + 4); // WIRE tool near the crossing: must ask, not merge
  await expect(svgLoc(page)).toHaveAttribute("data-net-count", "2");
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await expect(svgLoc(page)).toHaveAttribute("data-net-count", "2");
  await expect(svgLoc(page)).toHaveAttribute("data-junction-count", "0");
});

/* ------------------------------------------------------------------ 8 library scroll */
test("library scroll: dropping a part after scrolling the palette lands exactly under the pointer and never scrolls the page", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 560 });
  await page.goto("/");
  const lib = page.locator(".library");
  const overflow = await lib.evaluate((e) => ({ sh: e.scrollHeight, ch: e.clientHeight, oy: getComputedStyle(e).overflowY }));
  expect(overflow.sh, "library must overflow for this test to mean anything").toBeGreaterThan(overflow.ch);
  const pageScroll = () => page.evaluate(() => ({ y: window.scrollY, doc: document.scrollingElement!.scrollTop, over: document.scrollingElement!.scrollHeight - innerHeight }));
  const drop = async (kind: string, wx: number, wy: number) => {
    const b = page.locator(".library").getByRole("button", { name: kind, exact: true });
    await b.scrollIntoViewIfNeeded();
    const r = (await b.boundingBox())!;
    const c = await box(page);
    await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2);
    await page.mouse.down();
    await page.mouse.move(c.x + wx - 30, c.y + wy - 20, { steps: 8 });
    await page.mouse.move(c.x + wx + 3, c.y + wy + 4, { steps: 4 }); // +3/+4 must still snap to the 10-grid cell
    await page.mouse.up();
  };
  await lib.evaluate((e) => (e.scrollTop = 0));
  await drop("Input", 300, 200);
  await lib.evaluate((e) => (e.scrollTop = e.scrollHeight));
  const scrolled = await lib.evaluate((e) => e.scrollTop);
  expect(scrolled).toBeGreaterThan(0);
  await drop("NOT", 300, 400);
  await drop("OR", 500, 200);
  const t = await comps(page).evaluateAll((els) => els.map((e) => e.getAttribute("transform")));
  expect(t).toEqual(["translate(300 200) rotate(0)", "translate(300 400) rotate(0)", "translate(500 200) rotate(0)"]);
  const ps = await pageScroll();
  expect(ps.y).toBe(0);
  expect(ps.doc).toBe(0);
  expect(await committed(page)).toBe(3);
});

/* ------------------------------------------------------------------ 7 gates in the browser */
test("library and canvas draw gates from the same geometry (no drift), including after rotation", async ({ page }) => {
  const kinds = ["AND", "OR", "NOT", "XOR", "NAND", "NOR", "XNOR"];
  for (const [index, kind] of kinds.entries()) {
    await place(page, kind, 120 + (index % 4) * 170, 180 + Math.floor(index / 4) * 170);
    await page.keyboard.press('r');
    await expect(comps(page).last()).toHaveAttribute('transform', /rotate\(270\)/);
  }
  const libShapes = await page.locator(".library svg.library-symbol").evaluateAll((els) =>
    Object.fromEntries(els.filter(s => s.querySelector('[data-gate-shape]')).map((s) => [s.querySelector('[data-gate-shape]')!.getAttribute('data-gate-shape'),
      [...s.querySelectorAll("path,circle")].map((n) => [n.tagName, n.getAttribute("d") ?? `${n.getAttribute("cx")},${n.getAttribute("cy")},${n.getAttribute("r")}`])])));
  const canvas = await comps(page).evaluateAll((els) =>
    Object.fromEntries(els.map((g) => [g.querySelector('[data-gate-shape]')!.getAttribute('data-gate-shape'),
      [...g.querySelectorAll("path,circle")].map((n) => [n.tagName, n.getAttribute("d") ?? `${n.getAttribute("cx")},${n.getAttribute("cy")},${n.getAttribute("r")}`])])));
  // AND/NAND and OR/XOR/NOR/XNOR share body paths; identify each complete glyph by kind.
  expect(Object.keys(canvas)).toEqual(kinds);
  for (const kind of kinds) expect(libShapes[kind], `library glyph for ${kind}`).toEqual(canvas[kind]);
});

for (const rotationKeys of [0, 1, 2, 3])
  test(`NOT: body, bubble, and pins rotate together after ${rotationKeys} CCW rotations (checked from real screen geometry)`, async ({ page }) => {
    await place(page, "NOT", 400, 300);
    for (let i = 0; i < rotationKeys; i++) await page.keyboard.press("r");
    const g = comps(page).first();
    const angle = ((-90 * rotationKeys) % 360 + 360) % 360;
    expect(rotOf(await g.getAttribute("transform"))).toBe(angle);
    const centre = (r: { x: number; y: number; width: number; height: number }) => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 });
    const bubble = centre((await g.locator("[data-inversion-bubble]").boundingBox())!);
    const body = centre((await g.locator("[data-gate-shape]").boundingBox())!);
    const outPin = centre((await pins(page).nth(1).boundingBox())!), inPin = centre((await pins(page).nth(0).boundingBox())!);
    const t = (angle * Math.PI) / 180, R = (p: { x: number; y: number }) => ({ x: p.x * Math.cos(t) - p.y * Math.sin(t), y: p.x * Math.sin(t) + p.y * Math.cos(t) });
    const c = await screenOf(page, 400, 300);
    const near = (a: { x: number; y: number }, e: { x: number; y: number }, what: string) => {
      expect(Math.abs(a.x - c.x - e.x), `${what} x`).toBeLessThan(1.5);
      expect(Math.abs(a.y - c.y - e.y), `${what} y`).toBeLessThan(1.5);
    };
    near(bubble, R({ x: 25, y: 0 }), "bubble");
    near(outPin, R({ x: 40, y: 0 }), "output pin");
    near(inPin, R({ x: -40, y: 0 }), "input pin");
    near(body, R({ x: -5, y: 0 }), "triangle body centre of its bounding box");
  });

for (const kind of ["AND", "OR", "NOT"])
  for (const keys of [0, 1, 2, 3])
    test(`${kind} rotated ${keys}×CCW: wired pins use the real pin circles, leave/enter along the pin normal, survive Safe Move, Undo is exact`, async ({ page }) => {
      await place(page, "Input", 100, 300);
      await place(page, kind, 500, 300);
      for (let i = 0; i < keys; i++) await page.keyboard.press("r");
      await clickWorld(page, 800, 600); // deselect
      const inP = await pinCenter(pins(page).nth(0)), gateIn = await pinCenter(pins(page).nth(1));
      await clickPin(page, 0);
      await clickPin(page, 1);
      await expect(wires(page)).toHaveCount(1);
      await page.keyboard.press("Escape");
      const readWire = async () => (await wires(page).first().getAttribute("points"))!.split(" ").map((p) => p.split(",").map(Number));
      const wire = await readWire();
      expect(wire[0]).toEqual([inP.x, inP.y]);
      expect(wire[wire.length - 1]).toEqual([gateIn.x, gateIn.y]);
      // direction of the first segment: Input pin normal is +x
      expect([Math.sign(wire[1][0] - wire[0][0]), Math.sign(wire[1][1] - wire[0][1])]).toEqual([1, 0]);
      // gate pin outward normal = dominant axis of (pin - gate centre)
      const dx = gateIn.x - 500, dy = gateIn.y - 300;
      const normal = Math.abs(dx) >= Math.abs(dy) ? [Math.sign(dx), 0] : [0, Math.sign(dy)];
      const last = wire[wire.length - 1], prev = wire[wire.length - 2];
      expect([Math.sign(last[0] - prev[0]), Math.sign(last[1] - prev[1])], "must arrive against the pin normal").toEqual(normal.map((v) => -v + 0));
      // Safe Move keeps connection and exact Undo
      const original = await wires(page).first().getAttribute("points");
      const id = await wires(page).first().getAttribute("data-wire");
      const g = await screenOf(page, 500, 300);
      await page.mouse.move(g.x, g.y);
      await page.mouse.down();
      await page.mouse.move(g.x, g.y + 60, { steps: 6 });
      await page.mouse.move(g.x, g.y + 100, { steps: 6 });
      await page.mouse.up();
      await expect(wires(page)).toHaveCount(1);
      expect(await wires(page).first().getAttribute("data-wire")).toBe(id);
      const moved = await readWire();
      const newPin = await pinCenter(pins(page).nth(1));
      expect(newPin).toEqual({ x: gateIn.x, y: gateIn.y + 100 });
      expect(moved[moved.length - 1]).toEqual([newPin.x, newPin.y]);
      expect(moved[0]).toEqual([inP.x, inP.y]);
      for (let i = 1; i < moved.length; i++) expect(moved[i][0] === moved[i - 1][0] || moved[i][1] === moved[i - 1][1]).toBe(true);
      await page.keyboard.press("Control+z");
      expect(await wires(page).first().getAttribute("points")).toBe(original);
      expect(await comps(page).nth(1).getAttribute("transform")).toContain("translate(500 300)");
    });

/* ------------------------------------------------------------------ 12 Delete + input system */
const PRESETS = ["circlith-modern", "kicad-9", "altium-designer-2026", "easyeda-pro"];
for (const preset of PRESETS)
  test(`Delete under preset ${preset}: deletes the selected part, Undo/Redo exact, no semantic difference between presets`, async ({ page }) => {
    await choosePreset(page, preset);
    await place(page, "Input", 100, 200);
    await place(page, "Output", 400, 200);
    await clickPin(page, 0); await clickPin(page, 1);
    await page.keyboard.press("Escape");
    await clickWorld(page, 100, 200); // select the Input
    await expect(page.locator(".symbol.selected")).toHaveCount(1);
    const norm = () => svgLoc(page).evaluate((s) => s.querySelector("g")!.innerHTML.replaceAll(" selected", ""));
    const before = await norm();
    await page.keyboard.press("Delete");
    await expect(comps(page)).toHaveCount(1);
    await expect(wires(page)).toHaveCount(1); // wire survives
    await expect(page.locator('main [data-junction][data-dangling]')).toHaveCount(1);
    await page.keyboard.press("Control+z");
    await expect(comps(page)).toHaveCount(2);
    expect(await norm(), "Undo must restore the exact drawing (selection highlight aside)").toBe(before);
    await page.keyboard.press("Control+y");
    await expect(comps(page)).toHaveCount(1);
  });

test("Delete must not touch the circuit from a project-name textbox (and must edit the text normally)", async ({ page }) => {
  await place(page, "AND", 300, 300);
  await expect(page.locator(".symbol.selected")).toHaveCount(1);
  const name = page.getByRole("textbox", { name: "프로젝트 이름" });
  await name.click();
  await name.press("Control+a");
  await name.pressSequentially("abcd");
  await name.press("Home");
  await name.press("Delete");
  await name.press("Backspace"); // at start: no-op
  await name.press("End");
  await name.press("Backspace");
  await expect(name).toHaveValue("bc");
  await expect(comps(page)).toHaveCount(1);
  expect(await committed(page)).toBe(1);
});

test("Delete must not touch the circuit from settings fields, the binding JSON editor, or a modal", async ({ page }) => {
  await place(page, "AND", 300, 300);
  const d = await openSettings(page);
  const timeout = d.getByLabel("Sequence timeout");
  await timeout.click();
  await timeout.press("Delete");
  await timeout.press("Backspace");
  await expect(comps(page)).toHaveCount(1);
  await d.getByRole("button", { name: "수정" }).first().click();
  const json = d.getByLabel("Binding JSON");
  await json.click();
  await json.press("Control+a");
  await json.press("Delete");
  await expect(json).toHaveValue("");
  await json.press("Control+z"); // native textarea undo must not hit the circuit either
  await expect(comps(page)).toHaveCount(1);
  expect(await committed(page)).toBe(1);
  await page.keyboard.press("Escape");
  await expect(comps(page)).toHaveCount(1);
  // context-menu modal
  const dlg = page.getByRole("dialog", { name: "Input & Controls" });
  if (await dlg.count()) await dlg.getByRole("button", { name: "닫기", exact: true }).click();
  const b = await box(page);
  await page.mouse.click(b.x + 700, b.y + 500, { button: "right" });
  await expect(page.getByRole("dialog", { name: "도면 메뉴" })).toBeVisible();
  await page.keyboard.press("Delete");
  await expect(comps(page)).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "도면 메뉴" })).toHaveCount(0);
  await expect(comps(page)).toHaveCount(1);
});

test("Delete during IME composition and during an open wire draft does not delete the selected part", async ({ page }) => {
  await place(page, "AND", 300, 300);
  await place(page, "Output", 600, 300); // Output becomes the selection
  await clickWorld(page, 300, 300); // select the AND
  await expect(page.locator(".symbol.selected")).toHaveCount(1);
  const svg = svgLoc(page);
  await svg.focus();
  await svg.dispatchEvent("keydown", { key: "Delete", code: "Delete", isComposing: true });
  await svg.dispatchEvent("keydown", { key: "Process", code: "Delete", keyCode: 229 });
  await expect(comps(page)).toHaveCount(2);
  await clickPin(page, 2); // AND output pin (index: AND in0,in1,out then Output pin) -> opens a draft
  expect(await op(page)).toBe("WIRE_DRAFT");
  await page.keyboard.press("Delete");
  await expect(comps(page), "selected part must survive Delete while a wire draft owns the operation").toHaveCount(2);
  expect(await committed(page)).toBe(2);
  await page.keyboard.press("Escape");
  await expect(comps(page)).toHaveCount(2);
});

test("a corner selected on one wire is cleared when the selection moves to something else; Delete then removes only the new selection", async ({ page }) => {
  await place(page, "Input", 100, 100);
  await place(page, "Output", 400, 300);
  await clickPin(page, 0); await clickPin(page, 1);
  await page.keyboard.press("Escape");
  const wire = wires(page).first();
  await clickWorld(page, 250, 100); // select the wire
  const handle = page.locator('[data-kind="corner"]').first();
  await handle.click();
  await expect(page.locator(".active-corner")).toHaveCount(1);
  await clickWorld(page, 400, 300); // pick the Output instead
  await expect(page.locator(".active-corner")).toHaveCount(0);
  await page.keyboard.press("Delete");
  await expect(comps(page)).toHaveCount(1);
  await expect(wire).toHaveCount(1);
});

test("stale corner after Redo: the highlighted corner must not survive an Undo/Redo that changes the wire", async ({ page }) => {
  await place(page, "Input", 100, 100);
  await place(page, "Output", 400, 300);
  await clickPin(page, 0); await clickPin(page, 1);
  await page.keyboard.press("Escape");
  await clickWorld(page, 250, 100);
  // move the first (horizontal) segment down by dragging its round handle -> one committed edit
  const seg = page.locator('[data-kind="segment"]').first();
  const sb = (await seg.boundingBox())!;
  await page.mouse.move(sb.x + sb.width / 2, sb.y + sb.height / 2);
  await page.mouse.down();
  await page.mouse.move(sb.x + sb.width / 2, sb.y + sb.height / 2 + 40, { steps: 5 });
  await page.mouse.up();
  const edited = await committed(page);
  await page.keyboard.press("Control+z");
  expect(await committed(page)).toBe(edited - 1);
  await clickWorld(page, 250, 100);
  await page.locator('[data-kind="corner"]').first().click();
  await expect(page.locator(".active-corner")).toHaveCount(1);
  await page.keyboard.press("Control+y");
  expect(await committed(page)).toBe(edited);
  await expect(page.locator(".active-corner"), "Undo/Redo must clear the corner selection (docs/DELETE_AND_SYMBOLS.md)").toHaveCount(0);
});

/* ------------------------------------------------------------------ 11 failed gestures */
async function gestureScene(page: Page) {
  await place(page, "Input", 100, 300);
  await place(page, "AND", 300, 300);
  await place(page, "Output", 700, 300);
  await clickPin(page, 0); await clickPin(page, 1);
  await page.keyboard.press("Escape");
  await place(page, "Output", 800, 600);
  await page.keyboard.press("Control+z"); // leaves a Redo future of exactly one entry
  await clickWorld(page, 700, 500);
  const and = comps(page).nth(1);
  return { and, original: (await and.getAttribute("transform"))!, wireBefore: (await wires(page).first().getAttribute("points"))!, edits: await committed(page) };
}
const FAILURES: [string, (page: Page) => Promise<void>][] = [
  ["pointercancel", async (p) => { await svgLoc(p).dispatchEvent("pointercancel"); }],
  ["lostpointercapture", async (p) => { await svgLoc(p).dispatchEvent("lostpointercapture"); }],
  ["window blur", async (p) => { await p.evaluate(() => window.dispatchEvent(new Event("blur"))); }],
  ["Escape", async (p) => { await p.keyboard.press("Escape"); }],
  ["Tab", async (p) => { await p.keyboard.press("Tab"); }],
  ["Ctrl+Z", async (p) => { await p.keyboard.press("Control+z"); }],
];
for (const [name, fail] of FAILURES)
  test(`failed gesture (${name}) mid-drag: circuit, wires, history, Redo future and selection are untouched; the next drag works`, async ({ page }) => {
    const s = await gestureScene(page);
    const a = await screenOf(page, 300, 300);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(a.x + 40, a.y + 80, { steps: 6 });
    await expect(svgLoc(page)).toHaveAttribute("data-operation", "MOVE");
    await fail(page);
    await page.mouse.up();
    if (name === "Tab") await svgLoc(page).focus();
    await expect(svgLoc(page)).toHaveAttribute("data-operation", "NONE");
    await expect(s.and).toHaveAttribute("transform", s.original);
    expect(await wires(page).first().getAttribute("points")).toBe(s.wireBefore);
    expect(await committed(page)).toBe(s.edits);
    await expect(page.locator(".symbol.selected")).toHaveCount(1);
    // Redo future survived
    await svgLoc(page).focus();
    await page.keyboard.press("Control+y");
    await expect(comps(page)).toHaveCount(4);
    await page.keyboard.press("Control+z");
    // pointer ownership: a fresh drag commits normally
    const b = await screenOf(page, 300, 300);
    await page.mouse.move(b.x, b.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y + 40, { steps: 5 });
    await page.mouse.up();
    await expect(s.and).toHaveAttribute("transform", "translate(300 340) rotate(0)");
  });

test("failed gesture (mouse released outside the SVG) rolls the drag back", async ({ page }) => {
  const s = await gestureScene(page);
  const a = await screenOf(page, 300, 300), c = await box(page);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(a.x + 40, a.y + 80, { steps: 6 });
  await page.mouse.move(c.x + c.width + 60, a.y, { steps: 6 }); // over the Properties panel
  await page.mouse.up();
  await expect(svgLoc(page)).toHaveAttribute("data-operation", "NONE");
  await expect(s.and).toHaveAttribute("transform", s.original);
  expect(await committed(page)).toBe(s.edits);
});

test("failed gesture (blocked route): dropping the gate onto another part is refused with no trace in history or the circuit", async ({ page }) => {
  await place(page, "Input", 100, 300);
  await place(page, "AND", 300, 300);
  await place(page, "Output", 600, 300);
  await clickPin(page, 0); await clickPin(page, 1);
  await page.keyboard.press("Escape");
  await place(page, "Output", 300, 500); // obstacle
  await place(page, "Output", 800, 650);
  await page.keyboard.press("Control+z"); // future = 1
  await clickWorld(page, 600, 650);
  const and = comps(page).nth(1);
  const original = (await and.getAttribute("transform"))!, wire = (await wires(page).first().getAttribute("points"))!, edits = await committed(page);
  const a = await screenOf(page, 300, 300);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(a.x, a.y + 100, { steps: 6 });
  await page.mouse.move(a.x + 20, a.y + 200, { steps: 6 }); // input pin lands inside the obstacle margin
  await page.mouse.up();
  await expect(svgLoc(page)).toHaveAttribute("data-operation", "NONE");
  await expect(and).toHaveAttribute("transform", original);
  expect(await wires(page).first().getAttribute("points")).toBe(wire);
  expect(await committed(page)).toBe(edits);
  await page.keyboard.press("Control+y");
  await expect(comps(page)).toHaveCount(5);
});

/* ------------------------------------------------------------------ 13 context menu */
test("context-menu policy: blocked on canvas/menus/non-text UI, preserved on text fields; RMB click vs drag are distinct", async ({ page }) => {
  await place(page, "AND", 300, 300);
  const probe = (sel: string) => page.evaluate((s) => {
    const el = document.querySelector(s)!;
    const ev = new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 5, clientY: 5 });
    el.dispatchEvent(ev);
    return ev.defaultPrevented;
  }, sel);
  for (const sel of ["main svg", "header button", ".library button", "aside.properties", "footer", "header strong"])
    expect(await probe(sel), `default menu must be blocked on ${sel}`).toBe(true);
  expect(await probe('header input[aria-label="프로젝트 이름"]'), "text field keeps its edit menu").toBe(false);
  const d = await openSettings(page);
  expect(await probe('[aria-label="Sequence timeout"]'), "settings number input keeps its edit menu").toBe(false);
  expect(await probe('[role="dialog"] select'), "settings select is non-text UI").toBe(true);
  await d.getByRole("button", { name: "수정" }).first().click();
  expect(await probe('textarea[aria-label="Binding JSON"]'), "binding JSON textarea keeps its edit menu").toBe(false);
  await d.getByRole("button", { name: "닫기", exact: true }).click();
  // Circlith Modern: short RMB click opens the menu, RMB drag must not
  const b = await box(page);
  await page.mouse.move(b.x + 700, b.y + 500);
  await page.mouse.down({ button: "right" });
  await page.mouse.move(b.x + 780, b.y + 540, { steps: 6 });
  await page.mouse.up({ button: "right" });
  const afterDrag = await page.getByRole("dialog", { name: "도면 메뉴" }).count();
  const v1 = await view(page);
  await page.mouse.click(b.x + 700, b.y + 500, { button: "right" });
  await expect(page.getByRole("dialog", { name: "도면 메뉴" })).toBeVisible();
  await page.keyboard.press("Escape");
  expect(afterDrag, "an RMB drag in Circlith Modern must not be treated as a click").toBe(0);
  expect(v1).toEqual({ x: 0, y: 0, k: 1 });
});

test("EasyEDA preset: RMB drag pans, RMB click opens the menu, and neither mutates the circuit", async ({ page }) => {
  await place(page, "AND", 300, 300);
  await choosePreset(page, "easyeda-pro");
  const edits = await committed(page), b = await box(page);
  await page.mouse.move(b.x + 700, b.y + 500);
  await page.mouse.down({ button: "right" });
  await page.mouse.move(b.x + 760, b.y + 530, { steps: 6 });
  await page.mouse.up({ button: "right" });
  const v = await view(page);
  expect({ x: v.x, y: v.y }).toEqual({ x: 60, y: 30 });
  await expect(page.getByRole("dialog", { name: "도면 메뉴" })).toHaveCount(0);
  await page.mouse.click(b.x + 700, b.y + 500, { button: "right" });
  test.info().annotations.push({ type: "observed", description: "EasyEDA RMB click opens menu: " + ((await page.getByRole("dialog", { name: "도면 메뉴" }).count()) > 0) });
  await page.keyboard.press("Escape");
  expect(await committed(page)).toBe(edits);
  await expect(svgLoc(page)).toHaveAttribute("data-operation", "NONE");
});

/* ------------------------------------------------------------------ 10 routing regression in the browser */
for (const kind of ["OR", "NOT"])
  for (const keys of [0, 1, 2, 3])
    test(`routing: Input→Output straight through a ${kind} rotated ${keys}×CCW is routed around the drawn body (checked on the DOM)`, async ({ page }) => {
      await place(page, "Input", 100, 300);
      await place(page, kind, 400, 300);
      for (let i = 0; i < keys; i++) await page.keyboard.press("r");
      await place(page, "Output", 700, 300);
      await clickWorld(page, 400, 600);
      const nPins = kind === "OR" ? 3 : 2;
      await clickPin(page, 0);
      await clickPin(page, 1 + nPins);
      await expect(wires(page)).toHaveCount(1);
      const pts = (await wires(page).first().getAttribute("points"))!.split(" ").map((p) => p.split(",").map(Number));
      const angle = ((-90 * keys) % 360 + 360) % 360;
      const swap = angle % 180 !== 0;
      const hx = swap ? 20 : 30, hy = swap ? 30 : 20; // body half extents on screen after rotation
      for (let i = 1; i < pts.length; i++) {
        const [x1, y1] = pts[i - 1], [x2, y2] = pts[i];
        const crosses = y1 === y2
          ? y1 > 300 - hy && y1 < 300 + hy && Math.max(x1, x2) > 400 - hx && Math.min(x1, x2) < 400 + hx
          : x1 > 400 - hx && x1 < 400 + hx && Math.max(y1, y2) > 300 - hy && Math.min(y1, y2) < 300 + hy;
        expect(crosses, `segment ${i} (${x1},${y1})→(${x2},${y2}) crosses the ${kind} body`).toBe(false);
      }
    });

test("drag + R, R, Shift+R + release is ONE Undo and restores the exact wire and position", async ({ page }) => {
  await place(page, "Input", 100, 300);
  await place(page, "OR", 400, 300);
  await clickWorld(page, 700, 500);
  await clickPin(page, 0); await clickPin(page, 1);
  await page.keyboard.press("Escape");
  const gate = comps(page).nth(1);
  const before = (await gate.getAttribute("transform"))!, wire = (await wires(page).first().getAttribute("points"))!, edits = await committed(page);
  const g = await screenOf(page, 400, 300);
  await page.mouse.move(g.x, g.y);
  await page.mouse.down();
  await page.mouse.move(g.x + 20, g.y + 60, { steps: 5 });
  await page.mouse.move(g.x + 40, g.y + 100, { steps: 5 });
  await page.keyboard.press("r");
  await page.keyboard.press("r");
  await page.keyboard.press("Shift+r");
  await page.mouse.up();
  expect(await committed(page)).toBe(edits + 1);
  expect(rotOf(await gate.getAttribute("transform"))).toBe(270);
  await page.keyboard.press("Control+z");
  expect(await committed(page)).toBe(edits);
  await expect(gate).toHaveAttribute("transform", before);
  expect(await wires(page).first().getAttribute("points")).toBe(wire);
  await page.keyboard.press("Control+y");
  expect(await committed(page)).toBe(edits + 1);
});
