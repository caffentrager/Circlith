import {test,expect,type Page} from '@playwright/test';
async function click(page:Page,x:number,y:number) {
  const b=(await page.locator('main svg').boundingBox())!;
  await page.mouse.click(b.x+x,b.y+y);
}
test('equidistant selection asks explicitly, cancels safely, and only deletes the chosen wire',async({page})=>{
  await page.goto('/');
  for(const [kind,x,y] of [['Input',100,100],['Input',100,110],['Output',700,100],['Output',700,110]] as const){
    await page.locator('.library').getByRole('button',{name:kind,exact:true}).click();
    await click(page,x,y);
  }
  const pins=page.locator('main [data-pin]');
  for(const [a,b] of [[0,2],[1,3]]) {
    await pins.nth(a).click();await pins.nth(b).click();await page.keyboard.press('Escape');
  }
  await click(page,400,400);
  const wires=page.locator('main [data-wire]');
  const ids=await wires.evaluateAll(els=>els.map(e=>e.getAttribute('data-wire')));
  await click(page,400,105);
  const dialog=page.getByRole('dialog',{name:'배선 선택',exact:true});
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Delete');await expect(wires).toHaveCount(2);
  await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);
  await expect(page.locator('main .wire.selected')).toHaveCount(0);
  await click(page,400,105);
  await dialog.getByRole('button').first().click();
  const selected=await page.locator('main .wire.selected').getAttribute('data-wire');
  await page.keyboard.press('Delete');
  await expect(wires).toHaveCount(1);
  expect(await wires.getAttribute('data-wire')).toBe(ids.find(id=>id!==selected));
  await page.keyboard.press('Control+z');await expect(wires).toHaveCount(2);
});
test('palette drop restores focus without scrolling at 420px viewport height',async({page})=>{
  await page.setViewportSize({width:1280,height:420});await page.goto('/');
  const source=(await page.locator('.library').getByRole('button',{name:'AND',exact:true}).boundingBox())!;
  const canvas=(await page.locator('main svg').boundingBox())!;
  await page.mouse.move(source.x+source.width/2,source.y+source.height/2);await page.mouse.down();
  await page.mouse.move(canvas.x+200,canvas.y+180,{steps:8});await page.mouse.up();
  await expect(page.locator('main [data-component]')).toHaveAttribute('transform','translate(200 180) rotate(0)');
  await expect(page.locator('main svg')).toBeFocused();
  expect(await page.evaluate(()=>window.scrollY)).toBe(0);
  await page.keyboard.press('Delete');await expect(page.locator('main [data-component]')).toHaveCount(0);
});
