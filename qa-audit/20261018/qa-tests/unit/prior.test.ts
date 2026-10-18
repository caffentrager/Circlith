import { afterAll, describe, expect, it } from 'vitest';
import { clone, type Circuit } from '../src/model/circuit';
import { validateCircuit } from '../src/model/connections';
import { compileCircuit, simulate } from '../src/simulation/simulator';
import type { LogicValue } from '../src/simulation/logic';
import { builder, record, renameIds, run, V } from './helpers';

const outcomes: Record<string, unknown> = {};

/** A -> NOT -> Out, plus an unconnected Input B whose output pin is "floating". */
function f1Fixture() {
  const b = builder();
  const A = b.add('Input'), B = b.add('Input'), N = b.add('NOT'), O = b.add('Output');
  b.wire(A, N); b.wire(N, O);
  return { ...b, A, B, N, O, bPin: b.out(B) };
}
const renameNet = (c: Circuit, from: string, to: string) => renameIds(c, { [from]: to });

describe('F1 - signal ID namespace collision', () => {
  const prefixes = ['pin:', 'junction:', 'net:', '', 'x-', 'a b ', '../', '\u{1F642}', 'pin:pin:'];
  for (const prefix of prefixes) {
    it(`net renamed to "${prefix}<B pin id>" keeps NOT semantics for all A/B values`, () => {
      const f = f1Fixture();
      const netId = Object.values(f.c.nets)[0].id;
      const c = renameNet(f.c, netId, `${prefix}${f.bPin}`);
      const errors = validateCircuit(c);
      let bad = 0;
      const rows: unknown[] = [];
      for (const a of V) for (const bv of V) {
        const r = run(c, { [f.A]: a, [f.B]: bv });
        const expected = a === '0' ? '1' : a === '1' ? '0' : 'X';
        if (r.outputs[f.O] !== expected) bad++;
        rows.push({ a, b: bv, out: r.outputs[f.O], expected });
        for (const pin of Object.keys(c.pins)) if (!(pin in r.pins)) bad++;
      }
      outcomes[`F1 prefix=${JSON.stringify(prefix)}`] = { validatorErrors: errors, mismatches: bad };
      // An ID identical to an existing pin ID is a duplicate: the validator rejecting it is the correct outcome.
      if (errors.length) { expect(compileCircuit(c).errors.length).toBeGreaterThan(0); return; }
      expect(bad).toBe(0);
    });
  }
  it('UI generated ids never contain a reserved prefix (reachability from the UI)', () => {
    const f = f1Fixture();
    const ids = [...Object.keys(f.c.nets), ...Object.keys(f.c.pins), ...Object.keys(f.c.components)];
    expect(ids.every(i => /^[0-9a-f-]{36}$/.test(i))).toBe(true);
  });
});

