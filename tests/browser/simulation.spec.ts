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
  await place(page, 'Input', 100, 150);
  await place(page, 'NOT', 320, 150);
  await place(page, 'Output', 540, 150);
  await connectPins(page, 0, 1); await connectPins(page, 2, 3);
  await page.getByRole('button', { name: '시뮬레이션', exact: true }).click();
}
const panel = (page: Page) => page.getByRole('region', { name: '조합논리 시뮬레이션', exact: true });
test.beforeEach(async ({ page }) => { await page.goto('/'); });

test('input switches, output and wire values update without edits; display toggles preserve inputs', async ({ page }) => {
  await inverter(page);
  await expect(panel(page).locator('[data-output]')).toHaveText('1');
  await expect(page.locator('main [data-wire]').nth(0)).toHaveAttribute('data-value', '0');
  await expect(page.locator('main [data-wire]').nth(1)).toHaveAttribute('data-value', '1');
  const history = await page.locator('header').getAttribute('data-edit-count');
  await page.getByRole('button', { name: '입력 토글 1: 0', exact: true }).click();
  await expect(panel(page).locator('[data-output]')).toHaveText('0');
  await expect(page.locator('main [data-wire]').nth(0)).toHaveAttribute('data-value', '1');
  await expect(page.locator('header')).toHaveAttribute('data-edit-count', history!);
  await panel(page).getByRole('combobox', { name: 'Input 1 값', exact: true }).selectOption('Z');
  await expect(panel(page).locator('[data-output]')).toHaveText('X');
  await expect(panel(page).locator('[data-diagnostic-code="FLOATING_INPUT"]')).toHaveCount(1);
  await expect(page.locator('main [data-wire]').nth(0)).toHaveClass(/signal-Z/);
  await page.getByRole('button', { name: '시뮬레이션', exact: true }).click();
  await expect(panel(page)).toHaveCount(0);
  await expect(page.locator('main [data-wire-value]')).toHaveCount(0);
  await page.getByRole('button', { name: '시뮬레이션', exact: true }).click();
  await expect(panel(page).getByRole('combobox', { name: 'Input 1 값', exact: true })).toHaveValue('Z');
  await panel(page).getByRole('button', { name: '입력 모두 0', exact: true }).click();
  await expect(panel(page).locator('[data-output]')).toHaveText('1');
});

test('new gates have correct pins after rotation and XOR evaluates the interactive truth table', async ({ page }) => {
  await place(page, 'Input', 100, 100); await place(page, 'Input', 100, 300);
  await place(page, 'XOR', 320, 200); await place(page, 'Output', 550, 200);
  await connectPins(page, 0, 2); await connectPins(page, 1, 3); await connectPins(page, 4, 5);
  await page.getByRole('button', { name: '시뮬레이션', exact: true }).click();
  for (const [a, b, expected] of [['0', '0', '0'], ['0', '1', '1'], ['1', '0', '1'], ['1', '1', '0']]) {
    await panel(page).getByRole('combobox', { name: 'Input 1 값', exact: true }).selectOption(a);
    await panel(page).getByRole('combobox', { name: 'Input 2 값', exact: true }).selectOption(b);
    await expect(panel(page).locator('[data-output]')).toHaveText(expected);
  }
  await expect(panel(page).locator('[data-diagnostic-code]')).toHaveCount(0);
  const gate = page.locator('main [data-component]').filter({ has: page.locator('[data-gate-shape="XOR"]') });
  await gate.locator('[data-gate-shape]').click(); await page.keyboard.press('r');
  await expect(gate).toHaveAttribute('transform', /rotate\(270\)/);
  await expect(panel(page).locator('[data-output]')).toHaveText('0');
});

