import { expect, it } from 'vitest';
import { emptyCircuit, addComponent, connect } from '../../src/model/circuit';
import { nearestWires } from '../../src/geometry/selection-hit';

it('selects the geometrically nearest parallel wire at every zoom regardless of draw order', () => {
  const c=emptyCircuit();
  for(const y of [100,110]) {
    const a=addComponent(c,'Input',{x:100,y}),b=addComponent(c,'Output',{x:700,y});
    connect(c,{type:'pin',id:c.components[a].pins[0]},{type:'pin',id:c.components[b].pins[0]},[{x:140,y},{x:660,y}]);
  }
  const [a,b]=Object.keys(c.geometry.wires);
  const before=JSON.stringify(c);
  for(const zoom of [.1,.25,.5,1,2]) {
    expect(nearestWires(c,{x:400,y:100},zoom)).toEqual([a]);
    expect(nearestWires(c,{x:400,y:110},zoom)).toEqual([b]);
    expect(new Set(nearestWires(c,{x:400,y:105},zoom))).toEqual(new Set(5*zoom<=6?[a,b]:[]));
  }
  expect(nearestWires(c,{x:400,y:97},2)).toEqual([a]);
  expect(nearestWires(c,{x:400,y:96.9},2)).toEqual([]);
  expect(JSON.stringify(c)).toBe(before);
});
