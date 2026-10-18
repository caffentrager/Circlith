import { test, expect, type Page } from '@playwright/test';
import { injectCircuit, saveKey, simButton, SCREENS } from './lib';
import { snake } from './gen';
import { validateCircuit } from '../src/model/connections';

const FILE = 'browser-performance';
const stats = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return { n: xs.length, median: +s[Math.floor(s.length / 2)].toFixed(1), p95: +s[Math.min(s.length - 1, Math.floor(s.length * 0.95))].toFixed(1), max: +s.at(-1)!.toFixed(1), min: +s[0].toFixed(1) }; };
const frame = (page: Page, body: string) => page.evaluate(`(async () => {
  const t0 = performance.now(); let sync = 0;
  ${body}
  sync = performance.now() - t0;
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  return { sync, frame: performance.now() - t0 };
})()`) as Promise<{ sync: number; frame: number }>;

for (const gates of [100, 500, 1000, 2000]) {
  test(`browser performance with ${gates} gates`, async ({ page }) => {
    test.setTimeout(600000);
    const circuit = snake(gates);
    expect(validateCircuit(circuit)).toEqual([]);
    await page.goto('/');
    await page.evaluate(() => { (window as any).__errors = []; window.addEventListener('error', e => (window as any).__errors.push(String(e.message))); });
    await injectCircuit(page, circuit);
    const out: Record<string, unknown> = { gates, components: Object.keys(circuit.components).length, wires: Object.keys(circuit.geometry.wires).length };
    // first render with simulation ON (compile + simulate + full SVG)
    const t0 = Date.now();
    await simButton(page).click();
    await page.locator('main [data-input-toggle]').first().waitFor({ timeout: 120000 });
    out.simulationOnToToggleVisibleMs = Date.now() - t0;
    out.domNodes = await page.evaluate(() => document.querySelectorAll('main svg *').length);
    // input value changes through the side panel select
    const sel = 'select[aria-label="Input 1 값"]';
    const changes: number[] = [], changeFrames: number[] = [];
    for (let i = 0; i < 30; i++) {
      const r = await frame(page, `const el = document.querySelector('${sel}'); const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set; setter.call(el, ${i % 2 ? "'0'" : "'1'"}); el.dispatchEvent(new Event('change', { bubbles: true }));`);
      changes.push(r.sync); changeFrames.push(r.frame);
    }
    out.inputPanelChange = { sync: stats(changes), toNextFrame: stats(changeFrames) };
    // toggle by click on the input body
    const toggles: number[] = [], toggleFrames: number[] = [];
    for (let i = 0; i < 30; i++) {
      const r = await frame(page, `document.querySelector('[data-input-toggle]').dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));`);
      toggles.push(r.sync); toggleFrames.push(r.frame);
    }
    out.inputBodyToggle = { sync: stats(toggles), toNextFrame: stats(toggleFrames) };
    // wheel zoom steps (bridge/useMemo + full render on zoom change)
    const wheels: number[] = [];
    for (let i = 0; i < 20; i++) {
      const r = await frame(page, `const svg = document.querySelector('main svg'); const b = svg.getBoundingClientRect(); svg.dispatchEvent(new WheelEvent('wheel', { deltaY: ${i % 2 ? 40 : -40}, bubbles: true, cancelable: true, clientX: b.x + 400, clientY: b.y + 300 }));`);
      wheels.push(r.frame);
    }
    out.wheelZoomStep = stats(wheels);
    // pan with Space+drag is gesture driven; measure pointer-move frames using real mouse events
    const b = (await page.locator('main svg').boundingBox())!;
    await page.keyboard.down('Space');
    await page.mouse.move(b.x + 400, b.y + 300); await page.mouse.down();
    const pans: number[] = [];
    for (let i = 0; i < 20; i++) {
      const t = Date.now();
      await page.mouse.move(b.x + 400 + i * 6, b.y + 300 + i * 3);
      await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
      pans.push(Date.now() - t);
    }
    await page.mouse.up(); await page.keyboard.up('Space');
    out.panMoveToFrame = stats(pans);
    out.pageErrors = await page.evaluate(() => (window as any).__errors);
    if (gates === 1000) await page.screenshot({ path: `${SCREENS}/perf-1000-gates.png` });
    // memory snapshot (informational; GC not controlled)
    out.usedHeapMB = await page.evaluate(() => Math.round(((performance as any).memory?.usedJSHeapSize ?? 0) / 1048576));
    saveKey(FILE, `${gates} gates`, out);
  });
}

test('Properties apply / Undo / Redo / selection latency at 1000 gates', async ({ page }) => {
  test.setTimeout(600000);
  const circuit = snake(1000);
  await page.goto('/');
  await injectCircuit(page, circuit);
  await simButton(page).click();
  await page.locator('main [data-input-toggle]').first().waitFor({ timeout: 120000 });
  const out: Record<string, unknown> = {};
  // selection click on a gate body (real mouse)
  const gate = page.locator('main [data-layer="symbols"] [data-component] [data-gate-shape="AND"]').first();
  await gate.scrollIntoViewIfNeeded().catch(() => {});
  const t = Date.now();
  await gate.dispatchEvent('pointerdown', { button: 0, bubbles: true });
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  out.selectionPointerdownToFrameMs = Date.now() - t;
  // Properties: open via dblclick event, change count, apply
  const open = await frame(page, `const g = document.querySelector('main [data-layer=symbols] [data-component] [data-gate-shape=AND]'); const r = g.getBoundingClientRect(); g.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true, button: 0, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 }));`);
  out.propertiesOpen = open;
  const dialogOpen = await page.getByRole('dialog', { name: 'Properties · 부품 속성', exact: true }).count();
  out.dialogOpen = dialogOpen;
  if (dialogOpen) {
    const apply = await frame(page, `const d = document.querySelector('[role=dialog][aria-modal=true]'); const n = d.querySelector('input[type=number]'); const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; setter.call(n, '8'); n.dispatchEvent(new Event('input', { bubbles: true }));`);
    out.countTyping = apply;
    const submit = await frame(page, `const d = document.querySelector('[role=dialog][aria-modal=true]'); [...d.querySelectorAll('button')].find(b => b.textContent === '적용').click();`);
    out.propertiesApply = submit;
    const undo = await frame(page, `[...document.querySelectorAll('header button')].find(b => b.textContent === 'Undo').click();`);
    const redo = await frame(page, `[...document.querySelectorAll('header button')].find(b => b.textContent === 'Redo').click();`);
    out.undo = undo; out.redo = redo;
  }
  saveKey(FILE, 'latency 1000 gates', out);
});
