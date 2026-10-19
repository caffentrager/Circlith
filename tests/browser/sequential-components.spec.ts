import { expect, test, type Page } from '@playwright/test';

async function place(page: Page, kind: string, x: number, y: number) {
  await page.locator('.library').getByRole('button', { name: kind, exact: true }).click();
  const canvas = (await page.locator('main > svg').boundingBox())!;
  await page.mouse.click(canvas.x + x, canvas.y + y);
  return (await page.locator('main [data-component]').last().getAttribute('data-component'))!;
}
async function wire(page: Page, from: number, to: number) {
  for (const index of [from, to]) {
    const pin = (await page.locator('main [data-pin]').nth(index).boundingBox())!;
    await page.mouse.click(pin.x + pin.width / 2, pin.y + pin.height / 2);
  }
  await page.keyboard.press('Escape');
}
async function setInputs(page: Page, values: string[]) {
  for (let i = 0; i < values.length; i++) await page.getByLabel(`Input ${i + 1} 값`, { exact: true }).selectOption(values[i]);
}
async function simulation(page: Page) {
  await page.getByRole('button', { name: '시뮬레이션', exact: true }).click();
  const signals = page.getByRole('tab', { name: /^입출력 · 진단/ });
  if (await signals.count()) await signals.click();
}
test.beforeEach(async ({ page }) => { await page.setViewportSize({ width: 1440, height: 1000 }); await page.goto('./'); });

const cases: { kind: string; inputs: number; transitions: [string[], string][] }[] = [
  { kind: 'JKFF', inputs: 3, transitions: [[['1','0','0'],'0'], [['1','0','1'],'1'], [['1','1','0'],'1'], [['1','1','1'],'0']] },
  { kind: 'TFF', inputs: 2, transitions: [[['1','1'],'1'], [['1','0'],'1'], [['1','1'],'0'], [['0','0'],'0'], [['0','1'],'0']] },
  { kind: 'SRFF', inputs: 3, transitions: [[['1','0','1'],'1'], [['0','0','0'],'1'], [['0','0','1'],'1'], [['0','1','0'],'1'], [['0','1','1'],'0']] },
  { kind: 'DFFE', inputs: 3, transitions: [[['1','0','1'],'0'], [['1','1','0'],'0'], [['1','1','1'],'1'], [['0','0','0'],'1'], [['0','0','1'],'1']] },
  { kind: 'DFFSR', inputs: 4, transitions: [[['0','0','1','0'],'1'], [['0','0','0','0'],'1'], [['0','0','0','1'],'0'], [['0','0','1','1'],'X']] },
  { kind: 'DLatch', inputs: 2, transitions: [[['1','0'],'0'], [['1','1'],'1'], [['0','1'],'0'], [['0','0'],'0'], [['1','0'],'0']] },
  { kind: 'SRLatch', inputs: 2, transitions: [[['1','0'],'1'], [['0','0'],'1'], [['0','1'],'0'], [['0','0'],'0'], [['1','1'],'X']] },
];
for (const example of cases) test(`${example.kind}: real pin wiring, input controls, state and waveform`, async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  for (let i = 0; i < example.inputs; i++) await place(page, 'Input', 120, 80 + 90 * i);
  const id = await place(page, example.kind, 420, 200), output = await place(page, 'Output', 680, 200);
  for (let i = 0; i < example.inputs; i++) await wire(page, i, example.inputs + i);
  await wire(page, 2 * example.inputs, 2 * example.inputs + 1);
  await expect(page.locator('main [data-wire]')).toHaveCount(example.inputs + 1);
  const component = page.locator(`main [data-component="${id}"]`);
  await component.dblclick();
  const dialog = page.getByRole('dialog', { name: 'Properties · 부품 속성' });
  await dialog.getByLabel('초기 Q', { exact: true }).selectOption('0');
  await dialog.getByRole('button', { name: '적용', exact: true }).click();
  await simulation(page);
  const edits = await page.locator('header').getAttribute('data-edit-count');
  for (const [inputs, value] of example.transitions) {
    await setInputs(page, inputs);
    await expect(page.locator(`main [data-component="${output}"]`)).toHaveAttribute('data-value', value);
  }
  await expect(page.locator('header')).toHaveAttribute('data-edit-count', edits!);
  await page.getByRole('tab', { name: '파형', exact: true }).click();
  await expect(page.getByLabel('파형 관측 시각')).toContainText('현재 t=0');
  if (example.kind === 'JKFF') await page.screenshot({ path: 'build/sequential-family-jk.png' });
  expect(errors).toEqual([]);
});

