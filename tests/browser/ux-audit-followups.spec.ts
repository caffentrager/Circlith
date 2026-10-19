import { test, expect, type Page } from '@playwright/test';
import { wheelToZoom } from './zoom-helper';

test.use({ baseURL: process.env.CIRCLITH_QA_URL || 'http://127.0.0.1:5173/' });
const editorOnly = process.env.CIRCLITH_QA_MODE === 'editor';
async function point(page: Page, x: number, y: number) {
  const b = (await page.locator('main svg').boundingBox())!; await page.mouse.click(b.x + x, b.y + y);
}
async function place(page: Page, kind: string, x: number, y: number) {
  await page.locator('.library').getByRole('button', { name: kind, exact: true }).click(); await point(page, x, y);
}
async function overlapFixture(page: Page) {
  for (const [kind, x, y] of [['Input',100,200],['Input',100,400],['AND',500,200],['AND',500,400],['Output',700,200],['Output',700,400]] as const) await place(page,kind,x,y);
  const pins = page.locator('main [data-pin]');
  for (const [a,b] of [[0,2],[1,3],[0,5],[1,6],[4,8],[7,9]]) {
    await pins.nth(a).click(); await pins.nth(b).click(); await page.keyboard.press('Escape');
  }
}
test.beforeEach(async ({ page }) => { await page.setViewportSize({width:1440,height:900}); await page.goto('./'); });

test('different-net overlap warns in both modes; net highlight does not expand the deletion selection', async ({ page }) => {
  await overlapFixture(page);
  await expect(page.locator('[data-overlap-segment]')).toHaveCount(1);
  const span = await page.locator('[data-overlap-segment]').getAttribute('points');
  expect(span).toBe('450,210 450,390');
  await expect(page.locator('main svg')).toHaveAttribute('data-net-count', '4');
  const first = page.locator('main [data-wire]').first(), id = (await first.getAttribute('data-wire'))!;
  const net = (await first.getAttribute('data-net-id'))!;
  const sameNet = await page.locator(`main [data-net-id="${net}"]`).count();
  await page.getByRole('tab',{name:'도면 트리',exact:true}).click();
  await page.locator(`[data-outline-object="${id}"]`).click();
  await expect(page.locator('main .wire.selected')).toHaveCount(1);
  await expect(page.locator('main [data-net-highlight]')).toHaveCount(sameNet);
  await expect(page.getByRole('region',{name:'선택 속성',exact:true})).toContainText('N1');
  await expect(page.getByRole('region',{name:'선택 속성',exact:true})).not.toContainText(net);
  await page.keyboard.press('Delete');
  await expect(page.locator('main [data-wire]')).toHaveCount(5);
  await page.keyboard.press('Control+z');
  await expect(page.locator('main [data-wire]')).toHaveCount(6);
  await expect(page.locator('[data-overlap-segment]')).toHaveCount(1);
  await page.getByRole('button',{name:'⚠ 배선 겹침 1곳 · 확인',exact:true}).click();
  await expect(page.locator('main .wire.selected')).toHaveCount(2);
  await expect(page.locator('header')).toHaveAttribute('data-edit-count', '12');
  if (!editorOnly) {
    await page.getByRole('button',{name:'시뮬레이션',exact:true}).click();
    await page.getByRole('combobox',{name:'Input 1 값',exact:true}).selectOption('X');
    await page.getByRole('combobox',{name:'Input 2 값',exact:true}).selectOption('1');
    await expect(page.locator('[data-diagnostic-code]')).toHaveCount(0);
    await expect(page.locator('[data-overlap-segment]')).toHaveCount(1);
  }
  await page.screenshot({path:`build/audit-overlap-${editorOnly?'editor':'simulation'}.png`});
});

