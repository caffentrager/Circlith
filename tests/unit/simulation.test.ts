import { describe, expect, it } from 'vitest';
import { addComponent, clone, connect, emptyCircuit, type Circuit, type GateKind, type Kind } from '../../src/model/circuit';
import { pinPosition, route } from '../../src/geometry/geometry';
import { compileCircuit, simulate } from '../../src/simulation/simulator';
import { evaluateGate, logicValues, resolveDrivers, type LogicValue } from '../../src/simulation/logic';

function fixture() {
  const circuit = emptyCircuit();
  const add = (kind: Kind) => addComponent(circuit, kind, { x: 100 + Object.keys(circuit.components).length * 120, y: 100 });
  const wire = (source: string, target: string, input = 0) => {
    const from = { type: 'pin' as const, id: circuit.components[source].pins.at(-1)! };
    const to = { type: 'pin' as const, id: circuit.components[target].pins[input] };
    connect(circuit, from, to, route(pinPosition(circuit, from.id), pinPosition(circuit, to.id)));
  };
  return { circuit, add, wire };
}
const run = (circuit: Circuit, inputs: Record<string, LogicValue> = {}) => simulate(compileCircuit(circuit), inputs);

describe('independent four-state truth tables', () => {
  const tables: Record<Exclude<GateKind, 'NOT'>, string[]> = {
    AND: ['0000', '01XX', '0XXX', '0XXX'],
    OR: ['01XX', '1111', 'X1XX', 'X1XX'],
    XOR: ['01XX', '10XX', 'XXXX', 'XXXX'],
    NAND: ['1111', '10XX', '1XXX', '1XXX'],
    NOR: ['10XX', '0000', 'X0XX', 'X0XX'],
    XNOR: ['10XX', '01XX', 'XXXX', 'XXXX'],
  };
  for (const [kind, rows] of Object.entries(tables)) for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) {
    it(`${kind}(${logicValues[a]},${logicValues[b]}) = ${rows[a][b]}`, () => {
      expect(evaluateGate(kind as GateKind, [logicValues[a], logicValues[b]])).toBe(rows[a][b]);
    });
  }
  it.each([['0', '1'], ['1', '0'], ['X', 'X'], ['Z', 'X']] as const)('NOT %s = %s', (a, expected) => {
    expect(evaluateGate('NOT', [a])).toBe(expected);
  });
  const resolution = ['0XX0', 'X1X1', 'XXXX', '01XZ'];
  for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) {
    it(`resolves drivers ${logicValues[a]},${logicValues[b]}`, () => {
      expect(resolveDrivers([logicValues[a], logicValues[b]])).toBe(resolution[a][b]);
    });
  }
  it('undriven nets are Z and driver ordering does not hide conflicts', () => {
    expect(resolveDrivers([])).toBe('Z');
    for (const drivers of [['0', 'Z', '1'], ['1', '0', 'Z'], ['Z', '1', '0']] as LogicValue[][])
      expect(resolveDrivers(drivers)).toBe('X');
  });
});

