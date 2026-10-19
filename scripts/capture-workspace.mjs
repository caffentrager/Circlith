// Start the editor/simulation preview servers first. Optional BEFORE URLs must serve the same base revision.
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';

await mkdir('build', { recursive: true });
const targets = [
  ['editor', 'after', process.env.UI_EDITOR_URL || 'http://127.0.0.1:4173/Circlith/'],
  ['simulation', 'after', process.env.UI_SIMULATION_URL || 'http://127.0.0.1:4174/Circlith/'],
  ['editor', 'before', process.env.UI_EDITOR_BEFORE_URL],
  ['simulation', 'before', process.env.UI_SIMULATION_BEFORE_URL],
];
const browser = await chromium.launch();
try {
  for (const [mode, phase, url] of targets) {
    if (!url) continue;
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(url);
    const click = async (x, y) => {
      const box = await page.locator('main svg').boundingBox();
      await page.mouse.click(box.x + x, box.y + y);
    };
    for (const [kind, x, y] of [
      ['Input', 120, 180], ['Input', 120, 360], ['XOR', 400, 180],
      ['AND', 400, 360], ['Output', 680, 180], ['Output', 680, 360],
    ]) {
      await page.locator('.library').getByRole('button', { name: kind, exact: true }).click();
      await click(x, y);
    }
    const pins = page.locator('main [data-pin]');
    for (const [from, to] of [[0, 2], [1, 3], [0, 5], [1, 6], [4, 8], [7, 9]]) {
      await pins.nth(from).click(); await pins.nth(to).click(); await page.keyboard.press('Escape');
    }
    if (mode === 'simulation') {
      await page.getByRole('button', { name: '시뮬레이션', exact: true }).click();
      await page.getByRole('region', { name: '조합논리 시뮬레이션', exact: true }).getByRole('combobox', { name: 'Input 1 값', exact: true }).selectOption('1');
    }
    await click(400, 180);
    assert.equal(await page.locator('main [data-layer="symbols"] [data-component]').count(), 6);
    assert.equal(await page.locator('main [data-wire]').count(), 6);
    if (mode === 'simulation') assert.deepEqual(await page.locator('[data-output]').allTextContents(), ['1', '0']);
    await page.screenshot({ path: `build/${mode}-1440x900-${phase}.png` });
    if (errors.length) throw new Error(`${mode}/${phase}: ${errors.join('; ')}`);
    console.log(`${mode}/${phase}: six components, six wires, no page errors`);
    await page.close();
  }
} finally { await browser.close(); }
