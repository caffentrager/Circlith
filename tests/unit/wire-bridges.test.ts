import { describe, expect, it } from 'vitest';
import { addComponent, clone, connect, electricalGraph, emptyCircuit, type Circuit } from '../../src/model/circuit';
import { pinPosition } from '../../src/geometry/geometry';
import { defaultWireDisplay, validateWireDisplay, wireBridges } from '../../src/geometry/wire-bridges';
import { joinCrossing } from '../../src/model/connections';
import { compileCircuit, simulate } from '../../src/simulation/simulator';

function crossing() {
  const c = emptyCircuit();
  const a = addComponent(c, 'Input', { x: 60, y: 200 }), b = addComponent(c, 'Output', { x: 440, y: 200 });
  const d = addComponent(c, 'Input', { x: 240, y: 60 }, 90), e = addComponent(c, 'Output', { x: 240, y: 440 }, 90);
  const wire = (from: string, to: string) => {
    const start = { type: 'pin' as const, id: c.components[from].pins[0] }, end = { type: 'pin' as const, id: c.components[to].pins[0] };
    connect(c, start, end, [pinPosition(c, start.id), pinPosition(c, end.id)]);
    return Object.keys(c.geometry.wires).at(-1)!;
  };
  const horizontal = wire(a, b), vertical = wire(d, e);
  return { c, horizontal, vertical };
}

describe('derived wire bridge geometry', () => {
  it('draws the chosen axis without changing topology, paths or simulation', () => {
    const { c, horizontal, vertical } = crossing(), before = clone(c), graph = electricalGraph(c), result = simulate(compileCircuit(c));
    for (const axis of ['horizontal', 'vertical'] as const) {
      const bridges = wireBridges(c, { ...defaultWireDisplay, axis }, 1);
      expect(bridges).toHaveLength(1);
      expect(bridges[0]).toMatchObject({ wire: axis === 'horizontal' ? horizontal : vertical, axis, point: { x: 240, y: 200 }, radius: 5 });
      expect(bridges[0].arc).toBe(axis === 'horizontal' ? 'M 235 200 A 5 5 0 0 1 245 200' : 'M 240 195 A 5 5 0 0 1 240 205');
    }
    expect(c).toEqual(before); expect(electricalGraph(c)).toBe(graph); expect(simulate(compileCircuit(c))).toEqual(result);
  });
  it('is deterministic under route reversal and duplicate collinear waypoints', () => {
    const { c, horizontal, vertical } = crossing(), expected = wireBridges(c, defaultWireDisplay, 1);
    c.geometry.wires[horizontal].points.splice(1, 0, { x: 240, y: 200 });
    c.geometry.wires[horizontal].points.reverse(); c.geometry.wires[vertical].points.reverse();
    expect(wireBridges(c, defaultWireDisplay, 1)).toEqual(expected);
  });
  it('never decorates actual junctions, including after crossing connection', () => {
    const { c, horizontal, vertical } = crossing(), point = { x: 240, y: 200 };
    const joined = joinCrossing(c, [{ type: 'wire', id: horizontal, position: point }, { type: 'wire', id: vertical, position: point }]);
    expect(wireBridges(joined, defaultWireDisplay, 1)).toEqual([]);
    c.geometry.junctions.other = { x: 240, y: 201 };
    expect(wireBridges(c, defaultWireDisplay, 1)).toEqual([]);
  });
  it('does not assume equal nets mean a junction at the crossing', () => {
    const { c, horizontal, vertical } = crossing();
    c.geometry.wires[vertical].net = c.geometry.wires[horizontal].net;
    expect(wireBridges(c, defaultWireDisplay, 1)).toHaveLength(1);
  });
  it('omits end touches, parallel overlaps, self crossings and short corner clearances', () => {
    const { c, vertical, horizontal } = crossing();
    c.geometry.wires[vertical].points[0].y = 200;
    expect(wireBridges(c, defaultWireDisplay, 1)).toEqual([]);
    c.geometry.wires[vertical].points = [{ x: 150, y: 200 }, { x: 300, y: 200 }];
    expect(wireBridges(c, defaultWireDisplay, 1)).toEqual([]);
    delete c.geometry.wires[vertical];
    c.geometry.wires[horizontal].points = [{ x: 100, y: 200 }, { x: 400, y: 200 }, { x: 400, y: 100 }, { x: 240, y: 100 }, { x: 240, y: 300 }];
    expect(wireBridges(c, defaultWireDisplay, 1)).toEqual([]);
    const short = crossing(); short.c.geometry.wires[short.vertical].points[0].y = 197;
    expect(wireBridges(short.c, defaultWireDisplay, 1)).toEqual([]);
  });
  it.each([0.25, 0.5, 1, 2])('keeps a 5px radius at zoom %s when there is room', zoom => {
    expect(wireBridges(crossing().c, defaultWireDisplay, zoom)[0].radius * zoom).toBe(5);
  });
  it('shrinks adjacent jumps, deduplicates overlapping underpasses and suppresses dense crossings', () => {
    const { c, vertical } = crossing();
    const original = c.geometry.wires[vertical];
    c.geometry.wires.copy = { ...clone(original), id: 'copy' };
    expect(wireBridges(c, defaultWireDisplay, 1)).toHaveLength(1);
    c.geometry.wires.copy.points.forEach(p => { p.x += 12; });
    expect(wireBridges(c, defaultWireDisplay, 1).map(b => b.radius)).toEqual([4, 4]);
    c.geometry.wires.copy.points.forEach(p => { p.x -= 9; });
    expect(wireBridges(c, defaultWireDisplay, 1)).toEqual([]);
  });
  it('honors Off and rejects bad settings or nonfinite zoom', () => {
    const c: Circuit = crossing().c;
    expect(wireBridges(c, { ...defaultWireDisplay, enabled: false }, 1)).toEqual([]);
    expect(wireBridges(c, defaultWireDisplay, NaN)).toEqual([]);
    for (const bad of [null, {}, { ...defaultWireDisplay, enabled: 'yes' }, { ...defaultWireDisplay, axis: 'both' }, { ...defaultWireDisplay, version: 2 }])
      expect(() => validateWireDisplay(bad)).toThrow();
    expect(validateWireDisplay(defaultWireDisplay)).toEqual(defaultWireDisplay);
  });
});
