import { test } from '@playwright/test';
import { addComponent, emptyCircuit, type Kind } from '../src/model/circuit';
import { updateComponentProperties } from '../src/model/component-properties';
import { injectCircuit, SCREENS } from './lib';

test.use({ deviceScaleFactor: 3, viewport: { width: 1400, height: 900 } });
test('closeups of the outermost inverted inputs for 8/16-input XOR vs AND vs OR', async ({ page }) => {
  await page.goto('/');
  let c = emptyCircuit();
  const spec: [Kind, number, number][] = [['AND', 16, 250], ['OR', 16, 520], ['XOR', 16, 800], ['XOR', 7, 1250], ['XOR', 8, 1250]];
  const keys: string[] = [];
  for (const [kind, n, x] of spec.slice(0, 3)) {
    const k = addComponent(c, kind, { x, y: 400 }); keys.push(k);
    c = updateComponentProperties(c, k, { name: `${kind}${n}`, inputCount: n, invertedInputs: Array(n).fill(true) });
  }
  await injectCircuit(page, c);
  await page.mouse.move(700, 400); await page.mouse.wheel(0, 1); await page.waitForTimeout(150); await page.mouse.wheel(0, -1); await page.waitForTimeout(300);
  for (const [i, [kind]] of spec.slice(0, 3).entries()) {
    const gate = page.locator('main [data-layer="symbols"] [data-component]').nth(i);
    const b = (await gate.boundingBox())!;
    // top 60px of the gate (outermost input) at 3x device scale
    await page.screenshot({ path: `${SCREENS}/closeup-${kind}16-top.png`, clip: { x: b.x - 15, y: b.y - 5, width: 110, height: 70 } });
  }
});
