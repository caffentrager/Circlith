import { test, expect, type Page } from '@playwright/test';
import { wheelToZoom } from './zoom-helper';

test.use({ baseURL: process.env.CIRCLITH_QA_URL || 'http://127.0.0.1:5173/' });
const mode = process.env.CIRCLITH_QA_MODE || 'simulation';
const inspector = (page: Page) => page.getByRole('region', { name: '선택 속성', exact: true });
async function point(page: Page, x: number, y: number) {
  const b = (await page.locator('main svg').boundingBox())!;
  await page.mouse.click(b.x + x, b.y + y);
}
async function place(page: Page, kind: string, x: number, y: number) {
  await page.locator('.library').getByRole('button', { name: kind, exact: true }).click();
  await point(page, x, y);
}
test.beforeEach(async ({ page }) => { await page.goto('./'); });

for (const [width, height] of [[1024, 420], [1280, 720], [1440, 900], [1920, 1080]]) {
  test(`workspace at ${width}x${height} exposes tools and panels without page overflow`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewportSize({ width, height });
    await page.reload();
    await expect(page.getByRole('button', { name: '시뮬레이션', exact: true })).toHaveCount(mode === 'editor' ? 0 : 1);
    await expect(page.locator('header').getByRole('button', { name: 'Undo', exact: true })).toBeDisabled();
    await place(page, 'AND', 200, 150);
    if (width < 1200) await page.getByRole('button', { name: 'Inspector', exact: true }).click();
    await expect(inspector(page).getByRole('heading', { name: 'AND 1', exact: true })).toBeVisible();
    await page.screenshot({ path: `build/workspace-${mode}-${width}x${height}.png` });
    await page.getByRole('button', { name: 'Inspector 닫기', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Inspector', exact: true })).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByRole('status')).toContainText('선택 1');
    expect(await page.evaluate(() => ({ x: document.documentElement.scrollWidth > innerWidth, y: document.documentElement.scrollHeight > innerHeight, scroll: scrollY }))).toEqual({ x: false, y: false, scroll: 0 });
    expect(errors).toEqual([]);
  });
}

test('Inspector follows overview, component, multiple selection and Properties with one Undo', async ({ page }) => {
  await expect(inspector(page).getByRole('heading', { name: '회로 개요' })).toBeVisible();
  await place(page, 'AND', 220, 160);
  await inspector(page).getByRole('button', { name: '속성 편집…' }).click();
  const dialog = page.getByRole('dialog', { name: 'Properties · 부품 속성', exact: true });
  await dialog.getByLabel('이름', { exact: true }).fill('ENABLE');
  await dialog.getByLabel('입력 수', { exact: true }).fill('16');
  await dialog.getByLabel('입력 16 반전', { exact: true }).check();
  await dialog.getByRole('button', { name: '적용', exact: true }).click();
  await expect(inspector(page).getByRole('heading', { name: 'ENABLE', exact: true })).toBeVisible();
  await expect(page.locator('main [data-pin]')).toHaveCount(17);
  await expect(page.locator("header")).toHaveAttribute("data-edit-count", "2");
  await page.keyboard.press('Control+z');
  await expect(inspector(page).getByRole('heading', { name: 'AND 1', exact: true })).toBeVisible();
  await expect(page.locator('main [data-pin]')).toHaveCount(3);
  await place(page, 'OR', 450, 160);
  await page.getByRole('tab', { name: '도면 트리', exact: true }).click();
  await page.locator('[data-outline-object]').first().click({ modifiers: ['Shift'] });
  await expect(inspector(page).getByRole('heading', { name: '2개 객체 선택' })).toBeVisible();
  await expect(page.locator("header")).toHaveAttribute("data-edit-count", "2");
  await point(page, 600, 300);
  await expect(inspector(page).getByRole('heading', { name: '회로 개요' })).toBeVisible();
});

test('wire Inspector and panel collapse preserve topology, zoom coordinates and history', async ({ page }) => {
  await place(page, 'Input', 100, 140); await place(page, 'Output', 500, 140);
  const pins = page.locator('main [data-pin]');
  await pins.first().click(); await pins.last().click(); await page.keyboard.press('Escape');
  await point(page, 300, 140);
  await expect(inspector(page).getByRole('heading', { name: '배선과 연결망' })).toBeVisible();
  const wire = page.locator('main [data-wire]'), points = await wire.getAttribute('points');
  await page.getByRole('button', { name: '라이브러리 패널', exact: true }).click();
  await expect(page.locator('.library')).toBeHidden();
  await page.getByRole('button', { name: 'Inspector 닫기', exact: true }).click();
  await page.getByRole('button', { name: '확대', exact: true }).click();
  await expect(page.getByLabel('확대율', { exact: true })).toHaveText('110%');
  const [id, x, y] = await page.locator('main [data-pin]').first().evaluate(el => [el.getAttribute('data-pin'), el.getAttribute('cx'), el.getAttribute('cy')]);
  const matrix = await page.locator('main svg > g').first().evaluate(el => {
    const m = (el as SVGGraphicsElement).getScreenCTM()!; return { a: m.a, d: m.d, e: m.e, f: m.f };
  });
  await page.mouse.click(Number(x) * matrix.a + matrix.e, Number(y) * matrix.d + matrix.f);
  await expect(page.locator('main svg')).toHaveAttribute('data-operation', 'WIRE_DRAFT');
  expect(id).toBeTruthy();
  await page.keyboard.press('Escape');
  await expect(wire).toHaveAttribute('points', points!);
  await expect(page.locator("header")).toHaveAttribute("data-edit-count", "3");
});

test('analysis dock locates warnings without editing and keeps signal meanings visible', async ({ page }) => {
  test.skip(mode === 'editor', 'Analysis is available in simulation mode.');
  await place(page, 'AND', 240, 180);
  await page.getByRole('button', { name: '시뮬레이션', exact: true }).click();
  const dock = page.getByRole('region', { name: '회로 분석', exact: true });
  await expect(dock.getByRole('button', { name: '입출력과 회로 진단', exact: true })).toHaveAttribute('aria-expanded', 'true');
  await expect(dock).toContainText('X 불명확');
  await expect(dock).toContainText('Z 구동 없음');
  await dock.locator('li button').first().click();
  await expect(page.locator('main .symbol.selected')).toHaveCount(1);
  await expect(page.locator("header")).toHaveAttribute("data-edit-count", "1");
  await page.screenshot({ path: `build/workspace-${mode}-analysis.png` });
});

test('half-size I/O bodies keep wired pins aligned and support 800% zoom', async ({ page }) => {
  await place(page, 'Input', 100, 150); await place(page, 'Output', 400, 150);
  const bodySize = (kind: string) => page.locator(`main [data-port-shape="${kind}"]`).evaluate(el => {
    const shape = el as SVGGraphicsElement, box = shape.getBBox(), matrix = shape.getScreenCTM()!;
    return { width: box.width * Math.hypot(matrix.a, matrix.b), height: box.height * Math.hypot(matrix.c, matrix.d) };
  });
  for (const kind of ['Input', 'Output']) {
    const body = await bodySize(kind);
    expect(body.width).toBeCloseTo(26, 5);
    expect(body.height).toBeCloseTo(11, 5);
  }
  const pins = page.locator('main [data-pin]');
  await expect(pins.first()).toHaveAttribute('cx', '140');
  await expect(pins.last()).toHaveAttribute('cx', '360');
  await pins.first().click(); await pins.last().click(); await page.keyboard.press('Escape');
  const wire = page.locator('main [data-wire]');
  const original = await wire.getAttribute('points');
  const canvas = (await page.locator('main svg').boundingBox())!;
  await page.mouse.move(canvas.x + 100, canvas.y + 150);
  await wheelToZoom(page, 8);
  await expect(page.getByLabel('확대율', { exact: true })).toHaveText('800%');
  await expect(page.getByRole('status')).toContainText('800%');
  const body = await bodySize('Input');
  expect(body.width).toBeCloseTo(208, 5);
  expect(body.height).toBeCloseTo(88, 5);
  await pins.first().click();
  await expect(page.locator('main svg')).toHaveAttribute('data-operation', 'WIRE_DRAFT');
  await page.keyboard.press('Escape');
  await expect(wire).toHaveAttribute('points', original!);
  await page.mouse.wheel(0, -240);
  await expect(page.getByLabel('확대율', { exact: true })).toHaveText('800%');
  await expect(page.locator("header")).toHaveAttribute("data-edit-count", "3");
});
