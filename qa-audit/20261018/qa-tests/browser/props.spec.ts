import { test, expect } from '@playwright/test';
import { box, inverter, place, propsDialog, saveKey, simButton, snap, SCREENS } from './lib';

const FILE = 'browser-properties';
const sym = (page: import('@playwright/test').Page) => page.locator('main [data-layer="symbols"] [data-component]');

test('modal key isolation: editor shortcuts typed in the name field do nothing', async ({ page }) => {
  await page.goto('/');
  await place(page, 'AND', 300, 250);
  await place(page, 'Input', 100, 250);
  const gate = sym(page).first();
  await gate.locator('[data-gate-shape]').dblclick();
  const dialog = propsDialog(page), name = dialog.getByLabel('이름', { exact: true });
  const before = await snap(page);
  const results: Record<string, unknown> = {};
  for (const key of ['w', 'W', 'm', 'r', 'g', 'a', 'Delete', 'Backspace', 'Control+z', 'Control+Shift+z', 'Control+a', 'Shift+r', 'Space', 'Tab', 'Shift+Tab']) {
    await page.keyboard.press(key);
    const s = await snap(page);
    results[key] = { propsStillOpen: s.props, history: s.history, components: s.components, operation: s.operation, transformsSame: JSON.stringify(s.transforms) === JSON.stringify(before.transforms) };
  }
  saveKey(FILE, 'key-isolation', results);
  for (const r of Object.values(results) as any[]) { expect(r.propsStillOpen).toBe(true); expect(r.components).toBe(before.components); expect(r.history).toBe(before.history); expect(r.operation).toBe('NONE'); }
  await expect(name).toBeVisible();
});

test('modal: Tab trap, Escape, focus restore, outside click, repeat open', async ({ page }) => {
  await page.goto('/');
  await place(page, 'AND', 300, 250);
  const gate = sym(page).first();
  const out: Record<string, unknown> = {};
  await gate.locator('[data-gate-shape]').dblclick();
  const dialog = propsDialog(page);
  out.initialFocus = await page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? document.activeElement?.tagName);
  const focusOrder: string[] = [];
  for (let i = 0; i < 12; i++) { await page.keyboard.press('Tab'); focusOrder.push(await page.evaluate(() => { const a = document.activeElement as HTMLElement; return a ? `${a.tagName}:${a.closest('label')?.textContent ?? a.textContent ?? ''}`.slice(0, 40) : 'none'; })); }
  out.tabOrder = focusOrder;
  out.focusEscapedModal = await page.evaluate(() => !document.activeElement?.closest('[role=dialog]'));
  for (let i = 0; i < 6; i++) await page.keyboard.press('Shift+Tab');
  out.shiftTabInside = await page.evaluate(() => !!document.activeElement?.closest('[role=dialog]'));
  // click on the backdrop (outside the dialog panel)
  const dbox = (await dialog.boundingBox())!;
  await page.mouse.click(dbox.x - 40, dbox.y - 40);
  out.dialogAfterBackdropClick = await dialog.count();
  if (await dialog.count()) await page.keyboard.press('Escape');
  out.activeAfterClose = await page.evaluate(() => document.activeElement?.tagName);
  await page.keyboard.press('Delete');
  out.componentsAfterDeleteShortcut = await sym(page).count();
  saveKey(FILE, 'modal-focus', out);
  expect(out.focusEscapedModal).toBe(false);
});

test('modal: open/close focus returns to canvas and shortcuts work afterwards (Input toggle -> Properties -> Escape -> W -> Escape -> Space pan -> Delete)', async ({ page }) => {
  await page.goto('/'); await inverter(page, true);
  const b = await box(page);
  const out: Record<string, unknown> = {};
  await page.mouse.click(b.x + 100, b.y + 150);                    // toggle
  await page.mouse.dblclick(b.x + 320, b.y + 150);                 // Properties of NOT
  out.dialogOpen = await propsDialog(page).count();
  await page.keyboard.press('Escape');
  out.afterEscape = { dialog: await propsDialog(page).count(), active: (await snap(page)).active };
  const pins = page.locator('main [data-layer="pins"] [data-pin]');
  const pb = (await pins.nth(3).boundingBox())!;
  await page.mouse.move(pb.x + pb.width / 2, pb.y + pb.height / 2);
  await page.keyboard.press('w');
  out.afterW = (await snap(page)).operation;
  await page.keyboard.press('Escape');
  out.afterEscDraft = (await snap(page)).operation;
  const v0 = (await snap(page)).viewport;
  await page.keyboard.down('Space'); await page.mouse.move(b.x + 420, b.y + 420); await page.mouse.down(); await page.mouse.move(b.x + 480, b.y + 470, { steps: 5 }); await page.mouse.up(); await page.keyboard.up('Space');
  out.panned = (await snap(page)).viewport !== v0;
  saveKey(FILE, 'focus-chain', out);
  expect(out.afterEscDraft).toBe('NONE');
});

