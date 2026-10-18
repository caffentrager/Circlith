import { afterAll, describe, expect, it } from 'vitest';
import { clone, type Circuit, type GateKind, type Kind } from '../src/model/circuit';
import { updateComponentProperties } from '../src/model/component-properties';
import { assertCircuit } from '../src/model/connections';
import { transform } from '../src/geometry/geometry';
import { compileCircuit, simulate, type SimulationResult } from '../src/simulation/simulator';
import type { LogicValue } from '../src/simulation/logic';
import { builder, record, renameIds, rng, V } from './helpers';

const summary: Record<string, unknown> = {};

// ---------------------------------------------------------------- independent reference (does NOT import evaluateGate/invert/resolveDrivers)
type LV = LogicValue;
const possible = (v: LV, inverted: boolean): number[] => {
  const base = v === '0' ? [0] : v === '1' ? [1] : [0, 1]; // X and Z are both "unknown 0 or 1" at a gate input
  return inverted ? base.map(b => 1 - b) : base;
};
const toLV = (s: Set<number>): LV => s.size === 1 ? (s.has(1) ? '1' : '0') : 'X';
/** Brute-force possibility-set semantics: enumerate every consistent Boolean assignment. */
function refGate(kind: GateKind, values: LV[], inv: boolean[]): LV {
  const lists = values.map((v, i) => possible(v, !!inv[i]));
  const out = new Set<number>();
  const rec = (i: number, acc: number[]) => {
    if (out.size === 2) return;
    if (i === lists.length) {
      const ones = acc.filter(b => b === 1).length;
      let r: number;
      switch (kind) {
        case 'AND': case 'NAND': r = ones === acc.length ? 1 : 0; break;
        case 'OR': case 'NOR': r = ones > 0 ? 1 : 0; break;
        case 'XOR': case 'XNOR': r = ones % 2; break;
        case 'NOT': r = 1 - acc[0]; break;
      }
      if (kind === 'NAND' || kind === 'NOR' || kind === 'XNOR') r = 1 - r;
      out.add(r);
      return;
    }
    for (const b of lists[i]) rec(i + 1, [...acc, b]);
  };
  rec(0, []);
  return toLV(out);
}
/** Closed form used for wide gates (cross-checked against the brute force on small sizes below). */
function refGateFast(kind: GateKind, values: LV[], inv: boolean[]): LV {
  const lists = values.map((v, i) => possible(v, !!inv[i]));
  const canBe = (b: number) => lists.map(l => l.includes(b));
  const unknown = lists.some(l => l.length === 2);
  let outs: number[];
  if (kind === 'AND' || kind === 'NAND') {
    const can0 = canBe(0).some(Boolean), can1 = canBe(1).every(Boolean);
    outs = [...(can0 ? [0] : []), ...(can1 ? [1] : [])];
    if (kind === 'NAND') outs = outs.map(b => 1 - b);
  } else if (kind === 'OR' || kind === 'NOR') {
    const can1 = canBe(1).some(Boolean), can0 = canBe(0).every(Boolean);
    outs = [...(can0 ? [0] : []), ...(can1 ? [1] : [])];
    if (kind === 'NOR') outs = outs.map(b => 1 - b);
  } else {
    if (unknown) outs = [0, 1];
    else { const p = lists.reduce((s, l) => s ^ l[0], 0); outs = [kind === 'XNOR' ? 1 - p : p]; }
  }
  return toLV(new Set(outs));
}

const KINDS: Exclude<GateKind, 'NOT'>[] = ['AND', 'OR', 'XOR', 'NAND', 'NOR', 'XNOR'];

