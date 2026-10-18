import type { Circuit, GateKind } from '../src/model/circuit';
import type { LogicValue } from '../src/simulation/logic';
import type { SimulationResult } from '../src/simulation/simulator';

type LV = LogicValue;
const possible = (v: LV, inverted: boolean): number[] => {
  const base = v === '0' ? [0] : v === '1' ? [1] : [0, 1];
  return inverted ? base.map(b => 1 - b) : base;
};
/** Independent four-state gate: enumerate every consistent Boolean assignment of the unknown inputs. */
export function refGate(kind: GateKind, values: LV[], inv: boolean[]): LV {
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
        default: r = 1 - acc[0];
      }
      if (kind === 'NAND' || kind === 'NOR' || kind === 'XNOR') r = 1 - r;
      out.add(r);
      return;
    }
    for (const b of lists[i]) rec(i + 1, [...acc, b]);
  };
  if (lists.length > 14) { // closed form for very wide gates
    const unknown = lists.some(l => l.length === 2);
    const can0 = lists.some(l => l.includes(0)), all1 = lists.every(l => l.includes(1)), can1 = lists.some(l => l.includes(1)), all0 = lists.every(l => l.includes(0));
    let outs: number[];
    if (kind === 'AND' || kind === 'NAND') { outs = [...(can0 ? [0] : []), ...(all1 ? [1] : [])]; if (kind === 'NAND') outs = outs.map(b => 1 - b); }
    else if (kind === 'OR' || kind === 'NOR') { outs = [...(all0 ? [0] : []), ...(can1 ? [1] : [])]; if (kind === 'NOR') outs = outs.map(b => 1 - b); }
    else if (unknown) outs = [0, 1];
    else { const p = lists.reduce((s, l) => s ^ l[0], 0); outs = [kind === 'XNOR' ? 1 - p : p]; }
    return outs.length === 1 ? (outs[0] ? '1' : '0') : 'X';
  }
  rec(0, []);
  return out.size === 1 ? (out.has(1) ? '1' : '0') : 'X';
}

export type Reference = {
  pins: Record<string, LV>;
  outputs: Record<string, LV>;
  counts: { MULTIPLE_DRIVERS: number; DRIVE_CONFLICT: number; FLOATING_INPUT: number; COMBINATIONAL_FEEDBACK: number };
};
/** Independent evaluator: transitive-closure cycle detection and memoised recursion. */
export function reference(c: Circuit, inputs: Record<string, LV>): Reference {
  const gates = Object.values(c.components).filter(k => k.kind !== 'Input' && k.kind !== 'Output').map(k => k.id);
  const outs = Object.values(c.components).filter(k => k.kind === 'Output').map(k => k.id);
  const pinNet = new Map<string, string[]>();
  for (const net of Object.values(c.nets)) for (const p of net.pins) pinNet.set(p, net.pins);
  const members = (p: string) => pinNet.get(p) ?? [p];
  const drivers = (p: string) => members(p).filter(q => c.pins[q].direction === 'out');
  const gateOf = (p: string) => c.pins[p].component;
  const dep = new Map<string, Set<string>>();
  for (const gate of gates) {
    const s = new Set<string>();
    for (const p of c.components[gate].pins.filter(q => c.pins[q].direction === 'in'))
      for (const d of drivers(p)) if (gates.includes(gateOf(d))) s.add(gateOf(d));
    dep.set(gate, s);
  }
  const reach = new Map<string, Set<string>>();
  for (const gate of gates) {
    const seen = new Set<string>(), stack = [...dep.get(gate)!];
    while (stack.length) { const x = stack.pop()!; if (seen.has(x)) continue; seen.add(x); stack.push(...dep.get(x)!); }
    reach.set(gate, seen);
  }
  const cyclic = new Set(gates.filter(x => reach.get(x)!.has(x)));
  const groups: string[][] = [], done = new Set<string>();
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
    const ins = c.components[comp].pins.filter(q => c.pins[q].direction === 'in');
    const r = refGate(c.components[comp].kind as GateKind, ins.map(netValue), ins.map(q => !!c.pins[q].inverted));
    memo.set(comp, r); return r;
  };
  const netValue = (p: string): LV => {
    const act = drivers(p).map(driveOf).filter(v => v !== 'Z'), set = new Set(act);
    return act.length === 0 ? 'Z' : set.size === 1 ? act[0] : 'X';
  };
  const pins: Record<string, LV> = {};
  for (const p of Object.keys(c.pins)) pins[p] = netValue(p);
  const outputs = Object.fromEntries(outs.map(o => [o, pins[c.components[o].pins[0]]]));
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
export const countCodes = (r: SimulationResult) => {
  const m = { MULTIPLE_DRIVERS: 0, DRIVE_CONFLICT: 0, FLOATING_INPUT: 0, COMBINATIONAL_FEEDBACK: 0 } as Record<string, number>;
  for (const d of r.diagnostics) m[d.code] = (m[d.code] ?? 0) + 1;
  return m;
};
