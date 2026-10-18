import { expect, type Page } from "@playwright/test";
export async function readZoom(page: Page) {
  const transform = await page.locator("main svg > g").first().getAttribute("transform");
  return Number(transform!.match(/scale\(([^)]+)\)/)![1]);
}
// Reach an exact test zoom through real wheel events, without relying on a lower clamp.
export async function wheelToZoom(page: Page, target: number) {
  await page.locator("main svg").focus();
  for (let i = 0; i < 20; i++) {
    const current = await readZoom(page);
    if (current === target) return;
    const delta = Math.max(-200, Math.min(200, -Math.log(target / current) * 100 / Math.log(1.1)));
    await page.mouse.wheel(0, delta);
    await expect.poll(() => readZoom(page)).not.toBe(current);
  }
  expect(await readZoom(page)).toBe(target);
}