function gateCircuit(kind: GateKind, n: number, inverted: boolean[]) {
  const b = builder();
  const ins = Array.from({ length: n }, () => b.add('Input'));
  const g = b.add(kind), o = b.add('Output');
  let c = b.c;
  if (kind !== 'NOT') c = updateComponentProperties(c, g, { name: kind, inputCount: n, invertedInputs: inverted });
  else c = updateComponentProperties(c, g, { name: kind, inputCount: 1, invertedInputs: inverted });
  return { c, ins, g, o };
}
import { connect } from '../src/model/circuit';
import { pinPosition, route } from '../src/geometry/geometry';
function wired(kind: GateKind, n: number, inverted: boolean[]) {
  const f = gateCircuit(kind, n, inverted), c = f.c;
  f.ins.forEach((inp, i) => {
    const a = c.components[inp].pins[0], bpin = c.components[f.g].pins[i];
    connect(c, { type: 'pin', id: a }, { type: 'pin', id: bpin }, route(pinPosition(c, a), pinPosition(c, bpin)));
  });
  const a = c.components[f.g].pins.at(-1)!, bpin = c.components[f.o].pins[0];
  connect(c, { type: 'pin', id: a }, { type: 'pin', id: bpin }, route(pinPosition(c, a), pinPosition(c, bpin)));
  assertCircuit(c);
  return { ...f, c };
}

describe('independent four-state oracle: closed form agrees with brute force', () => {
  it('fast == brute for n<=5, all value tuples, all inversion masks', () => {
    let checked = 0;
    for (const kind of KINDS) for (let n = 2; n <= 4; n++) {
      const total = 4 ** n;
      for (let mask = 0; mask < 1 << n; mask++) for (let t = 0; t < total; t++) {
        const vals = Array.from({ length: n }, (_, i) => V[Math.floor(t / 4 ** i) % 4]);
        const inv = Array.from({ length: n }, (_, i) => !!(mask >> i & 1));
        expect(refGateFast(kind, vals, inv)).toBe(refGate(kind, vals, inv)); checked++;
      }
    }
    summary['oracle self-check tuples'] = checked;
  });
});

describe('simulator vs oracle: exhaustive 4-state tables through real circuits (n=2,3,4, every inversion mask)', () => {
  for (const kind of KINDS) for (const n of [2, 3, 4]) it(`${kind} n=${n}`, () => {
    let sims = 0, mismatches: unknown[] = [];
    for (let mask = 0; mask < 1 << n; mask++) {
      const inv = Array.from({ length: n }, (_, i) => !!(mask >> i & 1));
      const f = wired(kind, n, inv), plan = compileCircuit(f.c);
      expect(plan.errors).toEqual([]);
      const gatePins = f.c.components[f.g].pins;
      expect(gatePins.length).toBe(n + 1);
      for (let t = 0; t < 4 ** n; t++) {
        const vals = Array.from({ length: n }, (_, i) => V[Math.floor(t / 4 ** i) % 4]);
        const r = simulate(plan, Object.fromEntries(f.ins.map((id, i) => [id, vals[i]])));
        const expected = refGate(kind, vals, inv);
        sims++;
        if (r.outputs[f.o] !== expected) mismatches.push({ vals, inv, got: r.outputs[f.o], expected });
        // inversion bubbles apply to what the gate reads only; the displayed pin/net value stays the raw driver value
        vals.forEach((v, i) => { if (r.pins[gatePins[i]] !== v) mismatches.push({ pinMismatch: i, vals, got: r.pins[gatePins[i]] }); });
      }
    }
    summary[`exhaustive ${kind} n=${n}`] = { sims, mismatches: mismatches.length };
    expect(mismatches.slice(0, 3)).toEqual([]);
  });
  for (const mask of [0, 1]) it(`NOT inverted=${!!mask}`, () => {
    const f = wired('NOT', 1, [!!mask]);
    for (const v of V) {
      const r = simulate(compileCircuit(f.c), { [f.ins[0]]: v });
      expect(r.outputs[f.o]).toBe(refGate('NOT', [v], [!!mask]));
    }
  });
});

