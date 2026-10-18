import { test, expect, type Page } from '@playwright/test';
import { box, diffSnap, inverter, save, saveKey, simButton, snap, place, connectPins } from './lib';

type Gesture = { name: string; run: (page: Page, x: number, y: number) => Promise<void> };
const drag = async (page: Page, x: number, y: number, button: 'left' | 'middle' | 'right', dx = 70, dy = 45) => {
  await page.mouse.move(x, y); await page.mouse.down({ button });
  for (let i = 1; i <= 6; i++) await page.mouse.move(x + (dx * i) / 6, y + (dy * i) / 6);
  await page.mouse.up({ button });
};
const gestures: Gesture[] = [
  { name: 'LMB click', run: async (p, x, y) => { await p.mouse.click(x, y); } },
  { name: 'LMB drag', run: (p, x, y) => drag(p, x, y, 'left') },
  { name: 'Shift+LMB click', run: async (p, x, y) => { await p.keyboard.down('Shift'); await p.mouse.click(x, y); await p.keyboard.up('Shift'); } },
  { name: 'MMB drag', run: (p, x, y) => drag(p, x, y, 'middle') },
  { name: 'RMB click', run: async (p, x, y) => { await p.mouse.click(x, y, { button: 'right' }); } },
  { name: 'RMB drag', run: (p, x, y) => drag(p, x, y, 'right') },
  { name: 'Space+LMB drag', run: async (p, x, y) => { await p.keyboard.down('Space'); await drag(p, x, y, 'left'); await p.keyboard.up('Space'); } },
  { name: 'Alt+LMB click', run: async (p, x, y) => { await p.keyboard.down('Alt'); await p.mouse.click(x, y); await p.keyboard.up('Alt'); } },
  { name: 'double-click', run: async (p, x, y) => { await p.mouse.dblclick(x, y); } },
];
const positions = { center: [100, 150], edge: [72, 150], 'outside background': [420, 420] } as const;

test('F2 matrix: gesture x position x simulation ON/OFF on an Input body', async ({ page }) => {
  test.setTimeout(900000);
  const rows: Record<string, unknown>[] = [];
  for (const simulation of [false, true]) for (const [posName, [px, py]] of Object.entries(positions)) for (const g of gestures) {
    await page.goto('/');
    await inverter(page, simulation);
    const b = await box(page);
    await page.mouse.click(b.x + 800, b.y + 500); // neutral click on background to clear selection
    await page.keyboard.press('Escape');
    const before = await snap(page);
    await g.run(page, b.x + px, b.y + py);
    await page.waitForTimeout(80);
    const after = await snap(page);
    rows.push({ simulation, position: posName, gesture: g.name, ...diffSnap(before, after), activeAfter: after.active });
  }
  save('browser-f2-matrix', rows);
  // Regression candidates: effects present with simulation OFF but absent with simulation ON for the same gesture/position
  const key = (r: any) => `${r.position}|${r.gesture}`;
  const off = new Map(rows.filter((r: any) => !r.simulation).map(r => [key(r), r]));
  const lost: unknown[] = [];
  for (const r of rows.filter((r: any) => r.simulation) as any[]) {
    const o = off.get(key(r)) as any;
    for (const effect of ['panned', 'moved', 'selectionChanged', 'menuOpened', 'propertiesOpened'])
      if (o[effect] && !r[effect]) lost.push({ position: r.position, gesture: r.gesture, lostEffect: effect });
  }
  save('browser-f2-lost-effects', lost);
  expect(lost).toEqual([]);
});

