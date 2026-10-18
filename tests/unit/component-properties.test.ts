import { describe, expect, it } from 'vitest';
import { Editor } from '../../src/editor/editor';
import { addComponent, clone, connect, emptyCircuit, type GateKind } from '../../src/model/circuit';
import { updateComponentProperties } from '../../src/model/component-properties';
import { assertCircuit } from '../../src/model/connections';
import { boxComponents, pinPosition, route } from '../../src/geometry/geometry';
import { compileCircuit, simulate } from '../../src/simulation/simulator';
import { evaluateGate } from '../../src/simulation/logic';
import { componentObstacles } from '../../src/geometry/routing';

function fixture(rotation = 0) {
  const c = emptyCircuit(), source = addComponent(c, 'Input', { x: 60, y: 40 }),
    gate = addComponent(c, 'AND', { x: 300, y: 250 }, rotation), output = addComponent(c, 'Output', { x: 600, y: 250 });
  const wire = (a: string, b: string) => connect(c, { type: 'pin', id: a }, { type: 'pin', id: b }, route(pinPosition(c, a), pinPosition(c, b)));
  wire(c.components[source].pins[0], c.components[gate].pins[0]);
  wire(c.components[gate].pins[2], c.components[output].pins[0]);
  return { c, source, gate, output, wire };
}
describe('component property transactions', () => {
  it.each([0, 90, 180, 270])('retains existing pins, nets, wire IDs and endpoint attachment at %s degrees', rotation => {
    const { c, gate } = fixture(rotation), original = clone(c), pins = c.components[gate].pins;
    const next = updateComponentProperties(c, gate, { name: 'Enable', inputCount: 5, invertedInputs: [false, true, false, false, true] });
    expect(c).toEqual(original);
    expect(next.components[gate].pins.slice(0, 2)).toEqual(pins.slice(0, 2));
    expect(next.components[gate].pins.at(-1)).toBe(pins[2]);
    expect(next.pins[pins[2]].index).toBe(5);
    expect(next.nets).toEqual(c.nets);
    expect(Object.keys(next.geometry.wires)).toEqual(Object.keys(c.geometry.wires));
    assertCircuit(next);
    expect(compileCircuit(next).errors).toEqual([]);
    const positions = next.components[gate].pins.map(pin => JSON.stringify(pinPosition(next, pin)));
    expect(new Set(positions).size).toBe(6);
  });
  it('uses one history entry, exact Undo/Redo and does not record an unchanged Apply', () => {
    const { c, gate } = fixture(), editor = new Editor(); editor.circuit = c;
    editor.updateProperties(gate, { name: 'AND', inputCount: 2, invertedInputs: [] });
    expect(editor.history).toHaveLength(0);
    editor.updateProperties(gate, { name: 'ABCD', inputCount: 4, invertedInputs: [false, false, true] });
    const after = clone(editor.circuit);
    expect(editor.history).toHaveLength(1);
    editor.undo(); expect(editor.circuit).toEqual(c);
    editor.redo(); expect(editor.circuit).toEqual(after);
  });
  it('allows unconnected trailing inputs to be removed and rejects connected removal atomically', () => {
    const { c, gate, source } = fixture();
    const larger = updateComponentProperties(c, gate, { name: 'AND', inputCount: 4, invertedInputs: [false, true, true] });
    const smaller = updateComponentProperties(larger, gate, { name: 'AND', inputCount: 2, invertedInputs: [false, true] });
    expect(smaller.components[gate].pins).toEqual(c.components[gate].pins);
    expect(Object.keys(smaller.pins)).toEqual(Object.keys(c.pins));
    const a = larger.components[source].pins[0], b = larger.components[gate].pins[3];
    connect(larger, { type: 'pin', id: a }, { type: 'pin', id: b }, route(pinPosition(larger, a), pinPosition(larger, b)));
    const before = clone(larger), editor = new Editor(); editor.circuit = larger;
    expect(() => editor.updateProperties(gate, { name: 'New', inputCount: 2, invertedInputs: [] })).toThrow('배선이 연결');
    expect(editor.circuit).toEqual(before); expect(editor.history).toHaveLength(0);
  });
  it('keeps fixed waypoints on a resized connected route', () => {
    const { c, gate } = fixture();
    const wire = Object.values(c.geometry.wires)[0]; wire.anchors = [clone(wire.points[1])];
    const next = updateComponentProperties(c, gate, { name: 'AND', inputCount: 8, invertedInputs: [] });
    expect(next.geometry.wires[wire.id].anchors).toEqual(wire.anchors);
    assertCircuit(next);
  });
  it('rejects invalid counts and names without mutating the circuit', () => {
    const { c, gate } = fixture(), before = clone(c);
    for (const count of [0, 1, 2.5, 17, NaN]) expect(() => updateComponentProperties(c, gate, { name: 'A', inputCount: count, invertedInputs: [] })).toThrow();
    for (const name of ['', ' ', 'a'.repeat(81)]) expect(() => updateComponentProperties(c, gate, { name, inputCount: 2, invertedInputs: [] })).toThrow();
    expect(c).toEqual(before);
  });
  it('expands selection and routing bounds for tall gates and their rotation', () => {
    const { c, gate } = fixture();
    const next = updateComponentProperties(c, gate, { name: 'AND', inputCount: 16, invertedInputs: [] });
    expect(boxComponents(next, { x: 250, y: 200 }, { x: 350, y: 300 })).not.toContain(gate);
    expect(boxComponents(next, { x: 250, y: 80 }, { x: 350, y: 420 })).toContain(gate);
    expect(componentObstacles(next, 0)[1]).toMatchObject({ top: 90, bottom: 410 });
    next.geometry.components[gate].rotation = 90;
    expect(componentObstacles(next, 0)[1]).toMatchObject({ left: 140, right: 460 });
  });
});
describe('multi-input simulation and input bubbles', () => {
  it.each([
    ['AND', ['1', '1', '1'], '1'], ['AND', ['1', 'Z', '0'], '0'],
    ['NAND', ['1', '1', '1'], '0'], ['OR', ['0', '0', '1'], '1'],
    ['NOR', ['0', '0', '0'], '1'], ['XOR', ['1', '1', '1'], '1'],
    ['XNOR', ['1', '1', '1'], '0'], ['XOR', ['1', '1', 'Z'], 'X'],
  ] as const)('%s handles %s', (kind, inputs, expected) => {
    expect(evaluateGate(kind as GateKind, inputs)).toBe(expected);
  });
  it('inverts individual pins at the gate without changing the net value', () => {
    const { c, gate, source, output } = fixture();
    const next = updateComponentProperties(c, gate, { name: 'Enable', inputCount: 3, invertedInputs: [true, false, true] });
    for (const index of [1, 2]) {
      const a = next.components[source].pins[0], b = next.components[gate].pins[index];
      connect(next, { type: 'pin', id: a }, { type: 'pin', id: b }, route(pinPosition(next, a), pinPosition(next, b)));
    }
    const result = simulate(compileCircuit(next));
    expect(result.outputs[output]).toBe('0');
    expect(next.components[gate].pins.slice(0, 3).map(pin => result.pins[pin])).toEqual(['0', '0', '0']);
    expect(result.diagnostics).toEqual([]);
    expect(simulate(compileCircuit(next), { [source]: 'Z' }).outputs[output]).toBe('X');
    // Make every input inverted: three zero net values now yield AND(1,1,1).
    const inverted = updateComponentProperties(next, gate, { name: 'Enable', inputCount: 3, invertedInputs: [true, true, true] });
    expect(simulate(compileCircuit(inverted)).outputs[output]).toBe('1');
  });
});
