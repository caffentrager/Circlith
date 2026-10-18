import { test } from '@playwright/test';
import { addComponent, connect, emptyCircuit } from '../src/model/circuit';
import { pinPosition, route } from '../src/geometry/geometry';
import { injectCircuit, saveKey, simButton, SCREENS } from './lib';

test('P3-11 INVALID_CIRCUIT presentation: topology-valid circuit with a diagonal wire', async ({ page }) => {
  await page.goto('/');
  const c = emptyCircuit();
  const a = addComponent(c, 'Input', { x: 100, y: 150 }), n = addComponent(c, 'NOT', { x: 320, y: 150 }), o = addComponent(c, 'Output', { x: 540, y: 150 });
  const wire = (from: string, to: string) => connect(c, { type: 'pin', id: from }, { type: 'pin', id: to }, route(pinPosition(c, from), pinPosition(c, to)));
  wire(c.components[a].pins[0], c.components[n].pins[0]); wire(c.components[n].pins[1], c.components[o].pins[0]);
  const w = Object.values(c.geometry.wires)[0];
  w.points = [w.points[0], { x: w.points[0].x + 7, y: w.points[0].y + 9 }, w.points.at(-1)!]; // diagonal: geometry invalid, topology valid
  await injectCircuit(page, c);
  await page.mouse.move(600, 400); await page.mouse.wheel(0, 1); await page.mouse.wheel(0, -1);
  await simButton(page).click();
  await page.waitForTimeout(300);
  const result = {
    output: await page.locator('[data-output]').innerText(),
    diagnostics: await page.locator('[data-diagnostic-code]').allInnerTexts(),
    wireValues: await page.locator('main [data-wire-value]').allInnerTexts(),
    pinTitles: await page.locator('main [data-layer="pins"] [data-pin] title').allTextContents(),
    inputBody: await page.locator('main [data-component]').first().getAttribute('data-value'),
  };
  await page.screenshot({ path: `${SCREENS}/invalid-circuit-display.png` });
  saveKey('browser-invalid', 'p3-11', result);
});
