import { test } from '@playwright/test';
import { injectCircuit, saveKey, simButton } from './lib';
import { snake } from './gen';

const stats = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return { n: xs.length, median: +s[Math.floor(s.length / 2)].toFixed(1), p95: +s[Math.min(s.length - 1, Math.floor(s.length * 0.95))].toFixed(1), max: +s.at(-1)!.toFixed(1) }; };

for (const gates of [100, 500, 1000]) test(`quiet-machine render cost and CPU profile at ${gates} gates`, async ({ page }) => {
  test.setTimeout(300000);
  await page.goto('/');
  await injectCircuit(page, snake(gates));
  await simButton(page).click();
  await page.locator('main [data-input-toggle]').first().waitFor({ timeout: 120000 });
  const frame = (body: string) => page.evaluate(`(async()=>{const t0=performance.now();${body}await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));return performance.now()-t0;})()`) as Promise<number>;
  const toggle: number[] = [], zoom: number[] = [];
  for (let i = 0; i < 20; i++) toggle.push(await frame(`document.querySelector('[data-input-toggle]').dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));`));
  for (let i = 0; i < 20; i++) zoom.push(await frame(`const s=document.querySelector('main svg');const b=s.getBoundingClientRect();s.dispatchEvent(new WheelEvent('wheel',{deltaY:${i % 2 ? 40 : -40},bubbles:true,cancelable:true,clientX:b.x+400,clientY:b.y+300}));`));
  // CPU profile over 15 toggles
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Profiler.enable'); await cdp.send('Profiler.start');
  for (let i = 0; i < 15; i++) await frame(`document.querySelector('[data-input-toggle]').dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));`);
  const { profile } = await cdp.send('Profiler.stop') as any;
  const self = new Map<string, number>();
  const byId = new Map<number, any>(profile.nodes.map((n: any) => [n.id, n]));
  const dt = profile.timeDeltas as number[];
  profile.samples.forEach((id: number, i: number) => {
    const n = byId.get(id); const f = n.callFrame; const key = `${f.functionName || '(anonymous)'} ${f.url.split('/').slice(-2).join('/')}:${f.lineNumber}`;
    self.set(key, (self.get(key) ?? 0) + (dt[i] ?? 0) / 1000);
  });
  const top = [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14).map(([k, v]) => ({ fn: k, selfMs: +v.toFixed(0) }));
  saveKey('browser-profile', `${gates} gates`, { toggleToFrame: stats(toggle), zoomStepToFrame: stats(zoom), top15toggles: top });
});
