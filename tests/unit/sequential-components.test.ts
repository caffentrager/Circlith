import { describe, expect, it } from 'vitest';
import { addComponent, clone, connect, emptyCircuit, memoryKinds, memoryPorts, type Kind, type MemoryKind } from '../../src/model/circuit';
import { pinPosition, route, transform } from '../../src/geometry/geometry';
import { validateCircuit } from '../../src/model/connections';
import { TimeSession } from '../../src/simulation/time-session';
import { compileCircuit, simulate } from '../../src/simulation/simulator';
import { Editor } from '../../src/editor/editor';
import type { LogicValue } from '../../src/simulation/logic';

function fixture() {
  const c = emptyCircuit();
  const add = (kind: Kind) => addComponent(c, kind, { x: 100 + 140 * Object.keys(c.components).length, y: 100 });
  const wire = (a: string, b: string, index = 0) => {
    const from = c.components[a].pins.at(-1)!, to = c.components[b].pins[index];
    connect(c, { type: 'pin', id: from }, { type: 'pin', id: to }, route(pinPosition(c, from), pinPosition(c, to)));
  };
  const q = (s: TimeSession, id: string) => s.result.pins[c.components[id].pins.at(-1)!];
  return { c, add, wire, q };
}
function memory(kind: MemoryKind, initial: '0' | '1' | 'X' = '0') {
  const f = fixture(), part = f.add(kind);
  if (kind === 'DFF') f.c.components[part].dff!.initial = initial;
  else f.c.components[part].memory!.initial = initial;
  const sources = memoryPorts[kind].slice(0, -1).map((_, i) => { const id = f.add('Input'); f.wire(id, part, i); return id; });
  const values: Record<string, LogicValue> = Object.fromEntries(sources.map(id => [id, '0']));
  const s = new TimeSession(f.c, values);
  const set = (...bits: LogicValue[]) => { sources.forEach((id, i) => { values[id] = bits[i]; }); s.setInputs(values); };
  return { ...f, part, sources, values, s, set, value: () => f.q(s, part) };
}

