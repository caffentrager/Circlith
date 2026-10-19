import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { chromium, expect } from '@playwright/test';

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
  const errors = [], page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => {
    if (response.url().startsWith(base) && response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
  });
  page.on('requestfailed', request => errors.push(request.url()));
  const manifestResponse = await context.request.get(base + 'deployment.json');
  assert.equal(manifestResponse.status(), 200);
  const manifest = await manifestResponse.json();
  assert.equal(manifest.version, 3);
  assert.equal(manifest.application.path, '/Circlith/');
  assert.equal(manifest.application.mode, 'simulation');
  assert.equal(manifest.source.commit, manifest.application.commit);
  if (process.env.CIRCLITH_EXPECT_COMMIT) assert.equal(manifest.source.commit, process.env.CIRCLITH_EXPECT_COMMIT);
  const infoResponse = await context.request.get(base + 'build-info.json');
  assert.equal(infoResponse.status(), 200);
  const info = await infoResponse.json();
  assert.equal(info.commit, manifest.source.commit); assert.equal(info.mode, 'simulation');
  for (const path of ['simulation/', 'editor/']) assert.equal((await context.request.get(base + path)).status(), 404, `Retired path still served: ${path}`);
  assert.equal((await page.goto(base)).status(), 200);
  await page.locator('main > svg').waitFor();
  for (const kind of ['XNOR', 'Clock', 'DFF'])
    await expect(page.locator('.library').getByRole('button', { name: kind, exact: true })).toHaveCount(1);
  await expect(page.getByRole('button', { name: '시뮬레이션', exact: true })).toHaveCount(1);

  await page.getByRole('button', { name: '설정', exact: true }).click();
  let settings = page.getByRole('dialog', { name: 'Input & Controls', exact: true });
  await settings.getByLabel('Control Preset', { exact: true }).selectOption('kicad-9');
  await settings.getByLabel('경로 생성 방식').selectOption('vertical');
  await settings.getByRole('button', { name: '닫기', exact: true }).click();
  await page.reload();
  await expect(page.locator('footer')).toHaveAttribute('data-input-profile', /KiCad/);
  await expect(page.locator('main > svg')).toHaveAttribute('data-routing-mode', 'vertical');
  await page.getByRole('button', { name: '설정', exact: true }).click();
  settings = page.getByRole('dialog', { name: 'Input & Controls', exact: true });
  await settings.getByLabel('Control Preset', { exact: true }).selectOption('circlith-modern');
  await settings.getByLabel('경로 생성 방식').selectOption('smart');
  await settings.getByRole('button', { name: '닫기', exact: true }).click();

  const place = async (kind, x, y) => {
    await page.locator('.library').getByRole('button', { name: kind, exact: true }).click();
    const box = await page.locator('main > svg').boundingBox();
    await page.mouse.click(box.x + x, box.y + y);
  };
  const wire = async (a, b) => {
    const pins = page.locator('main [data-pin]');
    await pins.nth(a).click(); await pins.nth(b).click(); await page.keyboard.press('Escape');
  };
  await place('Input', 140, 100); await place('Clock', 140, 260);
  await place('DFF', 420, 180); await place('Output', 680, 180);
  await wire(0, 2); await wire(1, 3); await wire(4, 5);
  await expect(page.locator('main [data-wire]')).toHaveCount(3);
  await page.getByRole('button', { name: '시뮬레이션', exact: true }).click();
  const time = page.getByLabel('시뮬레이션 시각', { exact: true }), output = page.locator('main [data-component]').last();
  await expect(time).toHaveAttribute('data-time', '0'); await expect(output).toHaveAttribute('data-value', 'X');
  await page.getByRole('tab', { name: /^입출력 · 진단/ }).click();
  await page.getByLabel('Input 1 값', { exact: true }).selectOption('1');
  await page.getByRole('button', { name: '다음 이벤트', exact: true }).click();
  await expect(time).toHaveAttribute('data-time', '5'); await expect(output).toHaveAttribute('data-value', '1');
  await page.getByLabel('Input 1 값', { exact: true }).selectOption('0');
  await expect(output).toHaveAttribute('data-value', '1');
  await page.getByLabel('Step 진행 기준').selectOption('rising');
  await page.getByRole('button', { name: '다음 상승엣지', exact: true }).click();
  await expect(time).toHaveAttribute('data-time', '15'); await expect(output).toHaveAttribute('data-value', '0');
  await page.getByRole('tab', { name: '파형', exact: true }).click();
  await page.getByLabel('파형 커서', { exact: true }).fill('1');
  await expect(page.getByLabel('파형 관측 시각')).toContainText('과거 관측 t=5');
  await expect(time).toHaveAttribute('data-time', '15'); await expect(output).toHaveAttribute('data-value', '0');
  await page.getByRole('button', { name: '초기화', exact: true }).click();
  await expect(time).toHaveAttribute('data-time', '0'); await expect(output).toHaveAttribute('data-value', 'X');
  await page.getByRole('button', { name: '실행', exact: true }).click();
  await expect.poll(async () => Number(await time.getAttribute('data-time'))).toBeGreaterThan(0);
  await expect(page.locator('header').getByRole('button', { name: 'Undo', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: '일시정지', exact: true }).click();
  if (process.env.CIRCLITH_SCREENSHOT) await page.screenshot({ path: process.env.CIRCLITH_SCREENSHOT, fullPage: true });
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ base, source: manifest.source, singleApplication: 'passed', retiredPaths: '404',
    settingsPersistence: 'passed', clockDff: 'passed', runPauseStepReset: 'passed', waveform: 'passed', assetErrors: errors }));
} finally {
  await browser?.close();
  if (server) await new Promise(accept => server.close(accept));
}
