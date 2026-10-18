import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Symbols } from '../../src/renderer/CircuitSvg';
import { SimulationPanel } from '../../src/ui/SimulationPanel';
import { Editor } from '../../src/editor/editor';
import { addComponent, clone, connect, emptyCircuit, type Circuit, type Point } from '../../src/model/circuit';
import { updateComponentProperties } from '../../src/model/component-properties';
import { connectTargets, validateCircuit } from '../../src/model/connections';
import { pinPosition, rotatePoint, route } from '../../src/geometry/geometry';
import { anchorOffsets } from '../../src/geometry/path';
import { defaultRouting, planRoute } from '../../src/geometry/routing';
import { compileCircuit, simulate } from '../../src/simulation/simulator';
import type { LogicValue } from '../../src/simulation/logic';

const link = (c: Circuit, a: string, b: string, anchors: Point[] = []) => {
  const from = { type: 'pin' as const, id: a }, to = { type: 'pin' as const, id: b };
  const plan = planRoute(c, pinPosition(c, a), pinPosition(c, b), defaultRouting, { from, to, anchors });
  expect(plan.blocked).toBe(false);
  return connectTargets(c, from, to, plan.points, anchors)!;
};
function inverter() {
  let c = emptyCircuit();
  const input = addComponent(c, 'Input', { x: 100, y: 100 });
  const gate = addComponent(c, 'NOT', { x: 300, y: 100 });
  const output = addComponent(c, 'Output', { x: 500, y: 100 });
  c = link(c, c.components[input].pins[0], c.components[gate].pins[0]);
  c = link(c, c.components[gate].pins[1], c.components[output].pins[0]);
  return { c, input, gate, output };
}
function expectNoRetrace(points: Point[]) {
  for (let i = 2; i < points.length; i++) {
    const [a, b, c] = points.slice(i - 2, i + 1);
    if (a.x === b.x && b.x === c.x) expect((b.y - a.y) * (c.y - b.y)).toBeGreaterThanOrEqual(0);
    if (a.y === b.y && b.y === c.y) expect((b.x - a.x) * (c.x - b.x)).toBeGreaterThanOrEqual(0);
  }
}
describe('N3: pinned routes stay orthogonal, ordered and free of retraced spans after shrinking', () => {
  const cases = [
    { from: 16, to: 2, pin: 0, anchors: [{ x: 220, y: 160 }, { x: 220, y: 300 }] },
    { from: 8, to: 3, pin: 0, anchors: [{ x: 340, y: 300 }] },
    { from: 8, to: 3, pin: 1, anchors: [{ x: 340, y: 300 }] },
    { from: 16, to: 2, pin: 0, anchors: [{ x: 340, y: 300 }] },
    { from: 16, to: 2, pin: 1, anchors: [{ x: 340, y: 300 }] },
  ];
  for (const rotation of [0, 90, 180, 270]) it.each(cases)(`${rotation}°: $from→$to input $pin`, ({ from, to, pin, anchors }) => {
    const turn = (p: Point) => {
      const rotated = rotatePoint({ x: p.x - 400, y: p.y - 300 }, rotation);
      return { x: 400 + rotated.x, y: 300 + rotated.y };
    };
    let c = emptyCircuit();
    const gate = addComponent(c, 'AND', { x: 400, y: 300 }, rotation);
    const input = addComponent(c, 'Input', turn({ x: 100, y: 160 }), rotation);
    c = updateComponentProperties(c, gate, { name: 'AND', inputCount: from, invertedInputs: [] });
    const targetPin = c.components[gate].pins[pin];
    c = link(c, c.components[input].pins[0], targetPin, anchors.map(turn));
    const before = clone(c), e = new Editor(); e.circuit = c;
    e.updateProperties(gate, { name: 'Enable', inputCount: to, invertedInputs: [] });
    const after = clone(e.circuit);
    expect(validateCircuit(after)).toEqual([]);
    expect(after.nets).toEqual(before.nets);
    expect(after.components[gate].pins[pin]).toBe(targetPin);
    expect(Object.keys(after.geometry.wires)).toEqual(Object.keys(before.geometry.wires));
    for (const wire of Object.values(after.geometry.wires)) {
      expect(wire.anchors).toEqual(before.geometry.wires[wire.id].anchors);
      expect(anchorOffsets(wire.points, wire.anchors ?? [])).not.toBeNull();
      expectNoRetrace(wire.points);
    }
    expect(e.history).toHaveLength(1);
    e.undo(); expect(e.circuit).toEqual(before);
    e.redo(); expect(e.circuit).toEqual(after);
  });
  it('rejects a resize that would bury a fixed waypoint, preserving circuit, history and Redo', () => {
    let c = emptyCircuit();
    const gate = addComponent(c, 'AND', { x: 400, y: 300 });
    const input = addComponent(c, 'Input', { x: 100, y: 160 });
    c = link(c, c.components[input].pins[0], c.components[gate].pins[0], [{ x: 400, y: 250 }]);
    const e = new Editor(); e.circuit = c;
    const renamed = clone(c); renamed.components[gate].name = 'Renamed'; e.commit('Rename', renamed); e.undo();
    const before = clone(e.circuit), future = clone(e.future);
    expect(() => e.updateProperties(gate, { name: 'Enable', inputCount: 16, invertedInputs: [] })).toThrow('우회할 수 없습니다');
    expect(e.circuit).toEqual(before); expect(e.history).toHaveLength(0); expect(e.future).toEqual(future);
  });
});