describe('sequential component family', () => {
  it.each(memoryKinds)('%s pin geometry, move/rotate and properties preserve identities and exact Undo/Redo', kind => {
    const f = memory(kind), e = new Editor(); e.circuit = f.c;
    expect(validateCircuit(f.c)).toEqual([]);
    expect(f.c.components[f.part].pins).toHaveLength(memoryPorts[kind].length);
    for (const rotation of [90, 180, 270]) expect(validateCircuit(transform(f.c, [f.part], { x: 20, y: 30 }, rotation))).toEqual([]);
    const original = clone(e.circuit), ids = [...original.components[f.part].pins];
    e.updateProperties(f.part, { name: 'state', inputCount: ids.length - 1, invertedInputs: [],
      ...(kind === 'DFF' ? { dff: { edge: 'falling', initial: '1' } } : { memory: { edge: 'falling', initial: '1', activeLevel: 'low' } }) });
    const after = clone(e.circuit);
    expect(after.components[f.part].pins).toEqual(ids); expect(validateCircuit(after)).toEqual([]);
    e.undo(); expect(e.circuit).toEqual(original); e.redo(); expect(e.circuit).toEqual(after);
  });

  it.each([
    ['0', '0', '0', '0'], ['0', '0', '1', '1'], ['1', '0', '0', '1'], ['1', '0', '1', '1'],
    ['0', '1', '0', '0'], ['0', '1', '1', '0'], ['1', '1', '0', '1'], ['1', '1', '1', '0'],
    ['0', 'X', '0', '0'], ['X', '0', '1', '1'], ['1', '0', 'X', '1'], ['0', '1', 'X', '0'], ['1', '1', 'X', 'X'],
  ] as const)('JK J=%s K=%s initial=%s → %s on one active edge', (j, k, initial, expected) => {
    const f = memory('JKFF', initial); f.set(j, k, '0');
    expect(f.value()).toBe(initial); f.set(j, k, '1'); expect(f.value()).toBe(expected);
    f.set(j, k, '1'); expect(f.value()).toBe(expected); // no double toggle in delta rounds
    f.set(j, k, '0'); expect(f.value()).toBe(expected);
  });
  it.each(['0', '1'] as const)('T toggles only when T=1, from Q=%s', initial => {
    const f = memory('TFF', initial); f.set('0', '1'); expect(f.value()).toBe(initial);
    f.set('1', '0'); f.set('1', '1'); expect(f.value()).toBe(initial === '0' ? '1' : '0');
    f.set('0', '0'); f.set('0', '1'); expect(f.value()).toBe(initial === '0' ? '1' : '0');
  });
  it('DFFE holds when disabled, including an uncertain enable with identical outcomes', () => {
    const f = memory('DFFE'); f.set('1', '0', '1'); expect(f.value()).toBe('0');
    f.set('1', '1', '0'); f.set('1', '1', '1'); expect(f.value()).toBe('1');
    f.set('1', 'X', '0'); f.set('1', 'X', '1'); expect(f.value()).toBe('1');
    f.set('0', 'X', '0'); f.set('0', 'X', '1'); expect(f.value()).toBe('X');
  });
  it('DFFSR async controls dominate D/CLK, conflict is X with a diagnostic, and release never invents an edge', () => {
    const f = memory('DFFSR'); f.set('0', '0', '1', '0'); expect(f.value()).toBe('1');
    f.set('0', '1', '1', '0'); expect(f.value()).toBe('1');
    f.set('0', '1', '0', '0'); expect(f.value()).toBe('1');
    f.set('1', '1', '0', '1'); expect(f.value()).toBe('0');
    f.set('0', '1', '1', '1'); expect(f.value()).toBe('X');
    expect(f.s.result.diagnostics.map(d => d.code)).toContain('INVALID_SEQUENTIAL_INPUT');
    f.set('1', '0', '0', '0'); f.set('1', '1', '0', '0'); expect(f.value()).toBe('1');
    f.set('0', '0', '0', '1'); f.s.reset(); expect(f.value()).toBe('0');
  });
  it('SRFF sets/resets/holds on the clock edge and can recover from forbidden inputs', () => {
    const f = memory('SRFF'); f.set('1', '0', '0'); expect(f.value()).toBe('0');
    f.set('1', '0', '1'); expect(f.value()).toBe('1');
    f.set('0', '0', '0'); f.set('0', '0', '1'); expect(f.value()).toBe('1');
    f.set('0', '1', '0'); f.set('0', '1', '1'); expect(f.value()).toBe('0');
    f.set('1', '1', '0'); f.set('1', '1', '1'); expect(f.value()).toBe('X');
    f.set('1', '0', '0'); f.set('1', '0', '1'); expect(f.value()).toBe('1');
  });
  it.each(['high', 'low'] as const)('D latch is transparent at EN=%s, not edge-triggered', activeLevel => {
    const f = memory('DLatch'); f.c.components[f.part].memory!.activeLevel = activeLevel;
    const active = activeLevel === 'high' ? '1' : '0', inactive = active === '1' ? '0' : '1';
    const s = new TimeSession(f.c, { [f.sources[0]]: '0', [f.sources[1]]: inactive });
    const set = (data: LogicValue, en: LogicValue) => s.setInputs({ [f.sources[0]]: data, [f.sources[1]]: en });
    set('1', inactive); expect(f.q(s, f.part)).toBe('0'); set('1', active); expect(f.q(s, f.part)).toBe('1');
    set('0', active); expect(f.q(s, f.part)).toBe('0'); set('0', inactive); set('1', inactive); expect(f.q(s, f.part)).toBe('0');
    expect(s.time).toBe(0); expect(s.hasEvents).toBe(false);
  });
  it('SR latch changes without CLK and does not fabricate a known power-on state', () => {
    const f = memory('SRLatch', 'X'); expect(f.value()).toBe('X');
    f.set('1', '0'); expect(f.value()).toBe('1'); f.set('0', '0'); expect(f.value()).toBe('1');
    f.set('0', '1'); expect(f.value()).toBe('0'); f.set('0', '0'); expect(f.value()).toBe('0');
    f.set('1', '1'); expect(f.value()).toBe('X'); f.set('0', '0'); expect(f.value()).toBe('X');
    f.set('1', '0'); expect(f.value()).toBe('1');
  });
  it.each([false, true])('four-stage ripple T counter counts 0..15 independently of insertion order (reverse=%s)', reverse => {
    const f = fixture(), clock = f.add('Clock'), high = f.add('Input'), bits = Array.from({ length: 4 }, () => f.add('TFF'));
    bits.forEach((id, i) => { f.c.components[id].memory = { edge: 'falling', initial: '0', activeLevel: 'high' }; f.wire(high, id); f.wire(i ? bits[i - 1] : clock, id, 1); });
    if (reverse) f.c.components = Object.fromEntries(Object.entries(f.c.components).reverse());
    const s = new TimeSession(f.c, { [high]: '1' }), value = () => bits.reduce((n, id, i) => n + Number(f.q(s, id)) * 2 ** i, 0);
    for (let count = 1; count <= 20; count++) { s.step('period', clock); expect(value()).toBe(count % 16); }
    expect(s.result.diagnostics).toEqual([]);
  });
  it('mixed latch chain settles at reset without sampling initial clock levels', () => {
    const f = fixture(), source = f.add('SRLatch'), latch = f.add('DLatch'), ff = f.add('DFF'), high = f.add('Input'), low = f.add('Input');
    f.wire(high, source); f.wire(low, source, 1); f.wire(source, latch); f.wire(high, latch, 1); f.wire(latch, ff); f.wire(high, ff, 1);
    const s = new TimeSession(f.c, { [high]: '1', [low]: '0' });
    expect(f.q(s, source)).toBe('1'); expect(f.q(s, latch)).toBe('1'); expect(f.q(s, ff)).toBe('X');
  });
  it('invalid new properties/layouts are diagnosed, and failed property edits retain the circuit', () => {
    const f = memory('JKFF'), original = clone(f.c), e = new Editor(); e.circuit = f.c;
    expect(() => e.updateProperties(f.part, { name: 'invalid', inputCount: 3, invertedInputs: [], memory: { edge: 'bad', initial: '0', activeLevel: 'high' } as never })).toThrow();
    expect(e.circuit).toEqual(original); expect(e.history).toHaveLength(0);
    f.c.components[f.part].memory = null as never;
    const invalid = new TimeSession(f.c); expect(invalid.invalid).toBe(true); expect(invalid.step()).toBe(false);
    f.c.components[f.part].memory = original.components[f.part].memory;
    f.c.components[f.part].pins.pop(); expect(simulate(compileCircuit(f.c)).diagnostics[0].code).toBe('INVALID_CIRCUIT');
  });
  it('an unstable transparent-latch circuit stops safely at initialization instead of crashing the app', () => {
    const f = fixture(), latch = f.add('DLatch'), inverter = f.add('NOT'), enable = f.add('Input');
    f.c.components[latch].memory!.initial = '0';
    f.wire(latch, inverter); f.wire(inverter, latch); f.wire(enable, latch, 1);
    const original = clone(f.c), s = new TimeSession(f.c, { [enable]: '1' });
    expect(s.error).toContain('64'); expect(s.hasEvents).toBe(false); expect(s.time).toBe(0);
    expect(s.result.diagnostics.map(d => d.code)).toContain('SEQUENTIAL_LIMIT');
    expect(() => s.reset()).not.toThrow(); expect(f.c).toEqual(original);
  });
});