describe('F3/P3-5 - corrupted data totality (compile+simulate must not throw)', () => {
  const mutations: Record<string, (c: Circuit, f: ReturnType<typeof f1Fixture>) => void> = {
    'delete component record only': (c, f) => { delete c.components[f.N]; },
    'delete component + geometry, pins/wires remain': (c, f) => { delete c.components[f.N]; delete c.geometry.components[f.N]; },
    'component = null': (c, f) => { (c.components as any)[f.N] = null; },
    'component.pins = undefined': (c, f) => { (c.components[f.N] as any).pins = undefined; },
    'geometry.components missing': c => { (c.geometry as any).components = undefined; },
    'geometry undefined': c => { (c as any).geometry = undefined; },
    'components missing': c => { (c as any).components = undefined; },
    'pins missing': c => { (c as any).pins = undefined; },
    'nets missing': c => { (c as any).nets = undefined; },
    'pin record deleted': (c, f) => { delete c.pins[c.components[f.N].pins[0]]; },
    'net record deleted': c => { delete c.nets[Object.keys(c.nets)[0]]; },
    'net.pins undefined': c => { (c.nets[Object.keys(c.nets)[0]] as any).pins = undefined; },
    'wire endpoint undefined': c => { (Object.values(c.geometry.wires)[0] as any).from = undefined; },
    'wire.points undefined': c => { (Object.values(c.geometry.wires)[0] as any).points = undefined; },
    'wire.points = []': c => { Object.values(c.geometry.wires)[0].points = []; },
    'wire.points has null': c => { (Object.values(c.geometry.wires)[0].points as any)[0] = null; },
    'junction record missing for wire endpoint': c => { Object.values(c.geometry.wires)[0].to = { type: 'junction', id: 'nope' }; },
    'geometry.components entry missing': (c, f) => { delete c.geometry.components[f.N]; },
    'geometry.components entry null': (c, f) => { (c.geometry.components as any)[f.N] = null; },
    'wrong pin direction': (c, f) => { c.pins[c.components[f.N].pins[0]].direction = 'out'; },
    'wrong pin index': (c, f) => { c.pins[c.components[f.N].pins[0]].index = 7; },
    'unsupported gate kind': (c, f) => { (c.components[f.N] as any).kind = 'FOO'; },
    'duplicate net member': c => { const n = Object.values(c.nets)[0]; n.pins.push(n.pins[0]); },
    'pin.component points elsewhere': (c, f) => { c.pins[c.components[f.N].pins[0]].component = f.A; },
  };
  for (const [name, mutate] of Object.entries(mutations)) it(name, () => {
    const f = f1Fixture(), c = clone(f.c);
    mutate(c, f);
    let verdict = 'no-throw';
    let codes: string[] = [];
    try {
      const r = simulate(compileCircuit(c), { [f.A]: '1' });
      codes = r.diagnostics.map(d => d.code);
    } catch (e) { verdict = 'THROWS ' + (e as Error).message; }
    outcomes[`F3 ${name}`] = verdict === 'no-throw' ? { threw: false, codes } : { threw: true, message: verdict };
    expect(verdict).toBe('no-throw');
    expect(codes).toContain('INVALID_CIRCUIT');
  });
});

describe('P3-6 - invalid input values injected into simulate()', () => {
  for (const bad of ['Q', null, undefined, Number.NaN, 2, {}, [], '', 'x', 0, 1, true] as unknown[]) {
    it(`Input value ${typeof bad === 'object' ? JSON.stringify(bad) : String(bad)}`, () => {
      const f = f1Fixture();
      const r = simulate(compileCircuit(f.c), { [f.A]: bad as LogicValue });
      const silentZero = r.outputs[f.O] === '1' && r.diagnostics.every(d => d.code === 'FLOATING_INPUT' ? false : true) && !r.diagnostics.length;
      outcomes[`P3-6 ${typeof bad === 'object' ? JSON.stringify(bad) : String(bad)}`] = { out: r.outputs[f.O], diagnostics: r.diagnostics.map(d => d.code) };
      expect(silentZero).toBe(false);
    });
  }
});

