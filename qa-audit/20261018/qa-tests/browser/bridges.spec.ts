import { test, expect, type Page } from '@playwright/test';
import { box, connectPins, place, saveKey, snap, SCREENS } from './lib';

const FILE = 'browser-bridges';
async function readZoom(page: Page) {
  const t = await page.locator('main svg > g').first().getAttribute('transform');
  return Number(t!.match(/scale\(([^)]+)\)/)![1]);
}
async function wheelToZoom(page: Page, target: number) {
  await page.locator('main svg').focus();
  for (let i = 0; i < 40; i++) {
    const current = await readZoom(page);
    if (Math.abs(current - target) < 1e-6) return;
    const delta = Math.max(-200, Math.min(200, -Math.log(target / current) * 100 / Math.log(1.1)));
    await page.mouse.wheel(0, delta);
    await expect.poll(() => readZoom(page)).not.toBe(current);
  }
}
async function crossing(page: Page) {
  await page.goto('/');
  await place(page, 'Input', 100, 200); await place(page, 'Output', 550, 200); await connectPins(page, 0, 1);
  await place(page, 'Input', 330, 60); await page.keyboard.press('Shift+r');
  await place(page, 'Output', 330, 450); await page.keyboard.press('Shift+r'); await connectPins(page, 2, 3);
}
/** Screen coordinates of a point in drawing space. */
async function toScreen(page: Page, p: { x: number; y: number }) {
  const [b, t] = await Promise.all([box(page), page.locator('main svg > g').first().getAttribute('transform')]);
  const m = t!.match(/translate\(([-\d.e]+) ([-\d.e]+)\) scale\(([^)]+)\)/)!;
  return { x: b.x + Number(m[1]) + p.x * Number(m[3]), y: b.y + Number(m[2]) + p.y * Number(m[3]) };
}
const bridge = (page: Page) => page.locator('main [data-wire-bridge]');
const selectedWires = (page: Page) => page.locator('main [data-wire].selected');

test('bridge geometry, hit testing, selection and non-interference', async ({ page }) => {
  await crossing(page);
  const out: Record<string, unknown> = {};
  out.bridgeCount = await bridge(page).count();
  const attrs = async () => ({ wire: await bridge(page).getAttribute('data-wire-bridge'), x: Number(await bridge(page).getAttribute('data-bridge-x')), y: Number(await bridge(page).getAttribute('data-bridge-y')), r: Number(await bridge(page).getAttribute('data-bridge-radius')), axis: await bridge(page).getAttribute('data-bridge-axis') });
  const a = await attrs();
  out.bridge = a;
  const history0 = (await snap(page)).history;
  // click the arc crown: must select the bridge-owning wire
  const crown = await toScreen(page, { x: a.x, y: a.y - a.r });
  await page.mouse.click(crown.x, crown.y);
  out.afterArcClick = { selected: await selectedWires(page).evaluateAll(els => els.map(e => e.getAttribute('data-wire'))), choiceDialog: await page.getByRole('dialog').count() };
  await page.keyboard.press('Escape');
  // click vertical wire away from the crossing
  const below = await toScreen(page, { x: a.x, y: a.y + 40 });
  await page.mouse.click(below.x, below.y);
  out.afterVerticalClick = await selectedWires(page).evaluateAll(els => els.map(e => e.getAttribute('data-wire')));
  await page.keyboard.press('Escape');
  // click the shoulder of the horizontal wire at the gap edge
  const shoulder = await toScreen(page, { x: a.x - a.r - 1, y: a.y });
  await page.mouse.click(shoulder.x, shoulder.y);
  out.afterShoulderClick = await selectedWires(page).evaluateAll(els => els.map(e => e.getAttribute('data-wire')));
  await page.keyboard.press('Escape');
  // click exactly at the crossing centre
  const centre = await toScreen(page, { x: a.x, y: a.y });
  await page.mouse.click(centre.x, centre.y);
  out.afterCentreClick = { selected: await selectedWires(page).evaluateAll(els => els.map(e => e.getAttribute('data-wire'))), dialogs: await page.getByRole('dialog').allInnerTexts() };
  await page.keyboard.press('Escape');
  out.historyUnchangedByClicks = (await snap(page)).history === history0;
  out.junctionsAfterClicks = await page.locator('main [data-junction]').count();
  // drag a wire segment through the bridge (wire edit should still work)
  await page.mouse.click(crown.x, crown.y);
  out.selectedForEdit = await selectedWires(page).count();
  await page.screenshot({ path: `${SCREENS}/bridge-selected-100.png`, clip: { x: crown.x - 120, y: crown.y - 80, width: 240, height: 160 } });
  await page.keyboard.press('Escape');
  saveKey(FILE, 'basic', out);
  expect(out.bridgeCount).toBe(1);
  expect((out.afterArcClick as any).selected).toEqual([a.wire]);
});

