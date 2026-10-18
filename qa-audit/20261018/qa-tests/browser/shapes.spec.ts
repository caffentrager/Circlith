import { test } from '@playwright/test';
import { addComponent, emptyCircuit, type Kind } from '../src/model/circuit';
import { updateComponentProperties } from '../src/model/component-properties';
import { injectCircuit, SCREENS } from './lib';

test('visual gallery: every variable gate x {2,3,4,8,16} inputs, plain and all-inverted, rotation 0 and 90', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/');
  for (const rotation of [0, 90]) for (const inverted of [false, true]) {
    let c = emptyCircuit();
    const kinds: Kind[] = ['AND', 'NAND', 'OR', 'NOR', 'XOR', 'XNOR'];
    kinds.forEach((kind, row) => [2, 3, 4, 8, 16].forEach((n, col) => {
      const x = 140 + col * (rotation ? 360 : 200), y = 200 + row * (rotation ? 280 : 360);
      const key = addComponent(c, kind, { x: rotation ? x : x, y: rotation ? y + 0 : y + (n > 4 ? n * 2 : 0) }, rotation);
      c = updateComponentProperties(c, key, { name: `${kind}${n}`, inputCount: n, invertedInputs: Array(n).fill(inverted) });
    }));
    await injectCircuit(page, c);
    await page.mouse.move(900, 500); await page.mouse.wheel(0, 1); await page.waitForTimeout(150); await page.mouse.wheel(0, -1); await page.waitForTimeout(300);
    await page.screenshot({ path: `${SCREENS}/gallery-rot${rotation}-${inverted ? 'inverted' : 'plain'}.png` });
  }
});