test('name edge cases through the UI: 81 chars, whitespace, HTML text is inert, history unchanged on rejection', async ({ page }) => {
  await page.goto('/');
  await place(page, 'AND', 300, 250);
  const gate = sym(page).first();
  const out: Record<string, unknown> = {};
  const open = async () => { await gate.locator('[data-gate-shape]').dblclick(); return propsDialog(page); };
  const setRaw = (dialog: import('@playwright/test').Locator, value: string) => dialog.getByLabel('이름', { exact: true }).evaluate((el: HTMLInputElement, v) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!; setter.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
  let dialog = await open();
  const h0 = (await snap(page)).history;
  await dialog.getByLabel('이름', { exact: true }).fill('x'.repeat(81));
  out.fillResultLength = (await dialog.getByLabel('이름', { exact: true }).inputValue()).length; // typed input honours maxlength
  await setRaw(dialog, 'x'.repeat(81));                          // programmatic / paste-like bypass of maxlength
  out.rawLength = (await dialog.getByLabel('이름', { exact: true }).inputValue()).length;
  await dialog.getByRole('button', { name: '적용', exact: true }).click();
  out.dialogOpenAfter81 = await propsDialog(page).count();
  out.alert81 = (await dialog.getByRole('alert').count()) ? await dialog.getByRole('alert').innerText() : null;
  out.historyUnchangedAfter81 = (await snap(page)).history === h0;
  await page.keyboard.press('Escape');
  dialog = await open();
  await setRaw(dialog, '   ');
  await dialog.getByRole('button', { name: '적용', exact: true }).click();
  out.blankMessage = (await dialog.getByRole('alert').count()) ? await dialog.getByRole('alert').innerText() : 'native validation: ' + await dialog.getByLabel('이름', { exact: true }).evaluate((e: HTMLInputElement) => e.validationMessage);
  out.dialogOpenAfterBlank = await propsDialog(page).count();
  await page.keyboard.press('Escape');
  dialog = await open();
  const html = `<img src=x onerror="window.__xss=1"><b>bold</b>`;
  await setRaw(dialog, html);
  await dialog.getByRole('button', { name: '적용', exact: true }).click();
  await page.waitForTimeout(150);
  out.htmlLabel = await gate.locator('.label').textContent();
  out.xss = await page.evaluate(() => (window as any).__xss ?? null);
  out.injectedElements = await page.locator('main img, main b').count();
  await page.getByRole('tab', { name: '도면 트리', exact: true }).click();
  out.hierarchyText = (await page.locator('[data-outline-object]').allInnerTexts()).join(' | ');
  out.hierarchyInjected = await page.locator('.sidebar img, .sidebar b, aside img, aside b').count();
  await simButton(page).click();
  out.diagnosticsText = (await page.locator('[data-diagnostic-code]').allInnerTexts()).join(' | ').slice(0, 300);
  saveKey(FILE, 'name-edge-cases', out);
  expect(out.xss).toBeNull();
  expect(out.historyUnchangedAfter81).toBe(true);
});

test('modal backdrop click drops focus to BODY: Escape and shortcuts afterwards (Properties vs Settings)', async ({ page }) => {
  await page.goto('/');
  await place(page, 'AND', 300, 250);
  const out: Record<string, unknown> = {};
  for (const which of ['properties', 'settings'] as const) {
    if (which === 'properties') await sym(page).first().locator('[data-gate-shape]').dblclick();
    else await page.getByRole('button', { name: '설정', exact: true }).click();
    const dialog = which === 'properties' ? propsDialog(page) : page.getByRole('dialog', { name: 'Input & Controls' });
    const dbox = (await dialog.boundingBox())!;
    await page.mouse.click(Math.max(2, dbox.x - 30), Math.max(2, dbox.y - 30));      // backdrop
    const afterClick = { dialog: await dialog.count(), active: (await snap(page)).active };
    await page.keyboard.press('Escape');
    const afterEscape = { dialog: await dialog.count(), active: (await snap(page)).active };
    await page.keyboard.press('Tab');
    const afterTab = { insideDialog: await page.evaluate(() => !!document.activeElement?.closest('[role=dialog]')) };
    out[which] = { afterClick, afterEscape, afterTab };
    if (await dialog.count()) { await dialog.getByRole('button').first().focus(); await page.keyboard.press('Escape'); }
    out[`${which}ClosedByKeyboardAfterRefocus`] = (await dialog.count()) === 0;
  }
  saveKey(FILE, 'backdrop-focus', out);
});

test('16-input XOR with all bubbles: DOM geometry of bubbles vs pins in the real browser, rotation 0 and 90', async ({ page }) => {
  await page.goto('/');
  await place(page, 'XOR', 400, 400);
  await sym(page).first().locator('[data-gate-shape]').dblclick();
  const dialog = propsDialog(page);
  await dialog.getByLabel('입력 수', { exact: true }).fill('16');
  for (let i = 1; i <= 16; i++) await dialog.getByLabel(`입력 ${i} 반전`, { exact: true }).check();
  await dialog.getByRole('button', { name: '적용', exact: true }).click();
  const measure = () => page.evaluate(() => {
    const out: Record<string, unknown>[] = [];
    const bubbles = [...document.querySelectorAll('main [data-input-bubble]')] as SVGElement[];
    const pins = [...document.querySelectorAll('main [data-layer="pins"] [data-pin]')] as SVGElement[];
    const inputPins = pins.filter(p => (p.querySelector('title')?.textContent ?? '').startsWith('in'));
    bubbles.forEach((b, i) => {
      const br = b.getBoundingClientRect(), pr = inputPins[i].getBoundingClientRect();
      const bc = { x: br.x + br.width / 2, y: br.y + br.height / 2 }, pc = { x: pr.x + pr.width / 2, y: pr.y + pr.height / 2 };
      const d = Math.hypot(bc.x - pc.x, bc.y - pc.y);
      out.push({ index: i, distance: +d.toFixed(2), bubbleRadius: +(br.width / 2).toFixed(2), pinRadius: +(pr.width / 2).toFixed(2), pinInsideBubble: d < br.width / 2 });
    });
    return out;
  });
  const r0 = await measure();
  await page.screenshot({ path: `${SCREENS}/xor16-inverted-rot0.png` });
  await sym(page).first().locator('[data-gate-shape]').click();
  await page.keyboard.press('Shift+r');
  const r90 = await measure();
  await page.screenshot({ path: `${SCREENS}/xor16-inverted-rot90.png` });
  const clip = (await sym(page).first().boundingBox())!;
  await page.screenshot({ path: `${SCREENS}/xor16-inverted-rot90-closeup.png`, clip: { x: clip.x - 20, y: clip.y - 20, width: Math.min(clip.width + 40, 600), height: Math.min(clip.height + 40, 700) } });
  saveKey(FILE, 'xor16-bubble-geometry', { rot0: r0.filter((x: any) => x.pinInsideBubble), rot90: r90.filter((x: any) => x.pinInsideBubble), counts: [r0.length, r90.length] });
  expect(r0.filter((x: any) => x.pinInsideBubble)).toEqual([]);
});

test('Input-toggle role in Properties: Input/Output/NOT dialog content and apply on a live circuit', async ({ page }) => {
  await page.goto('/'); await inverter(page, true);
  const b = await box(page);
  const out: Record<string, unknown> = {};
  await page.mouse.dblclick(b.x + 540, b.y + 150);                       // Output
  out.outputDialog = { open: await propsDialog(page).count(), countField: await propsDialog(page).getByLabel('입력 수', { exact: true }).count(), bubbleFieldset: await propsDialog(page).locator('fieldset').count() };
  await propsDialog(page).getByLabel('이름', { exact: true }).fill('Y');
  await propsDialog(page).getByRole('button', { name: '적용', exact: true }).click();
  out.outputLabel = await sym(page).nth(2).locator('.label').textContent();
  await page.mouse.dblclick(b.x + 320, b.y + 150);                       // NOT
  await propsDialog(page).getByLabel('입력 1 반전', { exact: true }).check();
  await propsDialog(page).getByRole('button', { name: '적용', exact: true }).click();
  out.outputValueAfterInvertNot = await page.locator('[data-output]').innerText();
  await page.keyboard.press('Control+z');
  out.outputValueAfterUndo = await page.locator('[data-output]').innerText();
  await page.keyboard.press('Control+Shift+z');
  out.outputValueAfterRedo = await page.locator('[data-output]').innerText();
  saveKey(FILE, 'live-apply', out);
  expect(out.outputValueAfterInvertNot).toBe('0');
  void simButton;
});