for (const [kind, truth] of [['AND','0001'],['OR','0111'],['XOR','0110'],['NAND','1110'],['NOR','1000'],['XNOR','1001'],['NOT','10']]) {
  test(`${kind}: all binary input combinations through actual canvas wiring`, async ({ page }) => {
    const count = kind === 'NOT' ? 1 : 2;
    for (let i = 0; i < count; i++) await place(page, 'Input', 120, 100 + i * 140);
    await place(page, kind, 420, 170);
    const out = await place(page, 'Output', 680, 170);
    for (let i = 0; i < count; i++) await wire(page, i, count + i);
    await wire(page, count * 2, count * 2 + 1);
    await expect(page.locator('main [data-wire]')).toHaveCount(count + 1);
    await simulation(page);
    for (let row = 0; row < truth.length; row++) {
      await setInputs(page, row.toString(2).padStart(count, '0').split(''));
      await expect(page.locator(`main [data-component="${out}"]`)).toHaveAttribute('data-value', truth[row]);
    }
  });
}

test('gate-built NOR latch can be set, held and reset in the real editor', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await place(page, 'Input', 120, 80); await place(page, 'Input', 120, 360);
  await place(page, 'NOR', 400, 140); await place(page, 'NOR', 400, 300);
  const q = await place(page, 'Output', 700, 140), qb = await place(page, 'Output', 700, 300);
  for (const [a,b] of [[1,2],[0,5],[4,6],[7,3],[4,8],[7,9]]) await wire(page,a,b);
  await expect(page.locator('main [data-wire]')).toHaveCount(6);
  await simulation(page);
  for (const [s,r,a,b] of [['1','0','1','0'],['0','0','1','0'],['0','1','0','1'],['0','0','0','1']]) {
    await setInputs(page,[s,r]);
    await expect(page.locator(`main [data-component="${q}"]`)).toHaveAttribute('data-value',a);
    await expect(page.locator(`main [data-component="${qb}"]`)).toHaveAttribute('data-value',b);
  }
  await expect(page.locator('[data-diagnostic-code="COMBINATIONAL_FEEDBACK"]')).toHaveCount(0);
  await page.getByRole('button', { name: '시뮬레이션', exact: true }).click();
  await page.getByRole('button', { name: '시뮬레이션', exact: true }).click();
  await expect(page.locator(`main [data-component="${q}"]`)).toHaveAttribute('data-value','0');
  await page.screenshot({ path: 'build/sequential-feedback-latch.png' });
  expect(errors).toEqual([]);
});

test('new memory properties remain undoable and the clock/enable polarity is visible', async ({ page }) => {
  const id = await place(page, 'JKFF', 300, 140), part = page.locator(`main [data-component="${id}"]`);
  await part.dblclick();
  const dialog = page.getByRole('dialog', { name: 'Properties · 부품 속성' });
  await dialog.getByLabel('동작 엣지', { exact: true }).selectOption('falling');
  await dialog.getByLabel('초기 Q', { exact: true }).selectOption('1');
  await dialog.getByRole('button', { name: '적용', exact: true }).click();
  await expect(part.locator('[data-clock-edge="falling"]')).toHaveCount(1);
  await page.locator('header').getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(part.locator('[data-clock-edge="falling"]')).toHaveCount(0);
  await page.locator('header').getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(part.locator('[data-clock-edge="falling"]')).toHaveCount(1);
  const latch = await place(page, 'DLatch', 600, 260);
  await page.locator(`main [data-component="${latch}"]`).dblclick();
  await dialog.getByLabel('활성 레벨', { exact: true }).selectOption('low');
  await dialog.getByRole('button', { name: '적용', exact: true }).click();
  await expect(page.locator(`main [data-component="${latch}"] [data-enable-level="low"]`)).toHaveCount(1);
});
