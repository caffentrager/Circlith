import { test, expect, type Page } from '@playwright/test';
async function point(page: Page, x: number, y: number) {
  const box = (await page.locator('main svg').boundingBox())!; await page.mouse.click(box.x + x, box.y + y);
}
async function place(page: Page, kind: string, x: number, y: number) {
  await page.locator('.library').getByRole('button', { name: kind, exact: true }).click(); await point(page, x, y);
}
const dialog = (page: Page) => page.getByRole('dialog', { name: 'Properties · 부품 속성', exact: true });
const symbols = (page: Page) => page.locator('main [data-layer="symbols"] [data-component]');
test.beforeEach(async ({ page }) => { await page.goto('/'); });

test('wire mode empty click clears selection; active wire empty click remains a waypoint', async ({ page }) => {
  await place(page, 'Input', 150, 180);
  await expect(page.locator('main .symbol.selected')).toHaveCount(1);
  await page.getByRole('button', { name: /^배선 / }).click();
  await point(page, 650, 400);
  await expect(page.locator('main .symbol.selected')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^배선 / })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator("header")).toHaveAttribute("data-edit-count", "1");
  await page.locator('main [data-pin]').click(); await point(page, 350, 180);
  await expect(page.locator('main svg')).toHaveAttribute('data-operation', 'WIRE_DRAFT');
  await expect(page.locator('[data-draft-waypoint]')).toHaveCount(1);
  await page.keyboard.press('Escape'); await page.keyboard.press('Control+z');
  await expect(symbols(page)).toHaveCount(0);
});

test('entering simulation cancels pending work and switches from wire to selection without committing', async ({ page }) => {
  await place(page, 'Input', 150, 180);
  await page.getByRole('button', { name: /^배선 / }).click();
  await page.locator('main [data-pin]').click(); await point(page, 350, 180);
  await page.getByRole('button', { name: '시뮬레이션', exact: true }).click();
  await expect(page.locator('header').getByRole('button', { name: /^선택 / })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('main svg')).toHaveAttribute('data-operation', 'NONE');
  await expect(page.locator('main [data-wire]')).toHaveCount(0);
  await expect(page.locator("header")).toHaveAttribute("data-edit-count", "1");
});

test('double-click properties changes gate name, inputs and per-pin bubbles with exact undo/redo', async ({ page }) => {
  await place(page, 'AND', 300, 250);
  const gate = symbols(page).first();
  await gate.locator('[data-gate-shape]').dblclick();
  await expect(dialog(page).getByLabel('이름', { exact: true })).toBeFocused();
  await dialog(page).getByLabel('이름', { exact: true }).fill('ENABLE');
  await dialog(page).getByLabel('입력 수', { exact: true }).fill('4');
  await dialog(page).getByLabel('입력 3 반전', { exact: true }).check();
  await dialog(page).getByLabel('입력 4 반전', { exact: true }).check();
  await page.screenshot({ path: 'build/component-properties-dialog.png' });
  await dialog(page).getByRole('button', { name: '적용', exact: true }).click();
  await expect(dialog(page)).toHaveCount(0);
  await expect(gate.locator('.label')).toHaveText('ENABLE');
  await expect(page.locator('main [data-pin]')).toHaveCount(5);
  await expect(gate.locator('[data-input-bubble]')).toHaveCount(2);
  await expect(page.locator("header")).toHaveAttribute("data-edit-count", "2");
  await page.keyboard.press('Control+z');
  await expect(gate.locator('.label')).toHaveText('AND 1');
  await expect(page.locator('main [data-pin]')).toHaveCount(3);
  await expect(gate.locator('[data-input-bubble]')).toHaveCount(0);
  await page.keyboard.press('Control+Shift+z');
  await expect(page.locator('main [data-pin]')).toHaveCount(5);
  await gate.locator('[data-gate-shape]').dblclick();
  await expect(dialog(page).getByLabel('입력 3 반전', { exact: true })).toBeChecked();
  await dialog(page).getByLabel('이름', { exact: true }).fill('Discard me');
  await page.keyboard.press('Escape');
  await expect(gate.locator('.label')).toHaveText('ENABLE');
  await expect(page.locator("header")).toHaveAttribute("data-edit-count", "2");
  await page.screenshot({ path: 'build/component-properties-gate.png' });
  // Modal ownership still applies if external code moves focus back to the canvas.
  await gate.locator('[data-gate-shape]').dblclick();
  await page.locator('main svg').focus(); await page.keyboard.press('Delete');
  await expect(symbols(page)).toHaveCount(1);
  await page.keyboard.press('Escape'); await expect(dialog(page)).toHaveCount(0);
});