test('conflict diagnostics locate objects, and undo/redo immediately recompute committed topology', async ({ page }) => {
  await place(page, 'Input', 100, 100); await place(page, 'Input', 100, 300); await place(page, 'Output', 500, 200);
  await connectPins(page, 0, 2); await connectPins(page, 1, 2);
  await page.getByRole('button', { name: '시뮬레이션', exact: true }).click();
  await panel(page).getByRole('combobox', { name: 'Input 2 값', exact: true }).selectOption('1');
  await expect(panel(page).locator('[data-output]')).toHaveText('X');
  const conflict = panel(page).locator('[data-diagnostic-code="DRIVE_CONFLICT"]');
  await conflict.getByRole('button', { name: '관련 위치 보기' }).click();
  await expect(page.locator('main .symbol.selected')).toHaveCount(2);
  await page.keyboard.press('Control+z');
  await expect(panel(page).locator('[data-output]')).toHaveText('0');
  await expect(conflict).toHaveCount(0);
  await page.keyboard.press('Control+Shift+z');
  await expect(panel(page).locator('[data-output]')).toHaveText('X');
});

test('drafts disable input controls, keyboard input toggle leaves geometry alone, deleted input resets on Undo', async ({ page }) => {
  await inverter(page);
  const toggle = page.locator('[data-input-toggle]');
  const transform = await page.locator('main [data-component]').first().getAttribute('transform');
  await toggle.focus(); await page.keyboard.press('Enter');
  await expect(panel(page).locator('[data-output]')).toHaveText('0');
  await expect(page.locator('main [data-component]').first()).toHaveAttribute('transform', transform!);
  await place(page, 'NAND', 320, 350);
  await page.locator('.library').getByRole('button', { name: 'NOR', exact: true }).click();
  await expect(panel(page).getByRole('combobox', { name: 'Input 1 값', exact: true })).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(toggle).toHaveCount(1);
  await page.getByRole('tab', { name: '도면 트리', exact: true }).click();
  await page.locator('[data-outline-object]').filter({ hasText: 'Input 1' }).first().click();
  await page.keyboard.press('Delete');
  await expect(panel(page).getByRole('combobox')).toHaveCount(0);
  await expect(panel(page).locator('[data-output]')).toHaveText('X');
  await page.keyboard.press('Control+z');
  await expect(panel(page).getByRole('combobox')).toHaveValue('0');
  await expect(panel(page).locator('[data-output]')).toHaveText('1');
});

test('feedback is visibly diagnosed with X output', async ({ page }) => {
  await place(page, 'NOT', 280, 200); await place(page, 'Output', 540, 300);
  await connectPins(page, 1, 0); await connectPins(page, 1, 2);
  await page.getByRole('button', { name: '시뮬레이션', exact: true }).click();
  await expect(panel(page).locator('[data-output]')).toHaveText('X');
  await expect(panel(page).locator('[data-diagnostic-code="COMBINATIONAL_FEEDBACK"]')).toHaveCount(1);
});

test('locating a diagnostic clears a previous wire corner so Delete affects the diagnosed selection', async ({ page }) => {
  await place(page, 'Input', 100, 100); await place(page, 'Output', 500, 300);
  await connectPins(page, 0, 1);
  await page.getByRole('button', { name: '시뮬레이션', exact: true }).click();
  await panel(page).getByRole('combobox', { name: 'Input 1 값', exact: true }).selectOption('Z');
  const points = (await page.locator('main [data-wire]').getAttribute('points'))!.split(' ').map(p => p.split(',').map(Number));
  const box = (await page.locator('main svg').boundingBox())!;
  await page.mouse.click(box.x + (points[0][0] + points[1][0]) / 2, box.y + (points[0][1] + points[1][1]) / 2);
  await page.locator('main [data-wire-handle][data-kind="corner"]').first().click();
  await expect(page.locator('.corner-selection')).toHaveCount(1);
  await panel(page).locator('[data-diagnostic-code="FLOATING_INPUT"]').getByRole('button', { name: '관련 위치 보기' }).click();
  await expect(page.locator('.corner-selection')).toHaveCount(0);
  await page.keyboard.press('Delete');
  await expect(page.locator('main [data-component]')).toHaveCount(1);
  await expect(page.locator('main [data-wire]')).toHaveCount(0);
});
