import { afterAll, describe, expect, it } from 'vitest';
import { addComponent, clone, connect, electricalGraph, emptyCircuit, type Circuit, type Point } from '../src/model/circuit';
import { validateCircuit } from '../src/model/connections';
import { defaultWireDisplay, wireBridges, type WireDisplaySettings } from '../src/geometry/wire-bridges';
import { compileCircuit, simulate } from '../src/simulation/simulator';
import { record, rng } from './helpers';

const summary: Record<string, unknown> = {};
const H = defaultWireDisplay, Vt: WireDisplaySettings = { ...defaultWireDisplay, axis: 'vertical' };

/** Two independent straight wires: horizontal at y, vertical at x, using real components so the circuit validates. */
function cross(hx = 250, hy = 200, extra?: (c: Circuit) => void) {
  const c = emptyCircuit();
  const i1 = addComponent(c, 'Input', { x: 100, y: hy }), o1 = addComponent(c, 'Output', { x: 400, y: hy });
  const i2 = addComponent(c, 'Input', { x: hx, y: 100 }, 90), o2 = addComponent(c, 'Output', { x: hx, y: 300 }, 90);
  const pin = (k: string, n: number) => c.components[k].pins[n];
  const pos = (k: string, n: number) => { const p = c.geometry.components[k]; return p; };
  void pos;
  connect(c, { type: 'pin', id: pin(i1, 0) }, { type: 'pin', id: pin(o1, 0) }, [{ x: 140, y: hy }, { x: 360, y: hy }]);
  connect(c, { type: 'pin', id: pin(i2, 0) }, { type: 'pin', id: pin(o2, 0) }, [{ x: hx, y: 140 }, { x: hx, y: 260 }]);
  extra?.(c);
  return { c, i1, o1, i2, o2 };
}

describe('10.1/10.2 basic crossings', () => {
  it('H x V of different nets -> exactly one bridge on the chosen axis, none when disabled', () => {
    const { c } = cross(250, 200);
    expect(validateCircuit(c)).toEqual([]);
    const h = wireBridges(c, H, 1), v = wireBridges(c, Vt, 1);
    expect(h).toHaveLength(1); expect(v).toHaveLength(1);
    const wires = Object.values(c.geometry.wires);
    expect(h[0].wire).toBe(wires.find(w => w.points[0].y === w.points[1].y)!.id);
    expect(v[0].wire).toBe(wires.find(w => w.points[0].x === w.points[1].x)!.id);
    expect(h[0].point).toEqual({ x: 250, y: 200 });
    expect(wireBridges(c, { ...H, enabled: false }, 1)).toEqual([]);
    for (const z of [Number.NaN, 0, -1, Infinity]) expect(wireBridges(c, H, z)).toEqual(z === Infinity ? wireBridges(c, H, z) : []);
  });
  it('is a pure derivation: circuit, electrical graph and simulation are unchanged', () => {
    const { c, i1, o1 } = cross(250, 200);
    const before = JSON.stringify(c), graph = electricalGraph(c);
    const r0 = simulate(compileCircuit(c), { [i1]: '1' });
    for (const s of [H, Vt, { ...H, enabled: false }]) for (const z of [0.1, 0.5, 1, 2]) wireBridges(c, s, z);
    expect(JSON.stringify(c)).toBe(before); expect(electricalGraph(c)).toBe(graph);
    expect(simulate(compileCircuit(c), { [i1]: '1' })).toEqual(r0);
    expect(r0.outputs[o1]).toBe('1');
  });
  it('explicit junction at the crossing suppresses the bridge; a nearby foreign junction also does (documented policy)', () => {
    const { c } = cross(250, 200);
    for (const [dx, dy, expectBridge] of [[0, 0, false], [5, 0, false], [9, 0, false], [11, 0, true], [0, 12, true], [3, 3, false]] as const) {
      const d = clone(c); d.geometry.junctions.j = { x: 250 + dx, y: 200 + dy };
      expect(wireBridges(d, H, 1).length > 0).toBe(expectBridge);
    }
  });
});