describe('simulator vs oracle: wide gates (8, 15, 16 inputs)', () => {
  const rand = rng(0xC1AC117);
  for (const kind of KINDS) for (const n of [8, 15, 16]) it(`${kind} n=${n}: structured + 400 seeded random tuples/masks`, () => {
    const cases: { vals: LV[]; inv: boolean[] }[] = [];
    const allInv = [Array(n).fill(false), Array(n).fill(true), Array.from({ length: n }, (_, i) => i % 2 === 0)];
    for (const inv of allInv) {
      for (const base of ['0', '1'] as LV[]) {
        cases.push({ vals: Array(n).fill(base), inv });
        for (const special of ['0', '1', 'X', 'Z'] as LV[]) for (const pos of [0, 1, n >> 1, n - 2, n - 1]) {
          const vals = Array(n).fill(base) as LV[]; vals[pos] = special; cases.push({ vals, inv });
        }
      }
      // XOR parity ladder: exactly k ones, k = 0,1,2,7,8,15,16 (clamped)
      for (const k of [0, 1, 2, 7, 8, 15, 16]) if (k <= n) cases.push({ vals: Array.from({ length: n }, (_, i) => i < k ? '1' : '0') as LV[], inv });
    }
    for (let i = 0; i < 400; i++) cases.push({
      vals: Array.from({ length: n }, () => (rand() < 0.7 ? V[Math.floor(rand() * 2)] : V[Math.floor(rand() * 4)])),
      inv: Array.from({ length: n }, () => rand() < 0.3),
    });
    let bad = 0, firstBad: unknown = null;
    const plans = new Map<string, { f: ReturnType<typeof wired>; plan: ReturnType<typeof compileCircuit> }>();
    for (const { vals, inv } of cases) {
      const key = inv.map(Number).join('');
      if (!plans.has(key)) { const f = wired(kind, n, inv); plans.set(key, { f, plan: compileCircuit(f.c) }); }
      const { f, plan } = plans.get(key)!;
      const r = simulate(plan, Object.fromEntries(f.ins.map((id, i) => [id, vals[i]])));
      const e = refGateFast(kind, vals, inv);
      if (r.outputs[f.o] !== e) { bad++; firstBad ??= { vals, inv, got: r.outputs[f.o], e }; }
    }
    summary[`wide ${kind} n=${n}`] = { cases: cases.length, bad };
    expect(firstBad).toBeNull();
  });
  it('XOR/XNOR parity with ones = 0,1,2,7,8,15,16 on a 16-input gate (plain and one inverted input)', () => {
    for (const kind of ['XOR', 'XNOR'] as const) for (const invFirst of [false, true]) {
      const inv = Array.from({ length: 16 }, (_, i) => invFirst && i === 0);
      const f = wired(kind, 16, inv), plan = compileCircuit(f.c);
      for (const k of [0, 1, 2, 7, 8, 15, 16]) {
        const vals = Array.from({ length: 16 }, (_, i) => (i < k ? '1' : '0')) as LV[];
        const r = simulate(plan, Object.fromEntries(f.ins.map((id, i) => [id, vals[i]])));
        const read = vals.reduce((s, v, i) => s + ((v === '1') !== inv[i] ? 1 : 0), 0);
        const parity = read % 2;
        expect(r.outputs[f.o]).toBe(String(kind === 'XOR' ? parity : 1 - parity));
      }
    }
  });
});

