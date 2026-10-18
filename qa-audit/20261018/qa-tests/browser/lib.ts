import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { expect, type Page } from '@playwright/test';

export const EVIDENCE = 'D:/Circlith/build/qa-audit-20261018/evidence';
export const SCREENS = 'D:/Circlith/build/qa-audit-20261018/screens';
mkdirSync(SCREENS, { recursive: true });
export function save(name: string, data: unknown) {
  const path = `${EVIDENCE}/${name}.json`;
  writeFileSync(path, JSON.stringify(data, null, 2));
}
/** Merge a key into a shared JSON file (tests run in one worker, sequentially). */
export function saveKey(file: string, key: string, value: unknown) {
  const path = `${EVIDENCE}/${file}.json`;
  const current = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : {};
  current[key] = value;
  writeFileSync(path, JSON.stringify(current, null, 2));
}

export async function box(page: Page) { return (await page.locator('main svg').boundingBox())!; }
export async function place(page: Page, kind: string, x: number, y: number) {
  await page.locator('.library').getByRole('button', { name: kind, exact: true }).click();
  const b = await box(page);
  await page.mouse.click(b.x + x, b.y + y);
}
export async function connectPins(page: Page, a: number, b: number) {
  const pins = page.locator('main [data-layer="pins"] [data-pin]');
  await pins.nth(a).click(); await pins.nth(b).click(); await page.keyboard.press('Escape');
}
export const simButton = (page: Page) => page.getByRole('button', { name: '시뮬레이션', exact: true });
export const propsDialog = (page: Page) => page.getByRole('dialog', { name: 'Properties · 부품 속성', exact: true });

/** Input -> NOT -> Output (+ optional second Input far away for panning tests). */
export async function inverter(page: Page, simulation = true) {
  await place(page, 'Input', 100, 150);
  await place(page, 'NOT', 320, 150);
  await place(page, 'Output', 540, 150);
  await connectPins(page, 0, 1); await connectPins(page, 2, 3);
  if (simulation) await simButton(page).click();
}
export type Snap = {
  viewport: string | null; selected: number; transforms: (string | null)[]; menu: boolean; props: boolean;
  values: (string | null)[]; history: string | null; active: string; operation: string | null; components: number; wires: number;
};
export async function snap(page: Page): Promise<Snap> {
  return page.evaluate(() => {
    const g = document.querySelector('main svg > g');
    const active = document.activeElement;
    return {
      viewport: g?.getAttribute('transform') ?? null,
      selected: document.querySelectorAll('main .symbol.selected').length,
      transforms: [...document.querySelectorAll('main [data-layer="symbols"] [data-component]')].map(e => e.getAttribute('transform')),
      menu: !!document.querySelector('[role=dialog][aria-label="도면 메뉴"]'),
      props: !!document.querySelector('[role=dialog][aria-labelledby="component-properties-title"]'),
      values: [...document.querySelectorAll('main [data-layer="symbols"] [data-component]')].map(e => e.getAttribute('data-value')),
      history: document.querySelector('header span')?.textContent ?? null,
      active: active ? `${active.tagName}${active.getAttribute('data-input-toggle') ? '#input-toggle' : ''}${active.id ? '#' + active.id : ''}` : 'none',
      operation: document.querySelector('main svg')?.getAttribute('data-operation') ?? null,
      components: document.querySelectorAll('main [data-layer="symbols"] [data-component]').length,
      wires: document.querySelectorAll('main [data-layer="wires"] [data-wire]').length,
    };
  });
}
export function diffSnap(a: Snap, b: Snap) {
  return {
    panned: a.viewport !== b.viewport,
    moved: JSON.stringify(a.transforms) !== JSON.stringify(b.transforms),
    selectionChanged: a.selected !== b.selected,
    valueChanged: JSON.stringify(a.values) !== JSON.stringify(b.values),
    menuOpened: !a.menu && b.menu,
    propertiesOpened: !a.props && b.props,
    historyChanged: a.history !== b.history,
    componentCountChanged: a.components !== b.components,
  };
}

/** Locate the React-held Editor instance for QA-only fixture injection (no production code is modified). */
export async function injectCircuit(page: Page, circuit: unknown) {
  await page.evaluate(c => {
    const root = document.getElementById('root') as any;
    const key = Object.keys(root).find(k => k.startsWith('__reactContainer$'))!;
    const seen = new Set<any>();
    const find = (fiber: any): any => {
      if (!fiber || seen.has(fiber)) return null;
      seen.add(fiber);
      for (let hook = fiber.memoizedState; hook && typeof hook === 'object' && 'next' in hook; hook = hook.next) {
        const v = hook.memoizedState;
        if (v && typeof v === 'object' && 'circuit' in v && 'history' in v && typeof v.updateProperties === 'function') return v;
      }
      return find(fiber.child) ?? find(fiber.sibling);
    };
    const editor = find(root[key]);
    if (!editor) throw new Error('editor instance not found');
    (window as any).__qaEditor = editor;
    editor.circuit = c;
  }, circuit);
}
export { expect };
