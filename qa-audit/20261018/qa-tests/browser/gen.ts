import { emptyCircuit, type Circuit, type Kind } from '../src/model/circuit';
import { pinPosition, route } from '../src/geometry/geometry';

let counter = 0;
const uid = () => `g${(counter++).toString(36)}`;
function add(c: Circuit, kind: Kind, x: number, y: number) {
  const key = uid(), count = kind === 'NOT' ? 2 : kind === 'Input' || kind === 'Output' ? 1 : 3;
  const pins = Array.from({ length: count }, (_, index) => {
    const pin = uid();
    c.pins[pin] = { id: pin, component: key, index, direction: kind === 'Input' || (kind === 'NOT' && index === 1) || (kind !== 'NOT' && kind !== 'Output' && index === 2) ? 'out' : 'in' };
    return pin;
  });
  c.components[key] = { id: key, kind, name: kind, pins }; c.geometry.components[key] = { position: { x, y }, rotation: 0 };
  return key;
}
function net(c: Circuit, pins: string[]) {
  const key = uid(); c.nets[key] = { id: key, pins: [...pins], junctions: [] };
  for (const p of pins.slice(1)) {
    const w = uid();
    c.geometry.wires[w] = { id: w, net: key, from: { type: 'pin', id: pins[0] }, to: { type: 'pin', id: p }, points: route(pinPosition(c, pins[0]), pinPosition(c, p)) };
  }
}
/** Snake of NOT/AND gates: `gates` gates, one Input at the head, one Output at the tail. */
export function snake(gates: number, columns = 40): Circuit {
  const c = emptyCircuit();
  const src = add(c, 'Input', 100, 100);
  let prev = c.components[src].pins[0];
  for (let i = 0; i < gates; i++) {
    const col = i % columns, row = Math.floor(i / columns);
    const x = 300 + (row % 2 ? columns - 1 - col : col) * 140, y = 100 + row * 120;
    const g = add(c, i % 3 === 0 ? 'AND' : 'NOT', x, y);
    // AND second input tied to the same upstream net (fanout + reconvergence)
    const comp = c.components[g];
    net(c, [prev, ...(comp.kind === 'AND' ? [comp.pins[0], comp.pins[1]] : [comp.pins[0]])]);
    prev = comp.pins.at(-1)!;
  }
  const out = add(c, 'Output', 300 + columns * 140, 100 + Math.ceil(gates / columns) * 120);
  net(c, [prev, c.components[out].pins[0]]);
  return c;
}
