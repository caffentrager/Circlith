import { expect, test, type Page } from '@playwright/test';

async function place(page: Page, kind: string, x: number, y: number) {
  await page.locator('.library').getByRole('button', { name: kind, exact: true }).click();
  const box = (await page.locator('main > svg').boundingBox())!;
  await page.mouse.click(box.x + x, box.y + y);
  return (await page.locator('main [data-component]').last().getAttribute('data-component'))!;
}
async function wire(page: Page, from: number, to: number) {
  for (const i of [from, to]) {
    const pin = (await page.locator('main [data-pin]').nth(i).boundingBox())!;
    await page.mouse.click(pin.x + pin.width / 2, pin.y + pin.height / 2);
  }
}
async function fixture(page: Page) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('./');
  const input = await place(page, 'Input', 140, 100);
  const clock = await place(page, 'Clock', 140, 260);
  const ff = await place(page, 'DFF', 420, 180);
  const output = await place(page, 'Output', 680, 180);
  await wire(page, 0, 2); await wire(page, 1, 3); await wire(page, 4, 5);
  await expect(page.locator('main [data-wire]')).toHaveCount(3);
  await page.getByRole('button', { name: '시뮬레이션', exact: true }).click();
  return { input, clock, ff, output };
}
const clock = (page: Page) => page.getByLabel('시뮬레이션 시각', { exact: true });
const signalTab = (page: Page) => page.getByRole('tab', { name: /^입출력 · 진단/ });

test('DFF samples at the active edge; waveform history never rewinds live state', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  const { output } = await fixture(page);
  const sink = page.locator(`main [data-component="${output}"]`);
  await expect(sink).toHaveAttribute('data-value', 'X');
  await signalTab(page).click();
  await page.getByLabel('Input 1 값', { exact: true }).selectOption('1');
  await page.getByRole('tab', { name: '파형', exact: true }).click();
  const edits = await page.locator('header').getAttribute('data-edit-count');
  await page.getByRole('button', { name: '다음 이벤트', exact: true }).click();
  await expect(clock(page)).toHaveAttribute('data-time', '5');
  await expect(sink).toHaveAttribute('data-value', '1');
  await signalTab(page).click(); await page.getByLabel('Input 1 값', { exact: true }).selectOption('0');
  await expect(sink).toHaveAttribute('data-value', '1');
  await page.getByRole('button', { name: '다음 이벤트', exact: true }).click();
  await expect(clock(page)).toHaveAttribute('data-time', '10');
  await expect(sink).toHaveAttribute('data-value', '1');
  await page.getByRole('button', { name: '다음 이벤트', exact: true }).click();
  await expect(sink).toHaveAttribute('data-value', '0');
  await page.getByRole('tab', { name: '파형', exact: true }).click();
  await page.getByLabel('파형 커서', { exact: true }).fill('1');
  await expect(page.getByLabel('파형 관측 시각')).toContainText('과거 관측 t=5');
  await expect(sink).toHaveAttribute('data-value', '0');
  await expect(clock(page)).toHaveAttribute('data-time', '15');
  await page.getByRole('button', { name: '현재로', exact: true }).click();
  await expect(page.getByLabel('파형 관측 시각')).toContainText('현재 t=15');
  await expect(page.locator('header')).toHaveAttribute('data-edit-count', edits!);
  await page.screenshot({ path: 'build/sequential-dff.png' });
  expect(errors).toEqual([]);
});