test('output results remain visible beside a 16-input Inspector and port values have a screen-size floor', async ({ page }) => {
  test.skip(editorOnly, 'Calculation results are simulation-only.');
  await place(page,'Input',100,180); await place(page,'AND',350,220); await place(page,'Output',650,180);
  await page.locator('main [data-gate-shape="AND"]').dblclick();
  await page.getByRole('dialog',{name:'Properties · 부품 속성',exact:true}).getByLabel('입력 수',{exact:true}).fill('16');
  await page.getByRole('button',{name:'적용',exact:true}).click();
  await page.getByRole('button',{name:'시뮬레이션',exact:true}).click();
  const output=page.locator('[data-output]');
  await expect(output).toBeVisible();
  const bounds=(await output.boundingBox())!;
  expect(bounds.y).toBeGreaterThan(0); expect(bounds.y+bounds.height).toBeLessThan(872);
  await expect(page.locator('main .label.port-label').first()).toHaveText('Input 1');
  for (const zoom of [.5,1,2]) {
    const canvas=(await page.locator('main svg').boundingBox())!;
    await page.mouse.move(canvas.x+100,canvas.y+180);
    await wheelToZoom(page,zoom);
    const size=await page.locator('main .port-value').first().evaluate(el=>{
      const m=(el as SVGGraphicsElement).getScreenCTM()!; return parseFloat(getComputedStyle(el).fontSize)*Math.hypot(m.a,m.b);
    });
    expect(size).toBeGreaterThanOrEqual(9);
  }
  await page.screenshot({path:'build/audit-fixed-results.png'});
});

test('unsaved edits guard page departure and Undo to the initial document removes the guard', async ({ page }) => {
  const warned=()=>page.evaluate(()=>!window.dispatchEvent(new Event('beforeunload',{cancelable:true})));
  expect(await warned()).toBe(false);
  await place(page,'AND',200,180);
  expect(await warned()).toBe(true);
  await expect(page.locator('header')).toContainText('저장 안 됨');
  await page.keyboard.press('Control+z');
  expect(await warned()).toBe(false);
  await page.getByRole('textbox',{name:'프로젝트 이름',exact:true}).fill('My experiment');
  expect(await warned()).toBe(true);
});

test('display names are shared and deleting a previous Input does not renumber the survivor', async ({ page }) => {
  await place(page,'Input',100,180); await place(page,'Input',400,180);
  await expect(page.locator('main .label.port-label')).toHaveText(['Input 1','Input 2']);
  await expect(page.getByRole('region',{name:'선택 속성',exact:true}).getByRole('heading',{name:'Input 2',exact:true})).toBeVisible();
  await page.getByRole('tab',{name:'도면 트리',exact:true}).click();
  await page.getByRole('button',{name:'Input 1',exact:true}).click();
  await page.keyboard.press('Delete');
  await expect(page.locator('main .label.port-label')).toHaveText('Input 2');
  await page.keyboard.press('Control+z');
  await expect(page.locator('main .label.port-label')).toHaveText(['Input 1','Input 2']);
});

test('small-screen Inspector leaves view controls and fixed results accessible', async ({ page }) => {
  await page.setViewportSize({width:1024,height:420}); await page.reload();
  await place(page,'Input',150,150); await place(page,'Output',450,150);
  if (!editorOnly) await page.getByRole('button',{name:'시뮬레이션',exact:true}).click();
  await page.getByRole('button',{name:'Inspector',exact:true}).click();
  const zoom=page.getByRole('button',{name:'확대',exact:true});
  const bounds=(await zoom.boundingBox())!;
  expect(await zoom.evaluate((el,b)=>el.contains(document.elementFromPoint(b.x+b.width/2,b.y+b.height/2)),bounds)).toBe(true);
  await zoom.click();
  await expect(page.getByLabel('확대율',{exact:true})).toHaveText('110%');
  if (!editorOnly) {
    const output=(await page.locator('[data-output]').boundingBox())!;
    expect(output.y+output.height).toBeLessThan(392);
    expect(await page.locator('[data-output]').evaluate(el=>{
      const r=el.getBoundingClientRect(); return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));
    })).toBe(true);
  }
  await page.screenshot({path:`build/audit-small-${editorOnly?'editor':'simulation'}.png`});
});

test('routine feedback clears while failure feedback remains available', async ({ page }) => {
  await place(page,'AND',200,180);
  await page.keyboard.press('Delete');
  await expect(page.getByRole('status')).toContainText('삭제했습니다');
  await expect(page.getByRole('status')).not.toContainText('삭제했습니다',{timeout:7000});
  await place(page,'OR',250,180); await page.keyboard.press('Delete');
  await expect(page.getByRole('status')).toContainText('삭제했습니다');
  await page.evaluate(()=>{ Storage.prototype.setItem=()=>{throw new Error('disabled');}; });
  await page.getByRole('button',{name:'설정',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Input & Controls',exact:true});
  await dialog.getByLabel('경로 생성 방식').selectOption('vertical');
  await dialog.getByRole('button',{name:'닫기',exact:true}).click();
  await expect(page.getByRole('status')).toContainText('브라우저 저장에 실패');
  await page.waitForTimeout(5200);
  await expect(page.getByRole('status')).toContainText('브라우저 저장에 실패');
});
