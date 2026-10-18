import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { chromium } from '@playwright/test';

const argument = process.argv[2] ?? 'build/pages-site';
let server, base;
if (/^https?:\/\//.test(argument)) base = argument.endsWith('/') ? argument : `${argument}/`;
else {
  const site = resolve(argument);
  server = createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      if (!pathname.startsWith('/Circlith/')) { response.writeHead(404).end(); return; }
      const file = resolve(site, pathname.slice('/Circlith/'.length) + (pathname.endsWith('/') ? 'index.html' : ''));
      if (!file.startsWith(site + sep)) { response.writeHead(403).end(); return; }
      const content = await readFile(file);
      const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
      response.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream' }).end(content);
    } catch { response.writeHead(404).end(); }
  });
  await new Promise((accept, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', accept); });
  base = `http://127.0.0.1:${server.address().port}/Circlith/`;
}
let browser;
try {
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const editor = await context.newPage(), simulation = await context.newPage(), errors = [];
  for (const page of [editor, simulation]) {
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => {
      if (response.url().startsWith(base) && response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
    });
    page.on('requestfailed', request => errors.push(request.url()));
  }
  const manifestResponse = await context.request.get(`${base}deployment.json`);
  assert.equal(manifestResponse.status(), 200);
  const manifest = await manifestResponse.json();
  assert.equal(manifest.version, 2);
  assert.equal(manifest.editor.commit, manifest.simulation.commit);
  assert.equal(manifest.source.commit, manifest.editor.commit);
  assert.equal((await editor.goto(base)).status(), 200);
  await editor.locator('main svg').waitFor();
  assert.equal(await editor.getByRole('button', { name: '시뮬레이션', exact: true }).count(), 0);
  assert.equal(await editor.locator('.library').getByRole('button', { name: 'XNOR', exact: true }).count(), 1);
  const place = async (page, kind, x, y) => {
    await page.locator('.library').getByRole('button', { name: kind, exact: true }).click();
    const box = await page.locator('main svg').boundingBox();
    await page.mouse.click(box.x + x, box.y + y);
  };
  const wire = async (page, a, b) => {
    const pins = page.locator('main [data-layer="pins"] [data-pin]');
    await pins.nth(a).click(); await pins.nth(b).click(); await page.keyboard.press('Escape');
  };
  await place(editor, 'Input', 100, 200); await place(editor, 'Output', 550, 200); await wire(editor, 0, 1);
  await place(editor, 'Input', 330, 60); await editor.keyboard.press('Shift+r');
  await place(editor, 'Output', 330, 450); await editor.keyboard.press('Shift+r'); await wire(editor, 2, 3);
  assert.equal(await editor.locator('[data-wire-bridge]').count(), 1);
  assert.equal(await editor.locator('[data-wire-bridge]').getAttribute('data-bridge-axis'), 'horizontal');
  assert.equal(await editor.locator('main [data-wire]').first().getAttribute('data-value'), null);
  const openSettings = async page => {
    await page.getByRole('button', { name: '설정', exact: true }).click();
    return page.getByRole('dialog', { name: 'Input & Controls' });
  };
  let dialog = await openSettings(editor);
  await dialog.getByLabel('Control Preset', { exact: true }).selectOption('kicad-9');
  await dialog.getByLabel('경로 생성 방식').selectOption('vertical');
  await dialog.getByLabel('점프할 배선', { exact: true }).selectOption('vertical');
  await dialog.getByRole('button', { name: '닫기', exact: true }).click();
  assert.equal(await editor.locator('[data-wire-bridge]').getAttribute('data-bridge-axis'), 'vertical');
  assert.equal((await simulation.goto(`${base}simulation/`)).status(), 200);
  await simulation.locator('main svg').waitFor();
  assert.equal(await simulation.getByRole('button', { name: '시뮬레이션', exact: true }).count(), 1);
  assert.equal(await simulation.locator('main svg').getAttribute('data-routing-mode'), 'smart');
  assert.match(await simulation.locator('footer').innerText(), /Circlith Modern/);
  dialog = await openSettings(simulation);
  assert.equal(await dialog.getByLabel('점프할 배선', { exact: true }).inputValue(), 'horizontal');
  await dialog.getByRole('checkbox', { name: '미접속 교차 점프', exact: true }).uncheck();
  await dialog.getByLabel('경로 생성 방식').selectOption('horizontal');
  await dialog.getByRole('button', { name: '닫기', exact: true }).click();
  await editor.reload(); await editor.locator('main svg').waitFor();
  assert.equal(await editor.locator('main svg').getAttribute('data-routing-mode'), 'vertical');
  assert.match(await editor.locator('footer').innerText(), /KiCad/);
  dialog = await openSettings(editor);
  assert.equal(await dialog.getByLabel('점프할 배선', { exact: true }).inputValue(), 'vertical');
  assert.equal(await dialog.getByRole('checkbox', { name: '미접속 교차 점프', exact: true }).isChecked(), true);
  await dialog.getByRole('button', { name: '닫기', exact: true }).click();
  await simulation.reload(); await simulation.locator('main svg').waitFor();
  assert.equal(await simulation.locator('main svg').getAttribute('data-routing-mode'), 'horizontal');
  dialog = await openSettings(simulation);
  assert.equal(await dialog.getByRole('checkbox', { name: '미접속 교차 점프', exact: true }).isChecked(), false);
  await dialog.getByRole('button', { name: '닫기', exact: true }).click();
  await place(simulation, 'Input', 100, 150); await place(simulation, 'NOT', 320, 150); await place(simulation, 'Output', 540, 150);
  await wire(simulation, 0, 1); await wire(simulation, 2, 3);
  await simulation.getByRole('button', { name: '시뮬레이션', exact: true }).click();
  assert.equal(await simulation.locator('[data-output]').innerText(), '1');
  await simulation.getByRole('combobox', { name: 'Input 1 값', exact: true }).selectOption('1');
  assert.equal(await simulation.locator('[data-output]').innerText(), '0');
  // Properties belongs to the shared editor, and input bubbles affect the simulation build.
  const editorPinCount = await editor.locator('main [data-pin]').count();
  await place(editor, 'AND', 700, 250);
  await editor.locator('main [data-gate-shape="AND"]').dblclick();
  const editorProperties = editor.getByRole('dialog', { name: 'Properties · 부품 속성', exact: true });
  await editorProperties.getByLabel('이름', { exact: true }).fill('Enable');
  await editorProperties.getByLabel('입력 수', { exact: true }).fill('4');
  await editorProperties.getByLabel('입력 4 반전', { exact: true }).check();
  await editorProperties.getByRole('button', { name: '적용', exact: true }).click();
  assert.equal(await editor.locator('main [data-input-bubble]').count(), 1);
  assert.equal(await editor.locator('main [data-pin]').count(), editorPinCount + 5);
  await simulation.locator('main [data-gate-shape="NOT"]').dblclick();
  const simulationProperties = simulation.getByRole('dialog', { name: 'Properties · 부품 속성', exact: true });
  await simulationProperties.getByLabel('입력 1 반전', { exact: true }).check();
  await simulationProperties.getByRole('button', { name: '적용', exact: true }).click();
  assert.equal(await simulation.locator('[data-output]').innerText(), '1');
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ base, source: manifest.source, editorMode: 'passed', simulationMode: 'passed', commonBridges: 'passed', commonProperties: 'passed', isolatedSettings: 'passed', assetErrors: errors }));
} finally {
  await browser?.close();
  if (server) await new Promise(accept => server.close(accept));
}