test('Run locks editing and inputs, pause retains time, reset keeps external inputs', async ({ page }) => {
  const { ff, output } = await fixture(page);
  await signalTab(page).click(); await page.getByLabel('Input 1 값', { exact: true }).selectOption('1');
  await page.getByRole('button', { name: '실행', exact: true }).click();
  await expect.poll(async () => Number(await clock(page).getAttribute('data-time'))).toBeGreaterThan(0);
  await expect(page.locator('.library').getByRole('button', { name: 'AND', exact: true })).toBeDisabled();
  await expect(page.locator('header').getByRole('button', { name: 'Undo', exact: true })).toBeDisabled();
  await expect(page.getByLabel('Input 1 값', { exact: true })).toBeDisabled();
  const gate = page.locator(`main [data-component="${ff}"]`), transform = await gate.getAttribute('transform');
  const box = (await gate.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down(); await page.mouse.move(box.x + 100, box.y + 70, { steps: 5 }); await page.mouse.up();
  await page.keyboard.press('Delete');
  await expect(gate).toHaveAttribute('transform', transform!);
  await expect(page.locator('main [data-component]')).toHaveCount(4);
  await page.getByRole('button', { name: '일시정지', exact: true }).click();
  const paused = await clock(page).getAttribute('data-time');
  await page.waitForTimeout(650); await expect(clock(page)).toHaveAttribute('data-time', paused!);
  await page.getByRole('button', { name: '시뮬레이션', exact: true }).click();
  await expect(clock(page)).toHaveCount(0);
  await page.getByRole('button', { name: '시뮬레이션', exact: true }).click();
  await expect(clock(page)).toHaveAttribute('data-time', paused!);
  await signalTab(page).click();
  await page.getByRole('button', { name: '초기화', exact: true }).click();
  await expect(clock(page)).toHaveAttribute('data-time', '0');
  await expect(page.getByLabel('Input 1 값', { exact: true })).toHaveValue('1');
  await expect(page.locator(`main [data-component="${output}"]`)).toHaveAttribute('data-value', 'X');
  await page.getByRole('button', { name: '다음 이벤트', exact: true }).click();
  await expect(page.locator(`main [data-component="${output}"]`)).toHaveAttribute('data-value', '1');
});

test('Clock/DFF Properties are undoable; committed edits and Undo reset the session', async ({ page }) => {
  const { clock: source, ff, output } = await fixture(page);
  await page.getByRole('button', { name: '다음 이벤트', exact: true }).click();
  const sourcePart = page.locator(`main [data-component="${source}"]`);
  await sourcePart.dblclick();
  const dialog = page.getByRole('dialog', { name: 'Properties · 부품 속성' });
  await dialog.getByLabel('주기 (µs)', { exact: true }).fill('12');
  await dialog.getByLabel('듀티 (%)', { exact: true }).fill('25');
  await dialog.getByLabel('초기 레벨', { exact: true }).selectOption('1');
  await dialog.getByRole('button', { name: '적용', exact: true }).click();
  await expect(clock(page)).toHaveAttribute('data-time', '0');
  await page.getByRole('button', { name: '다음 이벤트', exact: true }).click();
  await expect(clock(page)).toHaveAttribute('data-time', '3');
  await page.locator('header').getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(clock(page)).toHaveAttribute('data-time', '0');
  await page.getByLabel('Step 진행 기준', { exact: true }).selectOption('rising');
  await page.getByRole('button', { name: '다음 상승엣지', exact: true }).click();
  await expect(clock(page)).toHaveAttribute('data-time', '5');
  await page.getByRole('button', { name: '다음 상승엣지', exact: true }).click();
  await expect(clock(page)).toHaveAttribute('data-time', '15');
  await page.getByLabel('Step 진행 기준', { exact: true }).selectOption('period');
  await page.getByRole('button', { name: '한 주기 진행', exact: true }).click();
  await expect(clock(page)).toHaveAttribute('data-time', '25');
  const state = page.locator(`main [data-component="${ff}"]`);
  await state.dblclick();
  await dialog.getByLabel('초기 Q', { exact: true }).selectOption('1');
  await dialog.getByRole('button', { name: '취소', exact: true }).click();
  await expect(clock(page)).toHaveAttribute('data-time', '25');
  await state.dblclick();
  await dialog.getByLabel('동작 엣지', { exact: true }).selectOption('falling');
  await dialog.getByLabel('초기 Q', { exact: true }).selectOption('1');
  await dialog.getByRole('button', { name: '적용', exact: true }).click();
  await expect(clock(page)).toHaveAttribute('data-time', '0');
  await expect(state.locator('[data-clock-edge="falling"]')).toHaveCount(1);
  const sink = page.locator(`main [data-component="${output}"]`);
  await expect(sink).toHaveAttribute('data-value', '1');
  await page.getByLabel('Step 진행 기준', { exact: true }).selectOption('event');
  await page.getByRole('button', { name: '다음 이벤트', exact: true }).click();
  await expect(sink).toHaveAttribute('data-value', '1');
  await page.getByRole('button', { name: '다음 이벤트', exact: true }).click();
  await expect(sink).toHaveAttribute('data-value', '0');
});

test('no scheduled events is explicit and small screens retain execution and view controls', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 420 }); await page.goto('./');
  await place(page, 'DFF', 260, 140);
  await page.getByRole('button', { name: '시뮬레이션', exact: true }).click();
  await expect(page.getByRole('button', { name: '실행', exact: true })).toBeDisabled();
  await expect(page.getByText(/예약 이벤트 없음/)).toBeVisible();
  await expect(page.getByRole('button', { name: '다음 이벤트', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Inspector', exact: true }).click();
  const run = (await page.getByRole('button', { name: '실행', exact: true }).boundingBox())!;
  const panel = (await page.getByRole('complementary', { name: 'Inspector', exact: true }).boundingBox())!;
  expect(panel.y).toBeGreaterThanOrEqual(run.y + run.height);
  const zoom = page.getByRole('button', { name: '확대', exact: true });
  const beforeZoom = parseInt((await page.getByLabel('확대율').textContent())!);
  const drawing = (await page.locator('main > svg').boundingBox())!;
  const part = (await page.locator('main [data-component]').boundingBox())!;
  expect(part.y).toBeGreaterThanOrEqual(drawing.y);
  expect(part.y + part.height).toBeLessThanOrEqual(drawing.y + drawing.height);
  await expect(zoom).toBeVisible(); await zoom.click();
  expect(parseInt((await page.getByLabel('확대율').textContent())!)).toBeGreaterThan(beforeZoom);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth || document.documentElement.scrollHeight > innerHeight)).toBe(false);
  await page.screenshot({ path: 'build/sequential-small.png' });
});