describe('invalid simulation input is visible and cannot silently become a zero drive', () => {
  it.each(['Q', null, undefined, NaN, 2, {}, [], '', 'x', 0, 1, true])('rejects explicit %j with an error and an X drive', value => {
    const { c, input, output } = inverter(), before = clone(c);
    const supplied = { [input]: value as LogicValue }, plan = compileCircuit(c);
    const result = simulate(plan, supplied);
    expect(result.outputs[output]).toBe('X');
    expect(result.pins[c.components[input].pins[0]]).toBe('X');
    expect(result.diagnostics).toEqual([expect.objectContaining({ code: 'INVALID_INPUT', severity: 'error', objects: [input] })]);
    expect(c).toEqual(before); expect(supplied[input]).toBe(value);
    expect(simulate(plan, { [input]: '1' }).outputs[output]).toBe('0');
  });
  it('an omitted input keeps the documented default zero; explicit X/Z remain valid', () => {
    const { c, input, output } = inverter(), plan = compileCircuit(c);
    expect(simulate(plan).outputs[output]).toBe('1');
    for (const value of ['0', '1', 'X', 'Z'] as const)
      expect(simulate(plan, { [input]: value }).diagnostics.some(d => d.code === 'INVALID_INPUT')).toBe(false);
  });
  it('reports unknown IDs and values assigned to a gate without disturbing valid inputs', () => {
    const { c, input, gate, output } = inverter();
    for (const unknown of ['missing', 'constructor', '__proto__']) {
      const values: Record<string, LogicValue> = Object.create(null);
      values[input] = '1'; values[gate] = '0'; values[unknown] = '1';
      const result = simulate(compileCircuit(c), values);
      expect(result.outputs[output]).toBe('0');
      expect(result.diagnostics.map(d => [d.code, d.objects])).toEqual([['INVALID_INPUT', [gate]], ['INVALID_INPUT', []]]);
    }
  });
  it('malformed input containers produce a diagnostic rather than throwing', () => {
    const { c, output } = inverter();
    for (const bad of [null, [], 'bad', new Map(), new Date()] as unknown[]) {
      const result = simulate(compileCircuit(c), bad as Record<string, LogicValue>);
      expect(result.diagnostics).toEqual([
        expect.objectContaining({ code: 'INVALID_INPUT', severity: 'error' }),
      ]);
      expect(result.outputs[output]).toBe('X');
    }
  });
  it('accepts an ordinary input dictionary with no prototype', () => {
    const { c, input, output } = inverter();
    const values: Record<string, LogicValue> = Object.create(null); values[input] = '1';
    const result = simulate(compileCircuit(c), values);
    expect(result.outputs[output]).toBe('0'); expect(result.diagnostics).toEqual([]);
  });
});