test('settings: toggle/axis change neither history nor topology; persists across reload', async ({ page }) => {
  await crossing(page);
  const out: Record<string, unknown> = {};
  const before = await snap(page);
  const nets = () => page.locator('.net-summary').innerText();
  const n0 = await nets();
  await page.getByRole('button', { name: '설정', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Input & Controls' });
  await dialog.getByRole('checkbox', { name: '미접속 교차 점프', exact: true }).uncheck();
  out.bridgesDisabled = await bridge(page).count();
  await dialog.getByRole('checkbox', { name: '미접속 교차 점프', exact: true }).check();
  await dialog.getByLabel('점프할 배선', { exact: true }).selectOption('vertical');
  out.verticalAxis = { count: await bridge(page).count(), axis: await bridge(page).getAttribute('data-bridge-axis') };
  out.storage = await page.evaluate(() => Object.fromEntries(Object.entries(localStorage).filter(([k]) => k.includes('wire-display'))));
  await dialog.getByRole('button', { name: '닫기', exact: true }).click();
  const after = await snap(page);
  out.historyUnchanged = before.history === after.history; out.netsUnchanged = n0 === (await nets());
  await page.reload();
  out.afterReload = { storage: await page.evaluate(() => Object.keys(localStorage).filter(k => k.includes('wire-display'))), circuitSurvives: (await page.locator('main [data-component]').count()) };
  // corrupted setting recovers
  await page.evaluate(() => { for (const k of Object.keys(localStorage)) if (k.includes('wire-display')) localStorage.setItem(k, '{"version":1,"enabled":"yes","axis":"diagonal"}'); });
  await page.reload();
  out.corruptedRecovery = { message: (await page.locator('[role=status], .message, footer').allInnerTexts()).join(' | ').slice(0, 300) };
  saveKey(FILE, 'settings', out);
  expect(out.historyUnchanged).toBe(true);
  expect(out.netsUnchanged).toBe(true);
});

test('zoom 10%..200%: bridges stay present, selected-wire mask does not erase neighbours; screenshots', async ({ page }) => {
  await crossing(page);
  const out: Record<string, unknown> = {};
  const pts: Record<string, unknown>[] = [];
  for (const z of [2, 1.5, 1, 0.5, 0.25, 0.1]) {
    await wheelToZoom(page, z === 1 ? 1 : Math.round(z * 1e6) / 1e6).catch(() => {});
    const actual = await readZoom(page);
    const count = await bridge(page).count();
    const r = count ? Number(await bridge(page).first().getAttribute('data-bridge-radius')) : null;
    pts.push({ requested: z, actual, count, radiusUser: r, radiusPx: r ? +(r * actual).toFixed(2) : null });
    await page.screenshot({ path: `${SCREENS}/bridge-zoom-${z}.png` });
  }
  out.zoomSeries = pts;
  // select the bridging wire at the lowest zoom and screenshot (mask width for selected wires is 6/zoom)
  const a = { wire: await bridge(page).first().getAttribute('data-wire-bridge') };
  await page.locator(`main [data-wire-hit="${a.wire}"]`).first().click({ force: true, position: { x: 3, y: 3 } }).catch(() => {});
  out.selectedAtMinZoom = await selectedWires(page).count();
  await page.screenshot({ path: `${SCREENS}/bridge-zoom-min-selected.png` });
  saveKey(FILE, 'zoom', out);
});

test('simulation ON: bridge carries net value styling and bridging does not alter outputs', async ({ page }) => {
  await crossing(page);
  await page.getByRole('button', { name: '시뮬레이션', exact: true }).click();
  const values = await bridge(page).evaluateAll(els => els.map(e => ({ value: e.getAttribute('data-value'), cls: e.getAttribute('class') })));
  saveKey(FILE, 'sim-on', values);
  expect(values.length).toBe(1);
});
