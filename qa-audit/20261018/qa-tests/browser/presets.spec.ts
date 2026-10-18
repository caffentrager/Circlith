import { test } from '@playwright/test';
import { box, diffSnap, inverter, saveKey, snap } from './lib';

const presets = ['circlith-modern', 'kicad-9', 'altium-designer-2026', 'easyeda-pro', 'fusion-electronics-2026', 'fusion-navigation', 'shapr3d-navigation', 'figma-modern-canvas'];
const drag = async (page: import('@playwright/test').Page, x: number, y: number, button: 'left' | 'middle' | 'right') => {
  await page.mouse.move(x, y); await page.mouse.down({ button });
  for (let i = 1; i <= 6; i++) await page.mouse.move(x + 12 * i, y + 8 * i);
  await page.mouse.up({ button });
};

test('F2 across input presets: navigation gestures on Input centre vs background, simulation ON vs OFF', async ({ page }) => {
  test.setTimeout(600000);
  const rows: Record<string, unknown>[] = [];
  for (const preset of presets) for (const simulation of [false, true]) for (const [name, run] of [
    ['MMB drag', (x: number, y: number) => drag(page, x, y, 'middle')],
    ['RMB drag', (x: number, y: number) => drag(page, x, y, 'right')],
    ['LMB drag', (x: number, y: number) => drag(page, x, y, 'left')],
    ['Space+LMB drag', async (x: number, y: number) => { await page.keyboard.down('Space'); await drag(page, x, y, 'left'); await page.keyboard.up('Space'); }],
    ['RMB click', async (x: number, y: number) => { await page.mouse.click(x, y, { button: 'right' }); }],
  ] as const) for (const [posName, px, py] of [['input centre', 100, 150], ['background', 420, 420]] as const) {
    await page.goto('/');
    await page.getByRole('button', { name: '설정', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Input & Controls' });
    await dialog.getByLabel('Control Preset', { exact: true }).selectOption(preset);
    await dialog.getByRole('button', { name: '닫기', exact: true }).click();
    await inverter(page, simulation);
    const b = await box(page);
    await page.mouse.click(b.x + 800, b.y + 500); await page.keyboard.press('Escape');
    const before = await snap(page);
    await run(b.x + px, b.y + py);
    await page.waitForTimeout(60);
    const d = diffSnap(before, await snap(page));
    rows.push({ preset, simulation, gesture: name, position: posName, panned: d.panned, moved: d.moved, selectionChanged: d.selectionChanged, menuOpened: d.menuOpened, valueChanged: d.valueChanged });
  }
  saveKey('browser-presets', 'f2-across-presets', rows);
  // Summarise: gestures that have an effect with simulation OFF at the Input centre but none with simulation ON
  const key = (r: any) => `${r.preset}|${r.gesture}|${r.position}`;
  const off = new Map((rows as any[]).filter(r => !r.simulation).map(r => [key(r), r]));
  const lost = (rows as any[]).filter(r => r.simulation && r.position === 'input centre').flatMap(r => {
    const o = off.get(key(r)) as any;
    return ['panned', 'moved', 'selectionChanged', 'menuOpened'].filter(e => o[e] && !r[e]).map(e => ({ preset: r.preset, gesture: r.gesture, lost: e }));
  });
  saveKey('browser-presets', 'lost-effects-with-simulation-on', lost);
});