test('all gate and I/O symbols open properties; typing shortcuts stays inside modal', async ({ page }) => {
  for (const kind of ['Input', 'Output', 'AND', 'OR', 'NOT', 'XOR', 'NAND', 'NOR', 'XNOR']) {
    await place(page, kind, 100 + (['Input', 'Output', 'AND', 'OR', 'NOT', 'XOR', 'NAND', 'NOR', 'XNOR'].indexOf(kind) % 3) * 200,
      100 + Math.floor(['Input', 'Output', 'AND', 'OR', 'NOT', 'XOR', 'NAND', 'NOR', 'XNOR'].indexOf(kind) / 3) * 180);
    const part = symbols(page).last();
    await part.locator('.symbol').dblclick();
    await dialog(page).getByLabel('이름', { exact: true }).fill(`${kind} custom`);
    await page.keyboard.press('Control+z');
    await expect(symbols(page)).toHaveCount(['Input', 'Output', 'AND', 'OR', 'NOT', 'XOR', 'NAND', 'NOR', 'XNOR'].indexOf(kind) + 1);
    await dialog(page).getByLabel('이름', { exact: true }).fill(`${kind} custom`);
    await dialog(page).getByRole('button', { name: '적용', exact: true }).click();
    await expect(part.locator('.label')).toHaveText(`${kind} custom`);
  }
});

test('resized and inverted connected gate evaluates immediately in simulation', async ({ page }) => {
  await place(page, 'Input', 80, 250); await place(page, 'AND', 320, 250); await place(page, 'Output', 570, 250);
  const gate = symbols(page).nth(1), inputPin = page.locator('main [data-pin]').first();
  await gate.locator('[data-gate-shape]').dblclick();
  await dialog(page).getByLabel('입력 수', { exact: true }).fill('3');
  for (let i = 1; i <= 3; i++) await dialog(page).getByLabel(`입력 ${i} 반전`, { exact: true }).check();
  await dialog(page).getByRole('button', { name: '적용', exact: true }).click();
  // Object iteration order differs from the semantic pin order after adding pins; use geometry.
  for (const y of [230, 250, 270]) {
    await inputPin.click(); await point(page, 280, y); await page.keyboard.press('Escape');
  }
  await point(page, 360, 250); await point(page, 530, 250); await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '시뮬레이션', exact: true }).click();
  await expect(page.locator('[data-output]')).toHaveText('1');
  await page.getByRole('button', { name: '입력 토글 1: 0', exact: true }).click();
  await expect(page.locator('[data-output]')).toHaveText('0');
  await gate.locator('[data-gate-shape]').dblclick();
  await dialog(page).getByLabel('입력 수', { exact: true }).fill('2');
  const history = await page.locator('header').getAttribute('data-edit-count');
  await dialog(page).getByRole('button', { name: '적용', exact: true }).click();
  await expect(dialog(page).getByRole('alert')).toContainText('배선이 연결');
  await expect(page.locator('header')).toHaveAttribute('data-edit-count', history!);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '입력 토글 1: 1', exact: true }).dblclick();
  await expect(dialog(page)).toBeVisible();
  await dialog(page).getByLabel('이름', { exact: true }).fill('A');
  await dialog(page).getByRole('button', { name: '적용', exact: true }).click();
  await expect(symbols(page).first().locator('.label')).toHaveText('A');
});