describe('driver resolution oracle (0..3 drivers, every value tuple)', () => {
  for (const n of [1, 2, 3]) it(`${n} Input drivers on one Output`, () => {
    const b = builder(), ins = Array.from({ length: n }, () => b.add('Input')), o = b.add('Output');
    ins.forEach(i => b.wire(i, o));
    const plan = compileCircuit(b.c); let bad = 0;
    for (let t = 0; t < 4 ** n; t++) {
      const vals = Array.from({ length: n }, (_, i) => V[Math.floor(t / 4 ** i) % 4]);
      const r = simulate(plan, Object.fromEntries(ins.map((id, i) => [id, vals[i]])));
      const active = vals.filter(v => v !== 'Z'), set = new Set(active);
      const expected = active.length === 0 ? 'Z' : set.size === 1 ? active[0] : 'X';
      const multiple = active.length > 1 ? 1 : 0, conflict = set.has('0') && set.has('1') ? 1 : 0;
      const codes = r.diagnostics.map(d => d.code);
      if (r.outputs[o] !== expected || codes.filter(c => c === 'MULTIPLE_DRIVERS').length !== multiple ||
        codes.filter(c => c === 'DRIVE_CONFLICT').length !== conflict) bad++;
    }
    summary[`drivers n=${n}`] = { tuples: 4 ** n, bad };
    expect(bad).toBe(0);
  });
});

// ---------------------------------------------------------------- random graphs, metamorphic
type G = { c: Circuit; ins: string[]; gates: string[]; outs: string[] };
function randomGraph(seed: number, gatesN = 12, cyclic = true): G {
  const rand = rng(seed), b = builder();
  const ins = Array.from({ length: 2 + Math.floor(rand() * 3) }, () => b.add('Input'));
  const kinds: Kind[] = ['AND', 'OR', 'XOR', 'NAND', 'NOR', 'XNOR', 'NOT'];
  const gates: string[] = [], plans: { g: string; kind: Kind }[] = [];
  for (let i = 0; i < gatesN; i++) { const kind = kinds[Math.floor(rand() * kinds.length)]; const g = b.add(kind); gates.push(g); plans.push({ g, kind }); }
  const outs = Array.from({ length: 3 }, () => b.add('Output'));
  let c = b.c;
  plans.forEach(({ g, kind }, i) => {
    if (kind !== 'NOT') {
      const n = 2 + Math.floor(rand() * 4);
      c = updateComponentProperties(c, g, { name: `${kind}${i}`, inputCount: n, invertedInputs: Array.from({ length: n }, () => rand() < 0.25) });
    } else c = updateComponentProperties(c, g, { name: `N${i}`, inputCount: 1, invertedInputs: [rand() < 0.3] });
  });
  const circuit = c; const gate0 = (pool: string[]) => pool[0];
  const wire = (fromComp: string, toPin: string) => {
    const a = circuit.components[fromComp].pins.at(-1)!;
    connect(circuit, { type: 'pin', id: a }, { type: 'pin', id: toPin }, route(pinPosition(circuit, a), pinPosition(circuit, toPin)));
  };
  gates.forEach((g, gi) => {
    for (const pin of circuit.components[g].pins.slice(0, -1)) {
      if (rand() < 0.12) continue; // leave floating
      const pool = cyclic ? [...ins, ...gates] : [...ins, ...gates.slice(0, gi)];
      wire(pool[Math.floor(rand() * pool.length)], pin);
      if (rand() < 0.1) { const second = pool[Math.floor(rand() * pool.length)]; if (circuit.components[second].pins.at(-1) !== circuit.components[gate0(pool)].pins.at(-1)) wire(second, pin); }
    }
  });
  for (const o of outs) wire(rand() < 0.2 ? ins[0] : gates[Math.floor(rand() * gates.length)], circuit.components[o].pins[0]);
  assertCircuit(circuit);
  return { c: circuit, ins, gates, outs };
}

