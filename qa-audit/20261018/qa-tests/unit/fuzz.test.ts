import { afterAll, describe, expect, it } from 'vitest';
import { Editor } from '../src/editor/editor';
import { gateInputCount, isBinaryGate, type Circuit, type ConnectionTarget, type Kind, type Point } from '../src/model/circuit';
import { validateCircuit } from '../src/model/connections';
import { pinPosition } from '../src/geometry/geometry';
import { compileCircuit, simulate } from '../src/simulation/simulator';
import type { LogicValue } from '../src/simulation/logic';
import { countCodes, reference } from './reference';
import { record, rng, V } from './helpers';

const summary: Record<string, unknown> = {};
const KINDS: Kind[] = ['Input', 'Output', 'AND', 'OR', 'NOT', 'XOR', 'NAND', 'NOR', 'XNOR'];

type Failure = { seed: number; step: number; op: string; problem: string; log: string[] };

function orthogonal(points: Point[]) {
  return points.every((p, i) => Number.isFinite(p.x) && Number.isFinite(p.y) && (i === 0 || (p.x === points[i - 1].x) !== (p.y === points[i - 1].y)));
}

function runSeed(seed: number, steps: number): { failure: Failure | null; stats: Record<string, number> } {
  const rand = rng(seed), e = new Editor();
  const log: string[] = [], stats: Record<string, number> = { committed: 0, rejected: 0, unexpected: 0, spur: 0, simChecks: 0, undo: 0, redo: 0 };
  const snaps: string[] = [JSON.stringify(e.circuit)]; // circuit JSON after each committed history entry
  const pick = <T,>(xs: T[]): T => xs[Math.floor(rand() * xs.length)];
  const comps = () => Object.keys(e.circuit.components);
  const occupied = new Set<string>();
  const freeCell = (): Point => {
    for (let t = 0; t < 40; t++) {
      const col = Math.floor(rand() * 8), row = Math.floor(rand() * 6), key = `${col},${row}`;
      if (!occupied.has(key)) { occupied.add(key); return { x: 120 + col * 220, y: 120 + row * 260 }; }
    }
    return { x: 120 + Math.floor(rand() * 8) * 220, y: 120 + Math.floor(rand() * 6) * 260 };
  };
  const fail = (step: number, op: string, problem: string): { failure: Failure; stats: Record<string, number> } =>
    ({ failure: { seed, step, op, problem, log: log.slice(-12) }, stats });

  for (let step = 0; step < steps; step++) {
    const before = JSON.stringify(e.circuit), historyBefore = e.history.length;
    let op = 'noop', threw: Error | null = null;
    const c = e.circuit;
    try {
      const r = rand();
      if (r < 0.18 || comps().length < 3) {
        const kind = pick(KINDS); op = `place ${kind}`;
        e.place(kind, freeCell()); e.confirm();
      } else if (r < 0.40) {
        const a = pick(comps()), b = pick(rand() < 0.1 ? [a] : comps());
        const pa = pick(c.components[a].pins), pb = pick(c.components[b].pins);
        op = `wire ${pa}->${pb}`;
        const to: ConnectionTarget = { type: 'pin', id: pb };
        e.startWire({ type: 'pin', id: pa }); e.update(pinPosition(c, pb), to); e.confirm(to);
        e.cancel(); e.setTool('SELECT');
      } else if (r < 0.50) {
        // A wire whose endpoints coincide is valid but has no segment on which to choose a branch midpoint.
        const wires = Object.values(c.geometry.wires).filter(wire => wire.points.length > 1);
        if (wires.length) {
          const w = pick(wires), i = Math.floor(rand() * (w.points.length - 1));
          const a = w.points[i], b = w.points[i + 1];
          const position = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
          const b2 = pick(comps()), pb = pick(c.components[b2].pins);
          op = `branch ${w.id}@${position.x},${position.y} -> ${pb}`;
          const from: ConnectionTarget = { type: 'wire', id: w.id, position }, to: ConnectionTarget = { type: 'pin', id: pb };
          e.startWire(from); e.update(pinPosition(c, pb), to); e.confirm(to);
          e.cancel(); e.setTool('SELECT');
        }
      } else if (r < 0.60) {
        const n = 1 + Math.floor(rand() * 2), sel = Array.from({ length: n }, () => pick(comps()));
        const d = { x: (Math.floor(rand() * 21) - 10) * 10, y: (Math.floor(rand() * 21) - 10) * 10 }, rot = pick([0, 0, 90, 180, 270]);
        op = `move ${sel.join(',')} by ${d.x},${d.y} rot ${rot}`;
        e.selection = [...new Set(sel)]; e.move({ x: 0, y: 0 });
        if (e.draft?.type === 'MOVE') { e.update(d); e.draft.rotation = rot; e.confirm(); }
      } else if (r < 0.66) {
        const k = pick(comps()); op = `rotate ${k}`;
        e.selection = [k]; e.rotate(rand() < 0.5);
      } else if (r < 0.80) {
        const k = pick(comps()), comp = c.components[k];
        const count = isBinaryGate(comp.kind) ? 2 + Math.floor(rand() * 15) : 1;
        const inverted = Array.from({ length: count }, () => rand() < 0.3);
        const name = rand() < 0.3 ? `n${step}` : comp.name;
        op = `props ${comp.kind} ${k} count=${count}`;
        e.updateProperties(k, { name, inputCount: count, invertedInputs: inverted });
      } else if (r < 0.88) {
        op = 'delete';
        if (rand() < 0.5 && comps().length) e.selection = [pick(comps())];
        else if (Object.keys(c.geometry.wires).length) e.selection = [pick(Object.keys(c.geometry.wires))];
        e.deleteSelection();
      } else if (r < 0.94) { op = 'undo'; e.undo(); stats.undo++; }
      else { op = 'redo'; e.redo(); stats.redo++; }
    } catch (err) { threw = err as Error; }
    e.cancel(); e.setTool('SELECT');
    { const kind = op.split(' ')[0]; stats[`${threw ? 'rejected' : 'ok'}:${kind}`] = (stats[`${threw ? 'rejected' : 'ok'}:${kind}`] ?? 0) + 1; }
    log.push(`${step}: ${op}${threw ? ` !! ${threw.name}: ${threw.message}` : ''}`);

    if (threw) {
      if (!/[가-힣]/.test(threw.message) || threw.name !== 'Error') { stats.unexpected++; return fail(step, op, `unexpected exception ${threw.name}: ${threw.message}`); }
      stats.rejected++;
      if (JSON.stringify(e.circuit) !== before || e.history.length !== historyBefore) return fail(step, op, 'rejected operation changed circuit/history');
    }
    // history bookkeeping
    if (e.history.length > snaps.length - 1 || e.history.length < snaps.length - 1) {
      if (/^undo|^redo/.test(op)) { snaps.length = 0; }
    }
    if (e.history.length !== historyBefore) stats.committed++;
    // ---- invariants on the current (committed) circuit
    const cur: Circuit = e.circuit;
    const errors = validateCircuit(cur);
    if (errors.length) return fail(step, op, `validateCircuit: ${errors.join(' | ')}`);
    for (const w of Object.values(cur.geometry.wires)) {
      if (!orthogonal(w.points)) return fail(step, op, `non-orthogonal / non-finite wire ${w.id}`);
      for (let i = 2; i < w.points.length; i++) {
        const p = w.points[i - 2], a = w.points[i - 1], b = w.points[i];
        if ((p.x === a.x && a.x === b.x && (a.y - p.y) * (b.y - a.y) < 0) || (p.y === a.y && a.y === b.y && (a.x - p.x) * (b.x - a.x) < 0)) { stats.spur++; break; }
      }
    }
    for (const k of e.selection) if (!cur.components[k] && !cur.geometry.wires[k]) return fail(step, op, 'selection references a missing object');
    const plan = compileCircuit(cur);
    if (plan.errors.length) return fail(step, op, `compile errors: ${plan.errors.join(' | ')}`);
    const inputs = Object.fromEntries(Object.values(cur.components).filter(k => k.kind === 'Input').map(k => [k.id, V[Math.floor(rand() * 4)]])) as Record<string, LogicValue>;
    const got = simulate(plan, inputs), want = reference(cur, inputs);
    stats.simChecks++;
    for (const [p, v] of Object.entries(want.pins)) if (got.pins[p] !== v) return fail(step, op, `pin ${p}: simulator ${got.pins[p]} vs reference ${v}`);
    for (const [o, v] of Object.entries(want.outputs)) if (got.outputs[o] !== v) return fail(step, op, `output ${o}: simulator ${got.outputs[o]} vs reference ${v}`);
    const cnt = countCodes(got);
    for (const key of Object.keys(want.counts) as (keyof typeof want.counts)[]) if (cnt[key] !== want.counts[key]) return fail(step, op, `diagnostic count ${key}: ${cnt[key]} vs ${want.counts[key]}`);
    // every component keeps matching pin/geometry records
    for (const k of Object.values(cur.components)) {
      const expected = k.kind === 'NOT' ? 2 : k.kind === 'Input' || k.kind === 'Output' ? 1 : gateInputCount(k) + 1;
      if (k.pins.length !== expected) return fail(step, op, `pin count of ${k.kind}`);
    }
  }
  // Undo all the way, then Redo all the way
  const finalJson = JSON.stringify(e.circuit), depth = e.history.length;
  for (let i = 0; i < depth; i++) e.undo();
  if (e.history.length !== 0) return fail(steps, 'final undo', 'history not empty after undoing everything');
  if (JSON.stringify(e.circuit) !== JSON.stringify({ components: {}, pins: {}, nets: {}, junctions: {}, geometry: { components: {}, junctions: {}, wires: {} } }))
    return fail(steps, 'final undo', 'circuit not empty after undoing everything');
  for (let i = 0; i < depth; i++) e.redo();
  if (JSON.stringify(e.circuit) !== finalJson) return fail(steps, 'final redo', 'redo-all does not reproduce the final circuit');
  return { failure: null, stats };
}

describe('17 stateful adversarial model fuzz (fixed seeds)', () => {
  const seeds = [1, 2, 3, 4, 5, 6, 7, 8].slice(0, Number(process.env.QA_FUZZ_SEEDS ?? 8));
  const all: Record<string, unknown> = {};
  for (const seed of seeds) it(`seed ${seed}: 1000 operations`, () => {
    const { failure, stats } = runSeed(seed, 1000);
    all[`seed ${seed}`] = failure ?? stats;
    if (failure) record(`fuzz-failure-seed-${seed}`, failure);
    expect(failure).toBeNull();
  }, 600000);
  afterAll(() => { summary['fuzz'] = all; });
});

afterAll(() => record('fuzz-outcomes', summary));
void expect;
