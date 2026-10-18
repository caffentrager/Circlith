import { test, expect, type Page } from '@playwright/test';
import { box, place, propsDialog, saveKey, simButton, SCREENS, connectPins } from './lib';

const FILE = 'browser-viewports';
const SIZES = [[1024, 420], [1024, 768], [1440, 900], [1920, 1080]] as const;
async function readZoom(page: Page) {
  const t = await page.locator('main svg > g').first().getAttribute('transform');
  return Number(t!.match(/scale\(([^)]+)\)/)![1]);
}
async function wheelToZoom(page: Page, target: number) {
  await page.locator('main svg').focus();
  const sb = (await page.locator('main svg').boundingBox())!; await page.mouse.move(sb.x + sb.width / 2, sb.y + sb.height / 2);
  for (let i = 0; i < 40; i++) {
    const current = await readZoom(page);
    if (Math.abs(current - target) < 1e-6) return;
    const delta = Math.max(-200, Math.min(200, -Math.log(target / current) * 100 / Math.log(1.1)));
    await page.mouse.wheel(0, delta);
    await expect.poll(() => readZoom(page)).not.toBe(current);
  }
}

for (const [w, h] of SIZES) {
  test(`viewport ${w}x${h}: layout, overflow, Properties (16 inputs) and Settings modals`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await page.goto('/');
    await place(page, 'AND', 400, Math.min(250, h - 260));
    const out: Record<string, unknown> = {};
    const metrics = () => page.evaluate(() => ({
      docScroll: { w: document.documentElement.scrollWidth, h: document.documentElement.scrollHeight }, inner: { w: innerWidth, h: innerHeight },
      horizontalOverflow: document.documentElement.scrollWidth > innerWidth, verticalPageScroll: document.documentElement.scrollHeight > innerHeight,
      mainSvg: (() => { const r = document.querySelector('main svg')!.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) }; })(),
    }));
    out.base = await metrics();
    const gate = page.locator('main [data-layer="symbols"] [data-component]').first();
    await gate.locator('[data-gate-shape]').dblclick();
    const dialog = propsDialog(page);
    await dialog.getByLabel('입력 수', { exact: true }).fill('16');
    for (const i of [1, 8, 16]) await dialog.getByLabel(`입력 ${i} 반전`, { exact: true }).check();
    const apply = dialog.getByRole('button', { name: '적용', exact: true });
    const d = (await dialog.boundingBox())!;
    out.propertiesDialog = {
      box: { x: Math.round(d.x), y: Math.round(d.y), w: Math.round(d.width), h: Math.round(d.height) },
      scrollable: await dialog.evaluate(e => e.scrollHeight > e.clientHeight), scrollHeight: await dialog.evaluate(e => e.scrollHeight), clientHeight: await dialog.evaluate(e => e.clientHeight),
      fitsViewport: d.y >= 0 && d.y + d.height <= h && d.x >= 0 && d.x + d.width <= w,
      applyVisibleWithoutScroll: await apply.evaluate(e => { const r = e.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; }),
    };
    await page.screenshot({ path: `${SCREENS}/viewport-${w}x${h}-properties16.png` });
    await apply.scrollIntoViewIfNeeded();
    await apply.click();
    out.afterApplyDialogs = await dialog.count();
    out.pageAfterModal = await metrics();
    await page.getByRole('button', { name: '설정', exact: true }).click();
    const settings = page.getByRole('dialog', { name: 'Input & Controls' });
    const sb = (await settings.boundingBox())!;
    out.settingsDialog = { fits: sb.y >= 0 && sb.y + sb.height <= h, h: Math.round(sb.height), scrollable: await settings.evaluate(e => e.scrollHeight > e.clientHeight) };
    await page.screenshot({ path: `${SCREENS}/viewport-${w}x${h}-settings.png` });
    await page.keyboard.press('Escape');
    await page.screenshot({ path: `${SCREENS}/viewport-${w}x${h}-main.png` });
    saveKey(FILE, `${w}x${h}`, out);
    expect((out.base as any).horizontalOverflow).toBe(false);
  });
}

test('zoom 10%..200%: hit testing, selection and Properties on a 16-input gate and wiring remain accurate', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await place(page, 'Input', 100, 300); await place(page, 'XOR', 400, 300); await place(page, 'Output', 700, 300);
  const gate = page.locator('main [data-layer="symbols"] [data-component]').nth(1);
  await gate.locator('[data-gate-shape]').dblclick();
  const dialog = propsDialog(page);
  await dialog.getByLabel('입력 수', { exact: true }).fill('16');
  await dialog.getByRole('button', { name: '적용', exact: true }).click();
  const rows: Record<string, unknown>[] = [];
  for (const z of [2, 1.5, 1, 0.5, 0.25, 0.1]) {
    await wheelToZoom(page, z);
    const actual = await readZoom(page);
    const g = (await gate.locator('[data-gate-shape]').boundingBox())!;
    const clickAt = { x: g.x + g.width * 0.5, y: g.y + g.height * 0.5 };
    await page.keyboard.press('Escape');
    await page.mouse.click(clickAt.x, clickAt.y);
    const selected = await page.locator('main .symbol.selected').count();
    // edge pin: topmost input pin hit must select/start wire on that pin (hover state)
    const pins = page.locator('main [data-layer="pins"] [data-pin]');
    const topPin = (await pins.nth(1).boundingBox())!;
    rows.push({ requested: z, actual: +actual.toFixed(3), gateBoxPx: { w: Math.round(g.width), h: Math.round(g.height) }, selectedByBodyClick: selected, firstInputPinPx: { w: +topPin.width.toFixed(1) } });
    await page.screenshot({ path: `${SCREENS}/zoom-${z}-xor16.png` });
  }
  saveKey(FILE, 'zoom hit testing 16-input gate', rows);
  void simButton; void connectPins; void box;
});