describe('10.3 complex crossings', () => {
  const long = (c: Circuit, y: number, x1 = 140, x2 = 800) => {
    const i = addComponent(c, 'Input', { x: x1 - 40, y }), o = addComponent(c, 'Output', { x: x2 + 40, y });
    connect(c, { type: 'pin', id: c.components[i].pins[0] }, { type: 'pin', id: c.components[o].pins[0] }, [{ x: x1, y }, { x: x2, y }]);
  };
  const vert = (c: Circuit, x: number, y1 = 100, y2 = 500) => {
    const i = addComponent(c, 'Input', { x, y: y1 - 40 }, 90), o = addComponent(c, 'Output', { x, y: y2 + 40 }, 90);
    connect(c, { type: 'pin', id: c.components[i].pins[0] }, { type: 'pin', id: c.components[o].pins[0] }, [{ x, y: y1 }, { x, y: y2 }]);
  };
  it('3 crossings on one wire, spaced 50: 3 bridges with radius 5 and non-overlapping arcs', () => {
    const c = emptyCircuit(); long(c, 300); for (const x of [300, 350, 400]) vert(c, x);
    const b = wireBridges(c, H, 1); expect(b).toHaveLength(3);
    for (const x of b) expect(x.radius).toBe(5);
  });
  it('very close crossings (spacing 6) shrink the radius instead of overlapping; below the minimum they are dropped', () => {
    for (const [gap, expectCount] of [[6, 2], [5, 0], [30, 2]] as const) {
      const c = emptyCircuit(); long(c, 300); vert(c, 400); vert(c, 400 + gap);
      const b = wireBridges(c, H, 1).sort((p, q) => p.point.x - q.point.x);
      expect(b.length).toBe(expectCount);
      for (let i = 1; i < b.length; i++) expect(b[i].point.x - b[i].radius).toBeGreaterThanOrEqual(b[i - 1].point.x + b[i - 1].radius);
      summary[`close crossings gap=${gap}`] = b.map(x => x.radius);
    }
  });
  it('crossing near an endpoint / corner is omitted when there is no room; T-contact and collinear overlap never bridge', () => {
    const c = emptyCircuit(); long(c, 300, 140, 800); vert(c, 150, 100, 500); // crossing 10 from the horizontal wire start
    const near = wireBridges(c, H, 1); summary['crossing 10 from endpoint'] = near.map(x => x.radius);
    for (const b of near) expect(b.radius).toBeLessThanOrEqual(10 / 3 + 1e-9);
    const t = emptyCircuit(); long(t, 300); vert(t, 500, 300, 500); // vertical wire starts exactly on the horizontal wire: T contact
    expect(wireBridges(t, H, 1)).toEqual([]);
    const o = emptyCircuit(); long(o, 300); long(o, 300, 300, 600); // collinear overlapping wires
    expect(wireBridges(o, H, 1)).toEqual([]);
  });
  it('several wires through the same crossing point yield one bridge per crossed segment, not per pair', () => {
    const c = emptyCircuit(); long(c, 300); vert(c, 400); vert(c, 400, 120, 480); // two coincident verticals
    const b = wireBridges(c, H, 1);
    summary['2 coincident verticals x 1 horizontal (horizontal axis)'] = b.length;
    expect(b.length).toBe(1);
    const v = wireBridges(c, Vt, 1);
    summary['2 coincident verticals x 1 horizontal (vertical axis)'] = v.length;
  });
  it('zoom keeps bridges drawable: radius in [2/zoom, 5/zoom] for 10%..200%', () => {
    const { c } = cross(250, 200);
    for (const z of [0.1, 0.25, 0.5, 1, 1.5, 2]) for (const b of wireBridges(c, H, z)) {
      expect(b.radius).toBeLessThanOrEqual(5 / z + 1e-9); expect(b.radius).toBeGreaterThanOrEqual(2 / z - 1e-9);
    }
  });
});

