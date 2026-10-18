import {test,expect,type Page} from '@playwright/test';
async function point(page:Page,x:number,y:number) {
  const b=(await page.locator('main svg').boundingBox())!;
  await page.mouse.click(b.x+x,b.y+y);
}
async function place(page:Page,kind:string,x:number,y:number) {
  await page.locator('.library').getByRole('button',{name:kind,exact:true}).click();await point(page,x,y);
}
const tab=(page:Page,name:string)=>page.getByRole('tab',{name,exact:true});
test.beforeEach(async({page})=>{await page.goto('/');});

test('library folders filter, reopen for search, preserve fold state, and still drag to the canvas',async({page})=>{
  const library=page.getByRole('region',{name:'부품 라이브러리',exact:true});
  const gates=library.locator('details').filter({has:page.locator('summary').filter({hasText:'논리 게이트'})});
  await gates.locator('summary').click();await expect(library.getByRole('button',{name:'AND',exact:true})).toBeHidden();
  await page.getByRole('searchbox',{name:'라이브러리 검색',exact:true}).fill('OR');
  await expect(library.getByRole('button',{name:'OR',exact:true})).toBeVisible();
  await expect(library.getByRole('button',{name:'AND',exact:true})).toHaveCount(0);
  await page.getByRole('searchbox',{name:'라이브러리 검색',exact:true}).fill('');
  await expect(library.getByRole('button',{name:'OR',exact:true})).toBeHidden();
  await gates.locator('summary').click();
  const b=(await library.getByRole('button',{name:'OR',exact:true}).boundingBox())!;
  const c=(await page.locator('main svg').boundingBox())!;
  await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();
  await page.mouse.move(c.x+300,c.y+200,{steps:8});await page.mouse.up();
  await expect(page.locator('main [data-component]')).toHaveAttribute('transform','translate(300 200) rotate(0)');
  await expect(page.locator('main svg')).toBeFocused();
});

test('search keeps matching folders open and restores keyboard-controlled fold state',async({page})=>{
  const library=page.getByRole('region',{name:'부품 라이브러리',exact:true});
  const folder=library.locator('details').filter({has:page.locator('summary').filter({hasText:'논리 게이트'})});
  const summary=folder.locator('summary');
  const search=page.getByRole('searchbox',{name:'라이브러리 검색',exact:true});
  await summary.focus();await page.keyboard.press('Enter');
  await expect(folder).not.toHaveAttribute('open');
  await search.fill('OR');
  await expect(folder).toHaveAttribute('open');
  await summary.click();
  await expect(library.getByRole('button',{name:'OR',exact:true})).toBeVisible();
  await search.fill('');
  await expect(folder).not.toHaveAttribute('open');
  await summary.focus();await page.keyboard.press('Space');
  await expect(folder).toHaveAttribute('open');
});

test('scene rows and canvas share selection, Shift-selection, Delete and Undo without adding history',async({page})=>{
  await place(page,'AND',200,200);await place(page,'OR',500,200);
  await tab(page,'도면 트리').click();
  const rows=page.locator('[data-outline-object]');await expect(rows).toHaveCount(2);
  await rows.nth(0).click();await expect(page.locator('main .symbol.selected')).toHaveCount(1);
  await rows.nth(1).click({modifiers:['Shift']});await expect(page.locator('main .symbol.selected')).toHaveCount(2);
  await expect(rows.nth(0)).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('header')).toContainText('2 committed edits');
  await page.keyboard.press('Delete');await expect(rows).toHaveCount(0);
  await page.keyboard.press('Control+z');await expect(rows).toHaveCount(2);
  await point(page,500,200);await expect(rows.nth(1)).toHaveAttribute('aria-pressed','true');
  await expect(rows.nth(0)).toHaveAttribute('aria-pressed','false');
  const before=await page.locator('main svg > g').first().getAttribute('transform');
  await rows.nth(0).dblclick();
  expect(await page.locator('main svg > g').first().getAttribute('transform')).not.toBe(before);
  await expect(page.locator('header')).toContainText('2 committed edits');
});

test('connected wires appear under nets, filter by endpoint, and track deletion and Undo',async({page})=>{
  await place(page,'Input',100,100);await place(page,'Output',600,300);
  const pins=page.locator('main [data-pin]');await pins.nth(0).click();await pins.nth(1).click();await page.keyboard.press('Escape');
  await tab(page,'도면 트리').click();
  const rows=page.locator('[data-outline-object]');await expect(rows).toHaveCount(3);
  const search=page.getByRole('searchbox',{name:'도면 트리 검색',exact:true});
  await search.fill('배선');await expect(rows).toHaveCount(1);
  await rows.click();await expect(page.locator('main .wire.selected')).toHaveCount(1);
  await page.keyboard.press('Delete');await expect(rows).toHaveCount(0);
  await expect(page.getByText('검색 결과가 없습니다.',{exact:true})).toBeVisible();
  await page.keyboard.press('Control+z');await expect(rows).toHaveCount(1);
  await search.fill('Input');await expect(rows).toHaveCount(2);
  await search.fill('');await expect(rows).toHaveCount(3);
});

test('tabs support arrow navigation, queries survive tab changes, and draft objects cannot be selected',async({page})=>{
  await place(page,'NOT',300,200);
  await tab(page,'도면 트리').click();
  await page.getByRole('searchbox',{name:'도면 트리 검색',exact:true}).fill('missing');
  await tab(page,'도면 트리').focus();await page.keyboard.press('ArrowLeft');
  await expect(tab(page,'라이브러리')).toHaveAttribute('aria-selected','true');
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('searchbox',{name:'도면 트리 검색',exact:true})).toHaveValue('missing');
  await page.getByRole('searchbox',{name:'도면 트리 검색',exact:true}).fill('');
  await tab(page,'라이브러리').click();
  await page.locator('.library').getByRole('button',{name:'AND',exact:true}).click();
  await tab(page,'도면 트리').click();
  await expect(page.locator('[data-outline-object]')).toHaveCount(1);
  await expect(page.locator('[data-outline-object]')).toBeDisabled();
  await page.locator('main svg').focus();await page.keyboard.press('Escape');
  await expect(page.locator('[data-outline-object]')).toBeEnabled();
  await expect(page.locator('header')).toContainText('1 committed edits');
});
