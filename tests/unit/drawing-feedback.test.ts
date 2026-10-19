import { expect, it } from 'vitest';
import { addComponent, clone, emptyCircuit, type Point } from '../../src/model/circuit';
import { wireOverlaps } from '../../src/geometry/wire-overlaps';
import { CircuitLabelRegistry } from '../../src/ui/circuit-labels';

function fixture(items: { net: string; points: Point[] }[]) {
  const c = emptyCircuit();
  items.forEach((item, i) => {
    const id = `w${i}`;
    c.geometry.wires[id] = { id, ...item, from: { type: 'junction', id: `${id}a` }, to: { type: 'junction', id: `${id}b` } };
  });
  return c;
}
it('reports the exact shared span of different nets without changing the circuit', () => {
  const c = fixture([
    { net: 'n1', points: [{ x: 450, y: 200 }, { x: 450, y: 390 }] },
    { net: 'n2', points: [{ x: 450, y: 400 }, { x: 450, y: 210 }] },
  ]), before = clone(c);
  expect(wireOverlaps(c)).toEqual([{ wires: ['w0', 'w1'], nets: ['n1', 'n2'], from: { x: 450, y: 210 }, to: { x: 450, y: 390 } }]);
  expect(c).toEqual(before);
});
it('excludes a shared net, isolated segments, point touches and perpendicular crossings', () => {
  for (const [net, points] of [
    ['n1', [{ x: 10, y: 0 }, { x: 90, y: 0 }]],
    ['n2', [{ x: 100, y: 0 }, { x: 150, y: 0 }]],
    ['n2', [{ x: 110, y: 0 }, { x: 150, y: 0 }]],
    ['n2', [{ x: 50, y: -20 }, { x: 50, y: 20 }]],
    ['n2', [{ x: 10, y: 10 }, { x: 90, y: 10 }]],
  ] as const) {
    const c = fixture([{ net: 'n1', points: [{ x: 0, y: 0 }, { x: 100, y: 0 }] }, { net, points: points.map(p => ({ ...p })) }]);
    expect(wireOverlaps(c)).toEqual([]);
  }
});
it('finds horizontal containment, negative coordinates and overlaps with several nets', () => {
  const c = fixture([
    { net: 'a', points: [{ x: 100, y: -10 }, { x: -100, y: -10 }] },
    { net: 'b', points: [{ x: -20, y: -10 }, { x: 20, y: -10 }] },
    { net: 'c', points: [{ x: 0, y: -10 }, { x: 80, y: -10 }] },
  ]);
  const spans = wireOverlaps(c);
  expect(spans).toHaveLength(3);
  expect(spans.map(s => s.to.x - s.from.x).sort((a,b) => a-b)).toEqual([20, 40, 80]);
});
it('shares display names and preserves identity numbers across deletion, Undo and renaming', () => {
  const c = emptyCircuit(), registry = new CircuitLabelRegistry();
  const a = addComponent(c, 'Input', { x: 0, y: 0 }), b = addComponent(c, 'Input', { x: 100, y: 0 });
  const gate = addComponent(c, 'AND', { x: 200, y: 0 });
  const original = registry.labels(c);
  expect(original.components.get(a)).toBe('Input 1');
  expect(original.components.get(b)).toBe('Input 2');
  expect(c.components[gate].pins.map(id => original.pins.get(id))).toEqual(['I0', 'I1', 'O']);
  const deleted = clone(c); delete deleted.components[a];
  expect(registry.labels(deleted).components.get(b)).toBe('Input 2');
  expect(registry.labels(c).components.get(a)).toBe('Input 1');
  c.components[b].name = 'ENABLE';
  expect(registry.labels(c).components.get(b)).toBe('ENABLE');
  const next = addComponent(c, 'Input', { x: 300, y: 0 });
  expect(registry.labels(c).components.get(next)).toBe('Input 3');
  c.nets['private-uuid'] = { id: 'private-uuid', pins: [], junctions: [] };
  expect(registry.labels(c).nets.get('private-uuid')).toBe('N1');
});
