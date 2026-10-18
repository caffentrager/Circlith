import { test, expect } from '@playwright/test';

test('simulation settings ignore editor keys and never overwrite them', async ({ page }) => {
  await page.goto('/');
  const editorInput = 'editor-profile-sentinel';
  const editorRouting = JSON.stringify({ version: 1, pathMode: 'vertical', overlapMode: 'warn' });
  await page.evaluate(({ input, routing }) => {
    localStorage.setItem('circlith.input-profile.v1', input);
    localStorage.setItem('circlith.routing.v1', routing);
  }, { input: editorInput, routing: editorRouting });
  await page.reload();
  await expect(page.locator('main svg')).toHaveAttribute('data-routing-mode', 'smart');
  await expect(page.getByRole('status')).not.toContainText('프로필 복구 실패');
  await page.getByRole('button', { name: '설정', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Input & Controls', exact: true });
  await dialog.getByLabel('Control Preset', { exact: true }).selectOption('kicad-9');
  await dialog.getByLabel('경로 생성 방식').selectOption('horizontal');
  await dialog.getByRole('button', { name: '닫기', exact: true }).click();
  const saved = await page.evaluate(() => ({
    editorInput: localStorage.getItem('circlith.input-profile.v1'),
    editorRouting: localStorage.getItem('circlith.routing.v1'),
    simulationInput: JSON.parse(localStorage.getItem('circlith.simulation.input-profile.v1')!),
    simulationRouting: JSON.parse(localStorage.getItem('circlith.simulation.routing.v1')!),
  }));
  expect(saved.editorInput).toBe(editorInput);
  expect(saved.editorRouting).toBe(editorRouting);
  expect(saved.simulationInput.presetId).toBe('kicad-9');
  expect(saved.simulationRouting.pathMode).toBe('horizontal');
  await page.reload();
  await expect(page.locator('main svg')).toHaveAttribute('data-routing-mode', 'horizontal');
  await expect(page.getByRole('status')).toContainText('KiCad');
});
