import { afterAll, describe, it } from 'vitest';
import { emptyCircuit, id, type Circuit, type Kind } from '../src/model/circuit';
import { validateCircuit } from '../src/model/connections';
import { pinPosition, route } from '../src/geometry/geometry';
import { compileCircuit, simulate } from '../src/simulation/simulator';
import { record } from './helpers';

const summary: Record<string, unknown> = {};
let counter = 0;
const uid = () => `u${(counter++).toString(36)}`;
/** Direct record construction: connect() is O(n) per call and would dominate the measurement. */
function addFast(c: Circuit, kind: Kind, x: number, y: number) {
  const key = uid(), count = kind === 'NOT' ? 2 : kind === 'Input' || kind === 'Output' ? 1 : 3;
  const pins = Array.from({ length: count }, (_, index) => {
    const pin = uid();
    c.pins[pin] = { id: pin, component: key, index, direction: kind === 'Input' || (kind === 'NOT' && index === 1) || (kind !== 'NOT' && kind !== 'Output' && index === 2) ? 'out' : 'in' };
    return pin;
  });
  c.components[key] = { id: key, kind, name: kind, pins }; c.geometry.components[key] = { position: { x, y }, rotation: 0 };
  return key;
}
function net(c: Circuit, pins: string[]) {
  const key = uid(); c.nets[key] = { id: key, pins: [...pins], junctions: [] };
  // star topology from the first pin
  for (const p of pins.slice(1)) {
    const w = uid();
    c.geometry.wires[w] = { id: w, net: key, from: { type: 'pin', id: pins[0] }, to: { type: 'pin', id: p }, points: route(pinPosition(c, pins[0]), pinPosition(c, p)) };
  }
  return key;
}
function fanout(n: number) {
  const c = emptyCircuit(), src = addFast(c, 'Input', 0, 0);
  const outs = Array.from({ length: n }, (_, i) => addFast(c, 'Output', 300 + (i % 100) * 100, 40 + Math.floor(i / 100) * 40));
  net(c, [c.components[src].pins[0], ...outs.map(o => c.components[o].pins[0])]);
  return { c, src };
}
function chain(n: number, kind: Kind = 'NOT') {
  const c = emptyCircuit(), src = addFast(c, 'Input', 0, 0);
  let prev = c.components[src].pins[0];
  for (let i = 0; i < n; i++) {
    const g = addFast(c, kind, 200 + i * 120, (i % 5) * 60);
    net(c, [prev, c.components[g].pins[0]]);
    prev = c.components[g].pins.at(-1)!;
  }
  const out = addFast(c, 'Output', 200 + n * 120, 0);
  net(c, [prev, c.components[out].pins[0]]);
  return { c, src, out };
}
const med = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
function time(fn: () => void, reps = 5) { const t: number[] = []; fn(); for (let i = 0; i < reps; i++) { const s = performance.now(); fn(); t.push(performance.now() - s); } return { median: +med(t).toFixed(2), max: +Math.max(...t).toFixed(2) }; }

describe('P3-4 fanout scaling', () => {
  it('validate / compile / simulate at 100..8000 sinks', () => {
    const rows: Record<string, unknown>[] = []; let prev: number | null = null;
    for (const n of [100, 500, 1000, 2000, 4000, 8000]) {
      const { c, src } = fanout(n);
      const reps = n >= 4000 ? 3 : 5;
      const v = time(() => { validateCircuit(c); }, reps), p = time(() => { compileCircuit(c); }, reps);
      const plan = compileCircuit(c), s = time(() => { simulate(plan, { [src]: '1' }); }, reps);
      rows.push({ sinks: n, validateMs: v.median, compileMs: p.median, simulateMs: s.median, validateGrowthVsPrev: prev ? +(v.median / prev).toFixed(2) : null });
      prev = v.median;
    }
    summary['fanout'] = rows;
  }, 600000);
});

describe('core scaling for gates (chain / fanout of gates)', () => {
  it('chain of NOT gates 100..5000', () => {
    const rows: Record<string, unknown>[] = [];
    for (const n of [100, 500, 1000, 2000, 5000]) {
      const { c, src } = chain(n);
      const compile = time(() => { compileCircuit(c); }, 5), plan = compileCircuit(c);
      const sim = time(() => { simulate(plan, { [src]: '1' }); }, 20);
      rows.push({ gates: n, compileMs: compile.median, compileMax: compile.max, simulateMs: sim.median, simulateMax: sim.max });
    }
    summary['chain'] = rows;
  }, 600000);
});

void id;
afterAll(() => record('perf-core-outcomes', summary));