describe('diagnostics identify objects and preserve severity and complete feedback membership', () => {
  it('a circuit validation error is distinct from a valid unknown logic value in the diagram and panel', () => {
    const { c } = inverter(), wire = Object.values(c.geometry.wires)[0];
    wire.points = [wire.points[0], { x: 200, y: 105 }, wire.points.at(-1)!];
    const result = simulate(compileCircuit(c));
    expect(result.diagnostics[0].code).toBe('INVALID_CIRCUIT');
    const svg = renderToStaticMarkup(createElement(Symbols, { circuit: c, selection: [], simulation: result }));
    expect(svg).toContain('오류'); expect(svg).toContain('계산 중단');
    expect(svg).not.toContain('signal-X'); expect(svg).not.toContain('data-wire-value=');
    const panel = renderToStaticMarkup(createElement(SimulationPanel, {
      circuit: c, result, inputs: {}, busy: false, onInput: () => {}, onReset: () => {}, onLocate: () => {},
    }));
    expect(panel).toContain('signal-badge signal-invalid'); expect(panel).toContain('>오류</output>');
  });
  it('two unconnected gates with the same name and position have distinguishable messages', () => {
    const c = emptyCircuit();
    const a = addComponent(c, 'AND', { x: 100, y: 100 }), b = addComponent(c, 'AND', { x: 100, y: 100 });
    const rows = simulate(compileCircuit(c)).diagnostics.filter(d => d.code === 'FLOATING_INPUT');
    expect(rows).toHaveLength(4); expect(new Set(rows.map(d => d.message)).size).toBe(4);
    expect(new Set(rows.flatMap(d => d.objects))).toEqual(new Set([a, b]));
  });
  it('rejects an orphan pin even when its owner component exists', () => {
    const { c, gate } = inverter();
    c.pins.orphan = { id: 'orphan', component: gate, index: 2, direction: 'in' };
    expect(validateCircuit(c)).toContain('핀 소유권 오류');
    expect(simulate(compileCircuit(c)).diagnostics.map(d => d.code)).toEqual(['INVALID_CIRCUIT']);
  });
  it('a 0/1 conflict is an error and multiple drivers are a separate warning', () => {
    const { c, input, gate } = inverter();
    const other = addComponent(c, 'Input', { x: 100, y: 300 });
    connect(c, { type: 'pin', id: c.components[other].pins[0] }, { type: 'pin', id: c.components[gate].pins[0] },
      route(pinPosition(c, c.components[other].pins[0]), pinPosition(c, c.components[gate].pins[0])));
    const result = simulate(compileCircuit(c), { [input]: '0', [other]: '1' });
    expect(result.diagnostics.map(d => [d.code, d.severity])).toEqual([['MULTIPLE_DRIVERS', 'warning'], ['DRIVE_CONFLICT', 'error']]);
  });
  it('a feedback diagnostic includes all members, including when registration order changes', () => {
    const c = emptyCircuit(), gates = [0, 1, 2, 3, 4].map(i => addComponent(c, 'NOT', { x: 100 + i * 120, y: 100 }));
    gates.forEach((id, i) => {
      const a = c.components[id].pins[1], b = c.components[gates[(i + 1) % gates.length]].pins[0];
      connect(c, { type: 'pin', id: a }, { type: 'pin', id: b }, route(pinPosition(c, a), pinPosition(c, b)));
    });
    for (const components of [c.components, Object.fromEntries(Object.entries(c.components).reverse())]) {
      const result = simulate(compileCircuit({ ...c, components }));
      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0]).toMatchObject({ code: 'COMBINATIONAL_FEEDBACK', severity: 'warning' });
      expect([...result.diagnostics[0].objects].sort()).toEqual([...gates].sort());
    }
  });
});