/** Independent evaluator: dependency closure for cycles, memoised recursion for the rest. */
function reference(g: G, inputs: Record<string, LV>) {
  const { c } = g;
  const pinNet = new Map<string, string[]>(); // pin -> all pins sharing its net
  for (const net of Object.values(c.nets)) for (const p of net.pins) pinNet.set(p, net.pins);
  const members = (p: string) => pinNet.get(p) ?? [p];
  const drivers = (p: string) => members(p).filter(q => c.pins[q].direction === 'out');
  const gateOf = (p: string) => c.pins[p].component;
  const dep = new Map<string, Set<string>>(); // gate -> gates it reads from
  for (const gate of g.gates) {
    const s = new Set<string>();
    for (const p of c.components[gate].pins.filter(q => c.pins[q].direction === 'in'))
      for (const d of drivers(p)) if (g.gates.includes(gateOf(d))) s.add(gateOf(d));
    dep.set(gate, s);
  }
  const reach = new Map<string, Set<string>>();
  for (const gate of g.gates) {
    const seen = new Set<string>(), stack = [...dep.get(gate)!];
    while (stack.length) { const x = stack.pop()!; if (seen.has(x)) continue; seen.add(x); stack.push(...dep.get(x)!); }
    reach.set(gate, seen);
  }
  const cyclic = new Set(g.gates.filter(x => reach.get(x)!.has(x)));
  const groups: string[][] = [];
  const done = new Set<string>();
  for (const x of cyclic) if (!done.has(x)) {
    const grp = [...cyclic].filter(y => y === x || (reach.get(x)!.has(y) && reach.get(y)!.has(x)));
    grp.forEach(y => done.add(y)); groups.push(grp);
  }
  const memo = new Map<string, LV>();
  const driveOf = (outPin: string): LV => {
    const comp = gateOf(outPin);
    if (c.components[comp].kind === 'Input') return inputs[comp] ?? '0';
    if (cyclic.has(comp)) return 'X';
    if (memo.has(comp)) return memo.get(comp)!;
    const k = c.components[comp].kind as GateKind;
    const ins = c.components[comp].pins.filter(q => c.pins[q].direction === 'in');
    const vals = ins.map(netValue), inv = ins.map(q => !!c.pins[q].inverted);
    const r = refGate(k, vals, inv);
    memo.set(comp, r); return r;
  };
  const netValue = (p: string): LV => {
    const act = drivers(p).map(driveOf).filter(v => v !== 'Z');
    const set = new Set(act);
    return act.length === 0 ? 'Z' : set.size === 1 ? act[0] : 'X';
  };
  const pins: Record<string, LV> = {};
  for (const p of Object.keys(c.pins)) pins[p] = netValue(p);
  const outputs = Object.fromEntries(g.outs.map(o => [o, pins[c.components[o].pins[0]]]));
  // diagnostics counts
  const seenNets = new Set<string[]>();
  let multiple = 0, conflict = 0, floating = 0;
  for (const p of Object.keys(c.pins)) {
    const m = members(p);
    if (seenNets.has(m)) continue; seenNets.add(m);
    const act = drivers(m[0]).map(driveOf).filter(v => v !== 'Z');
    if (act.length > 1) multiple++;
    if (act.includes('0') && act.includes('1')) conflict++;
    if (act.length === 0) floating += m.filter(q => c.pins[q].direction === 'in').length;
  }
  return { pins, outputs, counts: { MULTIPLE_DRIVERS: multiple, DRIVE_CONFLICT: conflict, FLOATING_INPUT: floating, COMBINATIONAL_FEEDBACK: groups.length } };
}
const countCodes = (r: SimulationResult) => {
  const m: Record<string, number> = { MULTIPLE_DRIVERS: 0, DRIVE_CONFLICT: 0, FLOATING_INPUT: 0, COMBINATIONAL_FEEDBACK: 0 };
  for (const d of r.diagnostics) m[d.code] = (m[d.code] ?? 0) + 1;
  return m;
};

