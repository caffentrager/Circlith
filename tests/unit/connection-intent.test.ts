import { it,expect } from 'vitest';
import { addComponent, emptyCircuit } from '../../src/model/circuit';
import { resolveConnectionHits } from '../../src/input/connection-intent';

it('separates direct body selection from raw pin capture and active wire intent',()=>{
  const c=emptyCircuit(),id=addComponent(c,'Input',{x:100,y:100});
  const pin={type:'pin',id:c.components[id].pins[0]};
  for(const zoom of [.1,.25,.5,1,2]) {
    const near={x:140-12.9/zoom,y:100};
    expect(resolveConnectionHits(c,near,zoom,{selecting:true,surface:'body'})).toEqual([]);
    for(const intent of [
      {selecting:true,surface:'other'},
      {selecting:true,surface:'pin'},
      {selecting:false,surface:'body'},
    ] as const) expect(resolveConnectionHits(c,near,zoom,intent)[0].target).toEqual(pin);
    expect(resolveConnectionHits(c,{x:140,y:100},zoom,{selecting:true,surface:'pin'})[0].target).toEqual(pin);
    expect(resolveConnectionHits(c,{x:140+13.1/zoom,y:100},zoom,{selecting:true,surface:'other'})).toEqual([]);
  }
});