describe('committed circuit evaluation', () => {
  it('evaluates a half adder truth table with fanout, independent of component insertion order', () => {
    const { circuit, add, wire } = fixture();
    const sum = add('Output'), carry = add('Output'), xor = add('XOR'), and = add('AND'), a = add('Input'), b = add('Input');
    wire(a, xor); wire(b, xor, 1); wire(a, and); wire(b, and, 1); wire(xor, sum); wire(and, carry);
    for (const [av, bv, sv, cv] of [['0', '0', '0', '0'], ['0', '1', '1', '0'], ['1', '0', '1', '0'], ['1', '1', '0', '1']] as const) {
      const result = run(circuit, { [a]: av, [b]: bv });
      expect(result.outputs).toEqual({ [sum]: sv, [carry]: cv });
      expect(result.diagnostics).toEqual([]);
      const reversed = clone(circuit);
      reversed.components = Object.fromEntries(Object.entries(reversed.components).reverse());
      expect(run(reversed, { [a]: av, [b]: bv }).outputs).toEqual(result.outputs);
    }
  });

  it('resolves a long cascade without order-dependent intermediate values or recursion', () => {
    const { circuit, add, wire } = fixture();
    const source = add('Input');
    let previous = source;
    for (let i = 0; i < 400; i++) { const gate = add('NOT'); wire(previous, gate); previous = gate; }
    const sink = add('Output'); wire(previous, sink);
    expect(run(circuit, { [source]: '1' }).outputs[sink]).toBe('1');
  });

  it.each([
    ['0', '0', '0', true, false], ['1', '1', '1', true, false],
    ['0', '1', 'X', true, true], ['Z', '1', '1', false, false],
    ['Z', 'Z', 'Z', false, false], ['X', '1', 'X', true, false], ['X', 'Z', 'X', false, false],
  ] as const)('distinguishes driver %s/%s resolution from physical conflict', (av, bv, expected, multiple, conflict) => {
    const { circuit, add, wire } = fixture();
    const a = add('Input'), b = add('Input'), out = add('Output');
    wire(a, out); wire(b, out);
    const result = run(circuit, { [a]: av, [b]: bv });
    expect(result.outputs[out]).toBe(expected);
    expect(result.diagnostics.some(d => d.code === 'MULTIPLE_DRIVERS')).toBe(multiple);
    expect(result.diagnostics.some(d => d.code === 'DRIVE_CONFLICT')).toBe(conflict);
    expect(result.diagnostics.some(d => d.code === 'FLOATING_INPUT')).toBe(expected === 'Z');
    expect(Object.values(result.nets)).toEqual([expected]);
  });

  it('unconnected inputs are Z, ordinary gates interpret them as unknown, and controlling values prevail', () => {
    const { circuit, add, wire } = fixture();
    const input = add('Input'), gate = add('AND'), out = add('Output'), loose = add('Output');
    wire(input, gate); wire(gate, out);
    expect(run(circuit).outputs).toEqual({ [out]: '0', [loose]: 'Z' });
    const result = run(circuit, { [input]: '1' });
    expect(result.outputs[out]).toBe('X');
    expect(result.pins[circuit.components[gate].pins[1]]).toBe('Z');
    expect(result.diagnostics.filter(d => d.code === 'FLOATING_INPUT')).toHaveLength(2);
  });

  it('reports only cycle members, propagates X downstream, and still resolves independent controlling inputs', () => {
    const { circuit, add, wire } = fixture();
    const a = add('NOT'), b = add('NOT'), downstream = add('AND'), input = add('Input'), out = add('Output');
    wire(a, b); wire(b, a); wire(a, downstream); wire(input, downstream, 1); wire(downstream, out);
    const result = run(circuit);
    const feedback = result.diagnostics.filter(d => d.code === 'COMBINATIONAL_FEEDBACK');
    expect(feedback).toHaveLength(1);
    expect(new Set(feedback[0].objects)).toEqual(new Set([a, b]));
    expect(result.outputs[out]).toBe('0');
    expect(run(circuit, { [input]: '1' }).outputs[out]).toBe('X');
  });

  it('does not invent a stable value for self feedback or claim measured oscillation', () => {
    const { circuit, add, wire } = fixture();
    const gate = add('NOT'), out = add('Output');
    wire(gate, gate); wire(gate, out);
    expect(run(circuit).outputs[out]).toBe('X');
    expect(run(circuit).diagnostics.map(d => d.code)).toContain('COMBINATIONAL_FEEDBACK');
  });

  it('does not mutate the circuit or retain prior input values in a compiled plan', () => {
    const { circuit, add, wire } = fixture();
    const input = add('Input'), out = add('Output'); wire(input, out);
    const original = clone(circuit), plan = compileCircuit(circuit);
    expect(simulate(plan, { [input]: '1' }).outputs[out]).toBe('1');
    expect(simulate(plan).outputs[out]).toBe('0');
    expect(circuit).toEqual(original);
  });

  it('rejects invalid connectivity and invalid gate pin layouts before evaluating', () => {
    const { circuit, add, wire } = fixture();
    const input = add('Input'), gate = add('AND'); wire(input, gate);
    const broken = clone(circuit);
    delete broken.nets[Object.keys(broken.nets)[0]];
    expect(run(broken).diagnostics[0].code).toBe('INVALID_CIRCUIT');
    expect(run(broken).pins).toEqual({});
    circuit.pins[circuit.components[gate].pins[2]].direction = 'in';
    expect(run(circuit).diagnostics[0].code).toBe('INVALID_CIRCUIT');
  });

  it('handles an empty circuit', () => {
    expect(run(emptyCircuit())).toEqual({ pins: {}, nets: {}, outputs: {}, diagnostics: [] });
  });
});