test('F2 extension: toggle focus owns Space/Delete; stale selection; wire draft + Esc', async ({ page }) => {
  const out: Record<string, unknown> = {};
  // (a) toggle click -> Space+background drag (first and second attempt)
  await page.goto('/'); await inverter(page, true);
  let b = await box(page);
  await page.mouse.click(b.x + 100, b.y + 150); // toggles Input
  out.afterToggle = await snap(page);
  const attempts: unknown[] = [];
  for (let i = 0; i < 2; i++) {
    const before = await snap(page);
    await page.keyboard.down('Space'); await drag(page, b.x + 420, b.y + 420, 'left', 80, 50); await page.keyboard.up('Space');
    const after = await snap(page);
    attempts.push({ attempt: i + 1, ...diffSnap(before, after), activeBefore: before.active, activeAfter: after.active, selectionBox: after.operation });
  }
  out.spaceDragAfterToggle = attempts;
  // control: same sequence after a plain background click instead of a toggle click
  await page.goto('/'); await inverter(page, true); b = await box(page);
  await page.mouse.click(b.x + 700, b.y + 400);
  const cb = await snap(page);
  await page.keyboard.down('Space'); await drag(page, b.x + 420, b.y + 420, 'left', 80, 50); await page.keyboard.up('Space');
  out.spaceDragControl = diffSnap(cb, await snap(page));

  // (b) toggle focus -> hover pin -> W -> Esc
  await page.goto('/'); await inverter(page, true); b = await box(page);
  await page.mouse.click(b.x + 100, b.y + 150);
  const pins = page.locator('main [data-layer="pins"] [data-pin]');
  const pinBox = (await pins.nth(3).boundingBox())!; // Output input pin
  await page.mouse.move(pinBox.x + pinBox.width / 2, pinBox.y + pinBox.height / 2);
  await page.keyboard.press('w');
  const afterW = await snap(page);
  await page.keyboard.press('Escape');
  const afterEsc = await snap(page);
  out.wireDraftEsc = { afterW: { operation: afterW.operation, active: afterW.active }, afterEsc: { operation: afterEsc.operation, active: afterEsc.active } };

  // (c) stale selection + Delete
  await page.goto('/'); await inverter(page, true); b = await box(page);
  await page.mouse.click(b.x + 320, b.y + 150 - 8); // select NOT body
  const selBefore = await snap(page);
  await page.mouse.click(b.x + 100, b.y + 150); // toggle Input
  const selAfterToggle = await snap(page);
  await page.keyboard.press('Delete');
  const afterDelete = await snap(page);
  out.staleSelectionDelete = { selectedBeforeToggle: selBefore.selected, selectedAfterToggle: selAfterToggle.selected, componentsBefore: selBefore.components, componentsAfter: afterDelete.components,
    remainingKinds: await page.locator('main [data-layer="symbols"] [data-component] [data-gate-shape], main [data-layer="symbols"] [data-component] text').allInnerTexts() };
  saveKey('browser-focus', 'f2-extension', out);
  // informational assertions captured in evidence; hard assertion only on Esc ownership
  expect(afterEsc.operation).toBe('NONE');
});

test('double-click on Input with simulation ON: toggles, properties, history', async ({ page }) => {
  await page.goto('/'); await inverter(page, true);
  const b = await box(page);
  const before = await snap(page);
  await page.mouse.dblclick(b.x + 100, b.y + 150);
  await page.waitForTimeout(100);
  const after = await snap(page);
  const result = { ...diffSnap(before, after), valueBefore: before.values[0], valueAfter: after.values[0], propsOpen: after.props, historyBefore: before.history, historyAfter: after.history };
  saveKey('browser-focus', 'input-dblclick-sim-on', result);
  expect(after.props).toBe(true);
});

test('modes: ON then OFF keeps selection, view and circuit; entering ON cancels a draft without committing', async ({ page }) => {
  await page.goto('/'); await inverter(page, false);
  const b = await box(page);
  await page.mouse.click(b.x + 320, b.y + 150 - 8);
  const before = await snap(page);
  await simButton(page).click(); await simButton(page).click();
  const after = await snap(page);
  const pins = page.locator('main [data-layer="pins"] [data-pin]');
  await place(page, 'AND', 400, 400);
  await pins.nth(0).click(); // wire draft started from Input pin
  const draft = await snap(page);
  await simButton(page).click();
  const cancelled = await snap(page);
  saveKey('browser-focus', 'sim-toggle', { selectionKept: before.selected === after.selected, viewportKept: before.viewport === after.viewport, draftOperation: draft.operation, afterEnter: cancelled.operation, historyAfterEnter: cancelled.history });
  expect(before.selected).toBe(after.selected);
  expect(cancelled.operation).toBe('NONE');
  void connectPins;
});
