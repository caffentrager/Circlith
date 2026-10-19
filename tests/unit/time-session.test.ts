import { describe, expect, it } from 'vitest';
import { addComponent, clone, connect, emptyCircuit, type Kind } from '../../src/model/circuit';
import { pinPosition, route } from '../../src/geometry/geometry';
import { compileCircuit, simulate } from '../../src/simulation/simulator';
import { TimeSession, TRACE_LIMIT } from '../../src/simulation/time-session';
import { updateComponentProperties } from '../../src/model/component-properties';

function fixture() {
  const c = emptyCircuit();
  const add = (kind: Kind) => addComponent(c, kind, { x: 100 + Object.keys(c.components).length * 120, y: 100 });
  const wire = (a: string, b: string, input = 0) => {
    const from = { type: 'pin' as const, id: c.components[a].pins.at(-1)! };
    const to = { type: 'pin' as const, id: c.components[b].pins[input] };
    connect(c, from, to, route(pinPosition(c, from.id), pinPosition(c, to.id)));
  };
  return { c, add, wire };
}
function single() {
  const f = fixture(), input = f.add('Input'), clock = f.add('Clock'), ff = f.add('DFF'), output = f.add('Output');
  f.wire(input, ff); f.wire(clock, ff, 1); f.wire(ff, output);
  return { ...f, input, clock, ff, output };
}

