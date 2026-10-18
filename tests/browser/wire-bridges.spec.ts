import { test, expect, type Page } from '@playwright/test';
import { wheelToZoom } from './zoom-helper';

async function point(page: Page, x: number, y: number) {
  const box = (await page.locator('main svg').boundingBox())!;
  await page.mouse.click(box.x + x, box.y + y);
}
async function place(page: Page, kind: string, x: number, y: number) {
  await page.locator('.library').getByRole('button', { name: kind, exact: true }).click(); await point(page, x, y);
}
async function fixture(page: Page) {
  await page.goto('/');
  await place(page, 'Input', 100, 200); await place(page, 'Output', 550, 200);
  const pins = page.locator('main [data-layer="pins"] [data-pin]');
  await pins.nth(0).click(); await pins.nth(1).click(); await page.keyboard.press('Escape');
  await place(page, 'Input', 330, 60); await page.keyboard.press('Shift+r');
  await place(page, 'Output', 330, 450); await page.keyboard.press('Shift+r');
  await pins.nth(2).click(); await pins.nth(3).click(); await page.keyboard.press('Escape');
}
async function settings(page: Page) {
  await page.getByRole('button', { name: '설정', exact: true }).click();
  return page.getByRole('dialog', { name: 'Input & Controls' });
}

test('axis and On/Off change only display, persist and preserve the original route and history', async ({ page }) => {
  await fixture(page);
  const bridges = page.locator('[data-wire-bridge]');
  await expect(bridges).toHaveCount(1); await expect(bridges).toHaveAttribute('data-bridge-axis', 'horizontal');
  const box = (await page.locator('main svg').boundingBox())!;
  await page.screenshot({ path: 'build/bridge-horizontal.png', clip: { x: box.x + 280, y: box.y + 150, width: 100, height: 100 } });
  const geometry = await page.locator('main [data-wire]').evaluateAll(els => els.map(e => e.getAttribute('points')));
  const history = await page.locator('header span').innerText();
  const dialog = await settings(page);
  await dialog.getByLabel('점프할 배선', { exact: true }).selectOption('vertical');
  await expect(bridges).toHaveAttribute('data-bridge-axis', 'vertical');
  await dialog.getByRole('checkbox', { name: '미접속 교차 점프', exact: true }).uncheck();
  await expect(bridges).toHaveCount(0); await expect(dialog.getByLabel('점프할 배선', { exact: true })).toBeDisabled();
  await dialog.getByRole('checkbox', { name: '미접속 교차 점프', exact: true }).check();
  await expect(bridges).toHaveAttribute('data-bridge-axis', 'vertical');
  await dialog.getByRole('button', { name: '닫기', exact: true }).click();
  await page.screenshot({ path: 'build/bridge-vertical.png', clip: { x: box.x + 280, y: box.y + 150, width: 100, height: 100 } });
  expect(await page.locator('main [data-wire]').evaluateAll(els => els.map(e => e.getAttribute('points')))).toEqual(geometry);
  await expect(page.locator('header span')).toHaveText(history);
  await expect(page.locator('main svg')).toHaveAttribute('data-net-count', '2');
  await expect(page.locator('main svg')).toHaveAttribute('data-junction-count', '0');
  await page.reload(); const restored = await settings(page);
  await expect(restored.getByLabel('점프할 배선', { exact: true })).toHaveValue('vertical');
  await expect(restored.getByRole('checkbox', { name: '미접속 교차 점프', exact: true })).toBeChecked();
});

test('bridge click selects its own wire, simulation colors update, and zoom keeps its screen radius', async ({ page }) => {
  await fixture(page);
  const bridge = page.locator('[data-wire-bridge]'), wire = await bridge.getAttribute('data-wire-bridge');
  await point(page, 330, 195);
  await expect(page.locator(`main [data-wire="${wire}"]`)).toHaveClass(/selected/);
  await expect(bridge).toHaveAttribute('data-selected', 'true');
  await page.getByRole('button', { name: '시뮬레이션', exact: true }).click();
  await page.getByRole('combobox', { name: 'Input 1 값', exact: true }).selectOption('1');
  await expect(bridge).toHaveAttribute('data-value', '1');
  for (const zoom of [0.5, 2]) {
    const box = (await page.locator('main svg').boundingBox())!; await page.mouse.move(box.x + 330, box.y + 200);
    await wheelToZoom(page, zoom);
    expect(Number(await bridge.getAttribute('data-bridge-radius')) * zoom).toBe(5);
  }
});

test('an explicit connection removes the bridge and Undo/Redo restores the matching display', async ({ page }) => {
  await fixture(page);
  const box = (await page.locator('main svg').boundingBox())!;
  await page.mouse.move(box.x + 330, box.y + 200); await page.keyboard.press('w');
  const chooser = page.getByRole('dialog', { name: '접속 대상 선택' });
  await chooser.getByRole('button', { name: '이 교차점을 접속', exact: true }).click();
  await expect(page.locator('[data-wire-bridge]')).toHaveCount(0);
  await expect(page.locator('main svg')).toHaveAttribute('data-junction-count', '1');
  await page.keyboard.press('Control+z'); await expect(page.locator('[data-wire-bridge]')).toHaveCount(1);
  await page.keyboard.press('Control+Shift+z'); await expect(page.locator('[data-wire-bridge]')).toHaveCount(0);
});

test('bad stored display settings recover and unavailable storage still applies to the session', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('circlith.simulation.wire-display.v1', '{"version":9}'));
  await page.reload(); await expect(page.getByRole('status')).toContainText('배선 표시 설정을 복구하지 못해');
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw new Error('disabled'); }; });
  const dialog = await settings(page); await dialog.getByLabel('점프할 배선', { exact: true }).selectOption('vertical');
  await expect(dialog.getByLabel('점프할 배선', { exact: true })).toHaveValue('vertical');
  await dialog.getByRole('button', { name: '닫기', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('배선 표시는 이번 세션에 적용');
});