describe('random graphs: simulator == independent reference (multi-input, inverted bubbles, cycles, fanout, floating)', () => {
  it('400 seeded graphs x 4 input vectors', () => {
    let graphs = 0, vectors = 0, bad = 0, firstBad: unknown = null, withCycles = 0, withMulti = 0;
    for (let seed = 1; seed <= 400; seed++) {
      const g = randomGraph(seed * 7919, 6 + (seed % 9), seed % 2 === 0);
      const plan = compileCircuit(g.c);
      expect(plan.errors).toEqual([]);
      graphs++;
      for (let k = 0; k < 4; k++) {
        const rand = rng(seed * 31 + k);
        const inputs = Object.fromEntries(g.ins.map(i => [i, V[Math.floor(rand() * 4)]])) as Record<string, LV>;
        const r = simulate(plan, inputs), e = reference(g, inputs);
        vectors++;
        if (e.counts.COMBINATIONAL_FEEDBACK) withCycles++;
        if (e.counts.MULTIPLE_DRIVERS) withMulti++;
        const pinsOk = Object.keys(e.pins).every(p => r.pins[p] === e.pins[p]);
        const outOk = Object.keys(e.outputs).every(o => r.outputs[o] === e.outputs[o]);
        const cnt = countCodes(r);
        const cntOk = (Object.keys(e.counts) as (keyof typeof e.counts)[]).every(key => cnt[key] === e.counts[key]);
        if (!pinsOk || !outOk || !cntOk) { bad++; firstBad ??= { seed, inputs, pinsOk, outOk, cnt, expected: e.counts }; }
      }
    }
    summary['random graphs'] = { graphs, vectors, bad, vectorsWithCycles: withCycles, vectorsWithMultiDriver: withMulti };
    expect(firstBad).toBeNull();
  });

  it('metamorphic: registration order, geometry (translate+rotate), ID renaming do not change meaning (200 graphs)', () => {
    let bad = 0, firstBad: unknown = null, n = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const g = randomGraph(seed * 104729, 6 + (seed % 9), true);
      const rand = rng(seed);
      const inputs = Object.fromEntries(g.ins.map(i => [i, V[Math.floor(rand() * 4)]])) as Record<string, LV>;
      const base = simulate(compileCircuit(g.c), inputs);
      const shuffleRec = <T,>(o: Record<string, T>) => Object.fromEntries(Object.entries(o).sort(() => rand() - 0.5));
      // 1) registration order of everything
      const v1 = clone(g.c);
      v1.components = shuffleRec(v1.components); v1.pins = shuffleRec(v1.pins); v1.nets = shuffleRec(v1.nets);
      v1.geometry.wires = shuffleRec(v1.geometry.wires);
      for (const net of Object.values(v1.nets)) net.pins.reverse();
      for (const comp of Object.values(v1.components)) void comp; // pin order inside a component is semantic (indices) - untouched
      // 2) geometry: translate and rotate every component
      const v2 = transform(g.c, Object.keys(g.c.components), { x: 120, y: -60 }, 90);
      // 3) ID renaming (short ids, plus a "pin:" prefixed id on a *connected* net)
      const ids = [...Object.keys(g.c.components), ...Object.keys(g.c.pins), ...Object.keys(g.c.nets), ...Object.keys(g.c.geometry.wires)];
      const map = Object.fromEntries(ids.map((id, i) => [id, `k${i}`]));
      const v3 = renameIds(g.c, map);
      const inputs3 = Object.fromEntries(Object.entries(inputs).map(([k, v]) => [map[k], v])) as Record<string, LV>;
      for (const [label, c, inp, mapPin] of [['order', v1, inputs, (p: string) => p], ['geometry', v2, inputs, (p: string) => p], ['rename', v3, inputs3, (p: string) => map[p]]] as const) {
        assertCircuit(c as Circuit);
        const r = simulate(compileCircuit(c as Circuit), inp as Record<string, LV>);
        n++;
        const same = Object.keys(base.pins).every(p => r.pins[mapPin(p)] === base.pins[p]) &&
          JSON.stringify(countCodes(r)) === JSON.stringify(countCodes(base));
        if (!same) { bad++; firstBad ??= { seed, label }; }
      }
    }
    summary['metamorphic'] = { variants: n, bad };
    expect(firstBad).toBeNull();
  });
});

afterAll(() => record('oracle-outcomes', summary));