describe('deterministic time simulation', () => {
  it('samples only at the active edge; reset preserves inputs and model/history is untouched', () => {
    const { c, input, output } = single(), original = clone(c);
    const s = new TimeSession(c, { [input]: '1' });
    expect(s.result.outputs[output]).toBe('X');
    s.step(); expect(s.time).toBe(5); expect(s.result.outputs[output]).toBe('1');
    s.setInputs({ [input]: '0' }); expect(s.result.outputs[output]).toBe('1');
    s.step(); expect(s.time).toBe(10); expect(s.result.outputs[output]).toBe('1');
    s.step(); expect(s.result.outputs[output]).toBe('0');
    s.reset(); expect(s.time).toBe(0); expect(s.samples).toHaveLength(1);
    expect(s.result.outputs[output]).toBe('X');
    s.step(); expect(s.result.outputs[output]).toBe('0');
    expect(c).toEqual(original);
  });
  it.each([false, true])('FF chain samples previous Q simultaneously (reverse insertion=%s)', reverse => {
    const { c, add, wire } = fixture(), clock = add('Clock'), input = add('Input'), a = add('DFF'), b = add('DFF');
    c.components[a].dff!.initial = '0'; c.components[b].dff!.initial = '0';
    wire(clock, a, 1); wire(clock, b, 1); wire(input, a); wire(a, b);
    if (reverse) c.components = Object.fromEntries(Object.entries(c.components).reverse());
    const s = new TimeSession(c, { [input]: '1' }), q = (id: string) => s.result.pins[c.components[id].pins[2]];
    s.step(); expect([q(a), q(b)]).toEqual(['1', '0']);
    s.step('rising', clock); expect([q(a), q(b)]).toEqual(['1', '1']);
    expect(s.result.diagnostics).toEqual([]);
  });
  it('batches two simultaneous clocks before sampling their shared FF chain', () => {
    const { c, add, wire } = fixture(), ca = add('Clock'), cb = add('Clock'), input = add('Input'), a = add('DFF'), b = add('DFF');
    c.components[a].dff!.initial = '0'; c.components[b].dff!.initial = '0';
    wire(ca, a, 1); wire(cb, b, 1); wire(input, a); wire(a, b);
    const s = new TimeSession(c, { [input]: '1' });
    s.step();
    expect(s.time).toBe(5);
    expect(s.result.pins[c.components[b].pins[2]]).toBe('0');
    expect(s.samples).toHaveLength(2);
  });
  it('supports falling edges, clock phase and exact non-50% duty times', () => {
    const { c, input, clock, ff, output } = single();
    c.components[clock].clock = { period: 7, duty: 33, initial: '1' };
    c.components[ff].dff!.edge = 'falling';
    const s = new TimeSession(c, { [input]: '1' });
    expect(s.result.outputs[output]).toBe('X'); // initial high is not an edge
    s.step(); expect(s.time).toBe(2.31); expect(s.result.outputs[output]).toBe('1');
    s.step(); expect(s.time).toBe(7);
    s.step('period', clock); expect(s.time).toBe(14);
    s.step('rising', clock); expect(s.time).toBe(21);
  });
  it('settles derived clocks in delta rounds and does not label sequential feedback combinational', () => {
    const { c, add, wire } = fixture(), clock = add('Clock'), input = add('Input'), a = add('DFF'), b = add('DFF');
    c.components[a].dff!.initial = '0'; c.components[b].dff!.initial = '0';
    wire(clock, a, 1); wire(input, a); wire(a, b, 1); wire(input, b);
    const s = new TimeSession(c, { [input]: '1' }); s.step();
    expect(s.result.pins[c.components[b].pins[2]]).toBe('1');
    expect(s.result.diagnostics).toEqual([]);
    const n = add('NOT'); wire(b, n); wire(n, a);
    expect(simulate(compileCircuit(c)).diagnostics.some(d => d.code === 'COMBINATIONAL_FEEDBACK')).toBe(false);
  });
  it('supports manually driven clock pins, uncertain edges and X/Z data conservatively', () => {
    const { c, add, wire } = fixture(), clock = add('Input'), data = add('Input'), ff = add('DFF');
    c.components[ff].dff!.initial = '0';
    wire(clock, ff, 1); wire(data, ff);
    const s = new TimeSession(c, { [clock]: '0', [data]: 'Z' }), q = () => s.result.pins[c.components[ff].pins[2]];
    expect(s.hasEvents).toBe(false); expect(s.step()).toBe(false);
    s.setInputs({ [clock]: '1', [data]: 'Z' }); expect(q()).toBe('X'); expect(s.time).toBe(0);
    s.setInputs({ [clock]: '0', [data]: '1' }); s.setInputs({ [clock]: '1', [data]: '1' }); expect(q()).toBe('1');
    s.setInputs({ [clock]: 'X', [data]: '1' }); expect(q()).toBe('1'); // 1 -> X cannot be rising
    s.setInputs({ [clock]: '1', [data]: '1' }); expect(q()).toBe('X'); // uncertain -> 1 may be rising
  });
  it('keeps step modes distinct and captures all other clocks along the way', () => {
    const { c, add } = fixture(), a = add('Clock'), b = add('Clock');
    c.components[b].clock!.period = 4;
    const s = new TimeSession(c); s.step(); expect(s.time).toBe(2);
    s.step('rising', a); expect(s.time).toBe(5);
    expect(s.samples.map(x => x.time)).toEqual([0, 2, 4, 5]);
    s.step('period', a); expect(s.time).toBe(15);
  });
  it('bounds trace memory and does not invent history for newly watched signals', () => {
    const { c, input, ff } = single(), s = new TimeSession(c);
    s.setWatch(['pin:' + c.components[input].pins[0]]);
    s.step(); s.step();
    const key = 'pin:' + c.components[ff].pins[2];
    s.setWatch([...s.watch, key]);
    expect(s.samples[0].values[key]).toBeUndefined();
    expect(s.samples.at(-1)!.values[key]).toBe('0');
    for (let i = 0; i < 600; i++) s.step();
    expect(s.samples).toHaveLength(TRACE_LIMIT); expect(s.dropped).toBeGreaterThan(0);
    expect(() => s.setWatch(['net:missing'])).toThrow();
  });
  it('rejects malformed temporal properties and edits them atomically', () => {
    const { c, clock, ff } = single(), original = clone(c);
    expect(() => updateComponentProperties(c, clock, { name: 'CLK', inputCount: 1, invertedInputs: [], clock: { period: 0, duty: 50, initial: '0' } })).toThrow();
    expect(c).toEqual(original);
    const next = updateComponentProperties(c, ff, { name: 'state', inputCount: 2, invertedInputs: [], dff: { edge: 'falling', initial: '1' } });
    expect(next.components[ff].dff).toEqual({ edge: 'falling', initial: '1' }); expect(c).toEqual(original);
    c.components[clock].clock!.duty = 100;
    const invalid = new TimeSession(c);
    expect(invalid.invalid).toBe(true); expect(invalid.step()).toBe(false);
  });
  it('rolls back an oversized clock step with an explicit error', () => {
    const { c, add } = fixture(), fast = add('Clock'), slow = add('Clock');
    c.components[fast].clock!.period = 2; c.components[slow].clock!.period = 1_000_000;
    const s = new TimeSession(c), before = clone(s.samples);
    expect(s.step('rising', slow)).toBe(false);
    expect(s.time).toBe(0); expect(s.samples).toEqual(before);
    expect(s.result.diagnostics.at(-1)!.code).toBe('SEQUENTIAL_LIMIT');
    expect(s.hasEvents).toBe(false); s.reset(); expect(s.hasEvents).toBe(true);
  });
});