describe('P3-7/P3-8 - driver diagnostics', () => {
  function multi(a: LogicValue, b: LogicValue) {
    const x = builder(), A = x.add('Input'), B = x.add('Input'), O = x.add('Output');
    x.wire(A, O); x.wire(B, O);
    return { r: run(x.c, { [A]: a, [B]: b }), O, A, B };
  }
  it('same-valued drivers: MULTIPLE_DRIVERS only, no DRIVE_CONFLICT', () => {
    for (const v of ['0', '1'] as const) {
      const { r } = multi(v, v);
      outcomes[`P3-7 ${v}${v}`] = r.diagnostics.map(d => `${d.code}/${d.severity}`);
      expect(r.diagnostics.map(d => d.code)).toEqual(['MULTIPLE_DRIVERS']);
    }
  });
  it('X vs 0/1 is not a 0-vs-1 conflict; Z with 1 is not multiple', () => {
    for (const [a, b] of [['X', '1'], ['X', '0'], ['X', 'X']] as const) {
      const codes = multi(a, b).r.diagnostics.map(d => d.code);
      outcomes[`P3-7 ${a}${b}`] = codes;
      expect(codes).not.toContain('DRIVE_CONFLICT');
    }
    expect(multi('Z', '1').r.diagnostics).toEqual([]);
  });
  it('0-vs-1: error severity DRIVE_CONFLICT (and record duplicate-cause diagnostics)', () => {
    const { r, O } = multi('0', '1');
    outcomes['P3-7 01'] = r.diagnostics.map(d => `${d.code}/${d.severity}/${d.objects.length}`);
    expect(r.outputs[O]).toBe('X');
    expect(r.diagnostics.find(d => d.code === 'DRIVE_CONFLICT')?.severity).toBe('error');
  });
  it('FLOATING_INPUT objects contain no duplicate ids', () => {
    const x = builder(), N = x.add('NOT'), O = x.add('Output'); x.wire(N, O);
    const r = run(x.c);
    const d = r.diagnostics.find(d => d.code === 'FLOATING_INPUT')!;
    outcomes['P3-8 floating objects'] = d.objects;
    expect(new Set(d.objects).size).toBe(d.objects.length);
  });
  it('same-kind gate diagnostics are distinguishable by message', () => {
    const x = builder(), A = x.add('AND'), B = x.add('AND'), O1 = x.add('Output'), O2 = x.add('Output');
    x.wire(A, O1); x.wire(B, O2);
    const msgs = run(x.c).diagnostics.filter(d => d.code === 'FLOATING_INPUT').map(d => d.message);
    outcomes['P3-8 identical messages'] = msgs;
    expect(new Set(msgs).size).toBe(msgs.length);
  });
  it('3+-member SCC lists every member', () => {
    for (const n of [1, 2, 3, 5, 9]) {
      const x = builder(), gates = Array.from({ length: n }, () => x.add('NOT'));
      gates.forEach((g, i) => x.wire(g, gates[(i + 1) % n]));
      const d = run(x.c).diagnostics.filter(d => d.code === 'COMBINATIONAL_FEEDBACK');
      expect(d).toHaveLength(1);
      expect([...d[0].objects].sort()).toEqual([...gates].sort());
      expect(d[0].severity).toBe('warning');
    }
  });
  it('severity map for a 0/1 conflict', () => {
    const x = builder(), A = x.add('Input'), B = x.add('Input'), O = x.add('Output'); x.wire(A, O); x.wire(B, O);
    const sev: Record<string, string> = {};
    for (const d of run(x.c, { [A]: '0', [B]: '1' }).diagnostics) sev[d.code] = d.severity;
    outcomes['severity'] = sev;
    expect(sev).toEqual({ MULTIPLE_DRIVERS: 'warning', DRIVE_CONFLICT: 'error' });
  });
});

describe('P3-9/11/12 - X pessimism, INVALID display inputs, topology/geometry coupling', () => {
  it('X pessimism: XOR(g,g) with g=X is X (documented limitation)', () => {
    const x = builder(), I = x.add('Input'), G = x.add('XOR'), O = x.add('Output');
    x.wire(I, G, 0); x.wire(I, G, 1); x.wire(G, O);
    outcomes['P3-9 xor(x,x)'] = run(x.c, { [I]: 'X' }).outputs[O];
    expect(run(x.c, { [I]: 'X' }).outputs[O]).toBe('X');
  });
  it('topology-valid but geometry-invalid (diagonal wire) -> INVALID_CIRCUIT and every value lost', () => {
    const f = f1Fixture(), c = clone(f.c);
    const w = Object.values(c.geometry.wires)[0];
    w.points = [w.points[0], { x: w.points[0].x + 7, y: w.points[0].y + 9 }, w.points.at(-1)!];
    const r = simulate(compileCircuit(c), { [f.A]: '1' });
    outcomes['P3-12 geometry bad'] = { codes: r.diagnostics.map(d => d.code), pins: Object.keys(r.pins).length, outputs: r.outputs };
    expect(r.diagnostics.map(d => d.code)).toEqual(['INVALID_CIRCUIT']);
  });
});

afterAll(() => record('prior-findings-outcomes', outcomes));