describe('10 randomized invariants', () => {
  it('300 random orthogonal wire fields: arcs stay inside their own segment, never overlap, never create connectivity', () => {
    let fields = 0, bridgesTotal = 0, violations = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const rand = rng(seed * 977);
      const c = emptyCircuit();
      const n = 4 + Math.floor(rand() * 18);
      for (let i = 0; i < n; i++) {
        const horizontal = rand() < 0.5, a = 100 + Math.floor(rand() * 60) * 10, b = a + 60 + Math.floor(rand() * 40) * 10, t = 100 + Math.floor(rand() * 60) * 10;
        const p1: Point = horizontal ? { x: a, y: t } : { x: t, y: a }, p2: Point = horizontal ? { x: b, y: t } : { x: t, y: b };
        const src = addComponent(c, 'Input', { x: p1.x - (horizontal ? 40 : 0), y: p1.y - (horizontal ? 0 : 40) }, horizontal ? 0 : 90);
        const dst = addComponent(c, 'Output', { x: p2.x + (horizontal ? 40 : 0), y: p2.y + (horizontal ? 0 : 40) }, horizontal ? 0 : 90);
        connect(c, { type: 'pin', id: c.components[src].pins[0] }, { type: 'pin', id: c.components[dst].pins[0] }, [p1, p2]);
      }
      fields++;
      const before = JSON.stringify(c);
      for (const settings of [H, Vt]) for (const zoom of [0.25, 1, 2]) {
        const list = wireBridges(c, settings, zoom); bridgesTotal += list.length;
        const byWire = new Map<string, typeof list>();
        for (const b of list) byWire.set(b.wire, [...(byWire.get(b.wire) ?? []), b]);
        for (const [wireId, group] of byWire) {
          const pts = c.geometry.wires[wireId].points, hz = pts[0].y === pts[1].y;
          const lo = hz ? Math.min(pts[0].x, pts[1].x) : Math.min(pts[0].y, pts[1].y), hi = hz ? Math.max(pts[0].x, pts[1].x) : Math.max(pts[0].y, pts[1].y);
          const sorted = group.map(b => hz ? b.point.x : b.point.y).sort((p, q) => p - q);
          const radii = group.sort((p, q) => (hz ? p.point.x - q.point.x : p.point.y - q.point.y)).map(b => b.radius);
          sorted.forEach((pos, i) => {
            if (pos - radii[i] < lo || pos + radii[i] > hi) violations++;
            if (i && pos - radii[i] < sorted[i - 1] + radii[i - 1] - 1e-9) violations++;
          });
        }
      }
      if (JSON.stringify(c) !== before) violations++;
      if (validateCircuit(c).length) violations++;
    }
    summary['random bridge fields'] = { fields, bridgesTotal, violations };
    expect(violations).toBe(0);
  });
});

describe.skipIf(!!process.env.QA_SKIP_PERF)('10.6 performance of wireBridges (dense crossing grid)', () => {
  it('measures 100 / 500 / 1000 / 3000 wires (half H, half V, every pair crosses)', () => {
    const rows: unknown[] = [];
    for (const n of [100, 500, 1000, 3000]) {
      const c = emptyCircuit();
      const half = n / 2;
      // Build wire records directly (connect() is O(n) per call); validity is not needed for the geometry-only function.
      for (let i = 0; i < half; i++) {
        c.geometry.wires[`h${i}`] = { id: `h${i}`, net: `nh${i}`, from: { type: 'junction', id: 'x' }, to: { type: 'junction', id: 'y' }, points: [{ x: 0, y: 10 + i * 4 }, { x: 10000, y: 10 + i * 4 }] };
        c.geometry.wires[`v${i}`] = { id: `v${i}`, net: `nv${i}`, from: { type: 'junction', id: 'x' }, to: { type: 'junction', id: 'y' }, points: [{ x: 10 + i * 4, y: 0 }, { x: 10 + i * 4, y: 10000 }] };
      }
      const times: number[] = []; let count = 0;
      for (let rep = 0; rep < (n >= 1000 ? 3 : 5); rep++) { const t = performance.now(); count = wireBridges(c, H, 1).length; times.push(performance.now() - t); }
      times.sort((a, b) => a - b);
      rows.push({ wires: n, crossings: half * half, bridgesProduced: count, medianMs: +times[Math.floor(times.length / 2)].toFixed(2), maxMs: +times.at(-1)!.toFixed(2) });
    }
    summary['bridge perf dense grid'] = rows;
  }, 600000);
  it('sparse realistic layout (mostly non-crossing) with 1000 junctions', () => {
    const rows: unknown[] = [];
    for (const n of [100, 500, 1000, 3000]) {
      const c = emptyCircuit();
      const rand = rng(n);
      for (let i = 0; i < n; i++) {
        const hz = rand() < 0.5, a = Math.floor(rand() * 4000), t = Math.floor(rand() * 4000) * 1;
        c.geometry.wires[`w${i}`] = { id: `w${i}`, net: `n${i}`, from: { type: 'junction', id: 'x' }, to: { type: 'junction', id: 'y' },
          points: hz ? [{ x: a, y: t }, { x: a + 80, y: t }] : [{ x: t, y: a }, { x: t, y: a + 80 }] };
      }
      for (let j = 0; j < 1000; j++) c.geometry.junctions[`j${j}`] = { x: Math.floor(rand() * 4000), y: Math.floor(rand() * 4000) };
      const times: number[] = []; let count = 0;
      for (let rep = 0; rep < 7; rep++) { const t = performance.now(); count = wireBridges(c, H, 1).length; times.push(performance.now() - t); }
      times.sort((a, b) => a - b);
      rows.push({ wires: n, junctions: 1000, bridgesProduced: count, medianMs: +times[3].toFixed(2), maxMs: +times.at(-1)!.toFixed(2) });
    }
    summary['bridge perf sparse'] = rows;
  }, 600000);
});

afterAll(() => record('bridges-outcomes', summary));