describe('gate-built memory feedback regression', () => {
  function latch(kind: 'NOR' | 'NAND', reverse = false) {
    const f = fixture(), a = f.add(kind), b = f.add(kind), s = f.add('Input'), r = f.add('Input');
    f.wire(r, a); f.wire(b, a, 1); f.wire(s, b); f.wire(a, b, 1);
    if (reverse) f.c.components = Object.fromEntries(Object.entries(f.c.components).reverse());
    return { ...f, a, b, s, r };
  }
  it.each([false, true])('NOR SR latch sets, holds, resets and holds (reverse=%s)', reverse => {
    const f = latch('NOR', reverse), s = new TimeSession(f.c), values = () => [f.q(s, f.a), f.q(s, f.b)];
    expect(values()).toEqual(['X', 'X']); expect(s.result.diagnostics.map(d => d.code)).toContain('COMBINATIONAL_FEEDBACK');
    s.setInputs({ [f.s]: '1', [f.r]: '0' }); expect(values()).toEqual(['1', '0']);
    s.setInputs({ [f.s]: '0', [f.r]: '0' }); expect(values()).toEqual(['1', '0']);
    s.setInputs({ [f.s]: '0', [f.r]: '1' }); expect(values()).toEqual(['0', '1']);
    s.setInputs({ [f.s]: '0', [f.r]: '0' }); expect(values()).toEqual(['0', '1']);
    expect(s.result.diagnostics).toEqual([]); expect(s.time).toBe(0);
    s.reset(); expect(values()).toEqual(['X', 'X']);
  });
  it('NAND SR latch uses active-low controls and retains state after release', () => {
    const f = latch('NAND'), s = new TimeSession(f.c, { [f.s]: '1', [f.r]: '1' });
    s.setInputs({ [f.s]: '1', [f.r]: '0' }); expect([f.q(s, f.a), f.q(s, f.b)]).toEqual(['1', '0']);
    s.setInputs({ [f.s]: '1', [f.r]: '1' }); expect([f.q(s, f.a), f.q(s, f.b)]).toEqual(['1', '0']);
    s.setInputs({ [f.s]: '0', [f.r]: '1' }); expect([f.q(s, f.a), f.q(s, f.b)]).toEqual(['0', '1']);
  });
  it('an unstable independent loop cannot destroy a valid latch or fabricate an oscillation frequency', () => {
    const f = latch('NOR'), loop = f.add('NAND'), control = f.add('Input'); f.wire(loop, loop); f.wire(control, loop, 1);
    const s = new TimeSession(f.c, { [f.s]: '1', [f.r]: '0', [control]: '0' });
    expect(f.q(s, loop)).toBe('1');
    s.setInputs({ [f.s]: '0', [f.r]: '0', [control]: '1' });
    expect(f.q(s, f.a)).toBe('1'); expect(f.q(s, f.b)).toBe('0'); expect(f.q(s, loop)).toBe('X');
    const warnings = s.result.diagnostics.filter(d => d.code === 'COMBINATIONAL_FEEDBACK');
    expect(warnings).toHaveLength(1); expect(warnings[0].objects).toEqual([loop]); expect(warnings[0].message).toContain('안정화 실패');
    expect(s.error).toBeNull();
  });
});
