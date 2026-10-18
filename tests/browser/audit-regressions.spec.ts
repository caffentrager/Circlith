// Regression tests for the 2026-10-18 independent audit (qa-audit/20261018): F2 (Input toggle ownership) and N4 (modal backdrop focus).
import { test, expect, type Page } from '@playwright/test';

async function place(page: Page, kind: string, x: number, y: number) {
  await page.locator('.library').getByRole('button', { name: kind, exact: true }).click();
  const box = (await page.locator('main svg').boundingBox())!;
  await page.mouse.click(box.x + x, box.y + y);
}
async function connectPins(page: Page, a: number, b: number) {
  const pins = page.locator('main [data-layer="pins"] [data-pin]');
  await pins.nth(a).click(); await pins.nth(b).click(); await page.keyboard.press('Escape');
}
async function inverter(page: Page) {
  await place(page, 'Input', 100, 150); await place(page, 'NOT', 320, 150); await place(page, 'Output', 540, 150);
  await connectPins(page, 0, 1); await connectPins(page, 2, 3);
  await page.getByRole('button', { name: '시뮬레이션', exact: true }).click();
}
const state = (page: Page) => page.evaluate(() => ({
  viewport: document.querySelector('main svg > g')?.getAttribute('transform'),
  transforms: [...document.querySelectorAll('main [data-layer="symbols"] [data-component]')].map(e => e.getAttribute('transform')),
  selected: document.querySelectorAll('main .symbol.selected').length,
  menu: !!document.querySelector('[role=dialog][aria-label="도면 메뉴"]'),
  value: document.querySelector('main [data-layer="symbols"] [data-component]')?.getAttribute('data-value'),
  history: document.querySelector('header span')?.textContent,
  operation: document.querySelector('main svg')?.getAttribute('data-operation'),
}));
const drag = async (page: Page, x: number, y: number, button: 'left' | 'middle' | 'right') => {
  await page.mouse.move(x, y); await page.mouse.down({ button });
  for (let i = 1; i <= 6; i++) await page.mouse.move(x + 12 * i, y + 8 * i);
  await page.mouse.up({ button });
};
test.beforeEach(async ({ page }) => { await page.goto('/'); });

test('Input centre: only a plain click toggles; drag moves, MMB / Space pan, RMB opens the menu, Shift+click selects', async ({ page }) => {
  await inverter(page);
  const box = (await page.locator('main svg').boundingBox())!, at = { x: box.x + 100, y: box.y + 150 };
  await page.mouse.click(box.x + 800, box.y + 500); await page.keyboard.press('Escape');
  let before = await state(page);
  await page.mouse.click(at.x, at.y);
  let after = await state(page);
  expect(after.value).not.toBe(before.value); expect(after.selected).toBe(1); expect(after.history).toBe(before.history);
  await page.mouse.click(at.x, at.y); // toggle back
  expect((await state(page)).value).toBe(before.value);
  before = await state(page);
  await drag(page, at.x, at.y, 'left');
  after = await state(page);
  expect(after.transforms[0]).not.toBe(before.transforms[0]); expect(after.value).toBe(before.value); // moved, not toggled
  await page.keyboard.press('Control+z');
  await page.mouse.click(box.x + 800, box.y + 500); await page.keyboard.press('Escape');
  before = await state(page);
  await drag(page, at.x, at.y, 'middle');
  expect((await state(page)).viewport).not.toBe(before.viewport);
  before = await state(page);
  await page.keyboard.down('Space'); await drag(page, at.x, at.y, 'left'); await page.keyboard.up('Space');
  expect((await state(page)).viewport).not.toBe(before.viewport);
  await page.mouse.click(at.x, at.y, { button: 'right' });
  expect((await state(page)).menu).toBe(true);
});

test('after a toggle click the first Space-drag pans, and a wire draft started from the keyboard is cancelled by Escape', async ({ page }) => {
  await inverter(page);
  const box = (await page.locator('main svg').boundingBox())!;
  await page.mouse.click(box.x + 100, box.y + 150);
  const before = await state(page);
  await page.keyboard.down('Space'); await drag(page, box.x + 420, box.y + 420, 'left'); await page.keyboard.up('Space');
  expect((await state(page)).viewport).not.toBe(before.viewport);
  // keyboard path: focus the toggle, press W over a pin, Escape must still cancel
  await page.locator('[data-input-toggle]').focus();
  const pin = (await page.locator('main [data-layer="pins"] [data-pin]').nth(3).boundingBox())!;
  await page.mouse.move(pin.x + pin.width / 2, pin.y + pin.height / 2);
  await page.keyboard.press('w');
  expect((await state(page)).operation).toBe('WIRE_DRAFT');
  await page.keyboard.press('Escape');
  expect((await state(page)).operation).toBe('NONE');
});

test('toggling an Input selects it, so Delete targets what the user just clicked', async ({ page }) => {
  await inverter(page);
  const box = (await page.locator('main svg').boundingBox())!;
  await page.mouse.click(box.x + 320, box.y + 142); // select the NOT
  await page.mouse.click(box.x + 100, box.y + 150); // toggle the Input
  await page.keyboard.press('Delete');
  await expect(page.locator('main [data-layer="symbols"] [data-component]')).toHaveCount(2);
  await expect(page.locator('main [data-layer="symbols"] [data-component] [data-gate-shape="NOT"]')).toHaveCount(1);
});

test('modal backdrop click keeps keyboard ownership: Escape still closes Properties and Settings', async ({ page }) => {
  await place(page, 'AND', 300, 250);
  await page.locator('main [data-layer="symbols"] [data-component] [data-gate-shape]').first().dblclick();
  const dialog = page.getByRole('dialog', { name: 'Properties · 부품 속성', exact: true });
  const b = (await dialog.boundingBox())!;
  await page.mouse.click(Math.max(2, b.x - 30), Math.max(2, b.y - 30));
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await page.getByRole('button', { name: '설정', exact: true }).click();
  const settings = page.getByRole('dialog', { name: 'Input & Controls' });
  const s = (await settings.boundingBox())!;
  await page.mouse.click(Math.max(2, s.x - 30), Math.max(2, s.y - 30));
  await page.keyboard.press('Escape');
  await expect(settings).toHaveCount(0);
});
