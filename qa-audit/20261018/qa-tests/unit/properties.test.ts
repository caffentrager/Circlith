import { afterAll, describe, expect, it } from 'vitest';
import { Editor } from '../src/editor/editor';
import { addComponent, clone, emptyCircuit, gateInputCount, isBinaryGate, type Circuit, type Kind, type Point } from '../src/model/circuit';
import { updateComponentProperties, type ComponentProperties } from '../src/model/component-properties';
import { assertCircuit, connectTargets, validateCircuit } from '../src/model/connections';
import { endpointPosition, pinPosition } from '../src/geometry/geometry';
import { collidingSegments, componentObstacles, defaultRouting, planRoute } from '../src/geometry/routing';
import { compileCircuit, simulate } from '../src/simulation/simulator';
import { record, rng } from './helpers';

const summary: Record<string, unknown> = {};
const GATES = ['AND', 'OR', 'XOR', 'NAND', 'NOR', 'XNOR'] as const;
const COUNTS = [2, 3, 4, 8, 15, 16];
const props = (c: Circuit, key: string, over: Partial<ComponentProperties> = {}): ComponentProperties => {
  const comp = c.components[key];
  return { name: comp.name, inputCount: gateInputCount(comp),
    invertedInputs: comp.pins.filter(p => c.pins[p].direction === 'in').map(p => !!c.pins[p].inverted), ...over };
};
/** App-equivalent wiring: planRoute + connectTargets, exactly as Editor.confirm does. */
function link(c: Circuit, a: string, b: string, anchors: Point[] = []): Circuit {
  const from = { type: 'pin' as const, id: a }, to = { type: 'pin' as const, id: b };
  const plan = planRoute(c, pinPosition(c, a), pinPosition(c, b), defaultRouting, { from, to, anchors });
  const next = connectTargets(c, from, to, plan.points, anchors);
  if (!next) throw new Error('connectTargets returned null');
  return next;
}
const orthogonalNoSpur = (points: Point[]) => {
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    if (!(a.x === b.x || a.y === b.y) || (a.x === b.x && a.y === b.y)) return 'non-orthogonal/zero-length';
    if (i >= 2) {
      const p = points[i - 2];
      if ((p.x === a.x && a.x === b.x && (a.y - p.y) * (b.y - a.y) < 0) || (p.y === a.y && a.y === b.y && (a.x - p.x) * (b.x - a.x) < 0)) return 'retrace/U-turn overlap';
    }
  }
  return null;
};

describe('6.1 name validation', () => {
  const kinds: Kind[] = ['Input', 'Output', 'AND', 'OR', 'NOT', 'XOR', 'NAND', 'NOR', 'XNOR'];
  const mk = (kind: Kind) => { const c = emptyCircuit(); const k = addComponent(c, kind, { x: 200, y: 200 }); return { c, k }; };
  const cases: [string, string, string | null][] = [
    ['plain', 'Alpha', 'Alpha'], ['trim', '  x  ', 'x'], ['80 chars', 'a'.repeat(80), 'a'.repeat(80)],
    ['81 chars', 'a'.repeat(81), null], ['empty', '', null], ['spaces only', '   ', null], ['newline only', '\n\n', null],
    ['hangul', '출력 신호', '출력 신호'], ['emoji', '\u{1F642}A', '\u{1F642}A'], ['embedded newline', 'a\nb', 'a\nb'],
    ['html', '<img src=x onerror=alert(1)>', '<img src=x onerror=alert(1)>'], ['quotes', `"';--</title>`, `"';--</title>`],
    ['40 emoji (80 UTF-16 units)', '\u{1F642}'.repeat(40), '\u{1F642}'.repeat(40)], ['41 emoji (82 units, 41 chars)', '\u{1F642}'.repeat(41), null],
    ['trim brings 84 -> 80', '  ' + 'b'.repeat(80) + '  ', 'b'.repeat(80)],
  ];
  for (const kind of kinds) for (const [label, input, expected] of cases) it(`${kind}: ${label}`, () => {
    const { c, k } = mk(kind), before = clone(c);
    const count = gateInputCount(c.components[k]);
    if (expected === null) { expect(() => updateComponentProperties(c, k, props(c, k, { name: input, inputCount: count }))).toThrow(); expect(c).toEqual(before); }
    else { const n = updateComponentProperties(c, k, props(c, k, { name: input, inputCount: count })); expect(n.components[k].name).toBe(expected); assertCircuit(n); }
  });
  it('records the UTF-16 length semantics for supplementary characters', () => {
    summary['name length unit'] = 'UTF-16 code units (41 emoji rejected although 41 characters)';
  });
});

describe('6.2/6.3 input count transitions keep pin identity and reject connected removal', () => {
  for (const kind of GATES) it(`${kind}: all count transitions (unconnected)`, () => {
    let transitions = 0;
    for (const from of COUNTS) for (const to of COUNTS) {
      const c = emptyCircuit(), k = addComponent(c, kind, { x: 300, y: 300 });
      const base = from === 2 ? c : updateComponentProperties(c, k, props(c, k, { inputCount: from }));
      const before = clone(base), original = base.components[k].pins;
      const next = updateComponentProperties(base, k, props(base, k, { inputCount: to, invertedInputs: Array.from({ length: to }, (_, i) => i % 3 === 0) }));
      expect(base).toEqual(before); // input circuit never mutated
      const pins = next.components[k].pins;
      expect(pins.length).toBe(to + 1);
      expect(pins.at(-1)).toBe(original.at(-1)); // output id retained
      expect(pins.slice(0, Math.min(from, to))).toEqual(original.slice(0, Math.min(from, to))); // retained input ids
      pins.forEach((p, i) => { expect(next.pins[p].index).toBe(i); expect(next.pins[p].direction).toBe(i === to ? 'out' : 'in'); });
      expect(new Set(pins).size).toBe(pins.length);
      if (to > from) for (const p of pins.slice(from, to)) expect(original.includes(p)).toBe(false);
      for (const p of original) if (!pins.includes(p)) expect(next.pins[p]).toBeUndefined(); // no orphan pin records
      expect(Object.keys(next.pins).length).toBe(to + 1);
      expect(validateCircuit(next)).toEqual([]);
      expect(compileCircuit(next).errors).toEqual([]);
      transitions++;
    }
    summary[`transitions ${kind}`] = transitions;
  });
  it('other components, their pins and nets are untouched by resizing a neighbour', () => {
    let c = emptyCircuit();
    const a = addComponent(c, 'AND', { x: 300, y: 100 }), b = addComponent(c, 'OR', { x: 300, y: 500 }), o = addComponent(c, 'Output', { x: 700, y: 500 });
    c = link(c, c.components[b].pins.at(-1)!, c.components[o].pins[0]);
    const snapshot = clone(c);
    const next = updateComponentProperties(c, a, props(c, a, { inputCount: 9 }));
    for (const key of [b, o]) {
      expect(next.components[key]).toEqual(snapshot.components[key]);
      for (const p of snapshot.components[key].pins) expect(next.pins[p]).toEqual(snapshot.pins[p]);
      expect(next.geometry.components[key]).toEqual(snapshot.geometry.components[key]);
    }
    expect(next.nets).toEqual(snapshot.nets); expect(next.geometry.wires).toEqual(snapshot.geometry.wires);
  });
  it('connected-input removal matrix: rejected atomically; unconnected tail removal allowed', () => {
    const rows: unknown[] = [];
    for (const connected of [[2], [3], [2, 3], [0, 1], [0, 3], [1], []]) for (const target of [2, 3, 4]) {
      let c = emptyCircuit();
      const k = addComponent(c, 'AND', { x: 400, y: 300 });
      c = updateComponentProperties(c, k, props(c, k, { inputCount: 4, invertedInputs: [false, true, false, true] }));
      const ins = connected.map(() => addComponent(c, 'Input', { x: 100, y: 100 + 80 * rows.length }));
      connected.forEach((pinIndex, i) => { c = link(c, c.components[ins[i]].pins[0], c.components[k].pins[pinIndex]); });
      const before = clone(c);
      const mustReject = connected.some(i => i >= target);
      let rejected = false;
      try { const n = updateComponentProperties(c, k, props(c, k, { inputCount: target, invertedInputs: [] })); assertCircuit(n); }
      catch { rejected = true; }
      expect(c).toEqual(before);
      rows.push({ connected, target, rejected, mustReject });
      expect(rejected).toBe(mustReject);
    }
    summary['connected removal matrix'] = rows.length;
  });
  it('branch (junction) net containing a removed pin is rejected', () => {
    let c = emptyCircuit();
    const k = addComponent(c, 'AND', { x: 500, y: 300 }), i = addComponent(c, 'Input', { x: 100, y: 100 }), j = addComponent(c, 'Output', { x: 700, y: 500 });
    c = updateComponentProperties(c, k, props(c, k, { inputCount: 4 }));
    c = link(c, c.components[i].pins[0], c.components[k].pins[3]);
    c = link(c, c.components[i].pins[0], c.components[j].pins[0]);
    expect(() => updateComponentProperties(c, k, props(c, k, { inputCount: 3 }))).toThrow();
  });
  it('inverted flag does not survive on removed pins and is cleared when false; NOT/Input/Output inversion rules', () => {
    const c = emptyCircuit();
    const k = addComponent(c, 'NOR', { x: 300, y: 300 });
    const a = updateComponentProperties(c, k, props(c, k, { inputCount: 5, invertedInputs: [true, true, true, true, true] }));
    expect(a.components[k].pins.slice(0, 5).every(p => a.pins[p].inverted === true)).toBe(true);
    const b = updateComponentProperties(a, k, props(a, k, { inputCount: 3, invertedInputs: [false, true, false] }));
    expect(b.components[k].pins.slice(0, 3).map(p => b.pins[p].inverted)).toEqual([undefined, true, undefined]);
    expect(b.pins[b.components[k].pins.at(-1)!].inverted).toBeUndefined();
    const i = addComponent(b, 'Input', { x: 50, y: 50 });
    const bi = updateComponentProperties(b, i, { name: 'in', inputCount: 1, invertedInputs: [true, true] });
    expect(bi.pins[bi.components[i].pins[0]].inverted).toBeUndefined();
    assertCircuit(bi);
  });
  it('runtime-invalid arguments are rejected (counts, wrong kind)', () => {
    const c = emptyCircuit(), k = addComponent(c, 'AND', { x: 300, y: 300 }), n = addComponent(c, 'NOT', { x: 500, y: 300 });
    for (const count of [0, 1, 2.5, 17, Number.NaN, Infinity, -1]) expect(() => updateComponentProperties(c, k, props(c, k, { inputCount: count }))).toThrow();
    for (const count of [2, 0, 16]) expect(() => updateComponentProperties(c, n, props(c, n, { inputCount: count }))).toThrow();
    expect(() => updateComponentProperties(c, 'missing', { name: 'a', inputCount: 2, invertedInputs: [] })).toThrow();
  });
});

describe('6.4 atomic transaction via Editor', () => {
  it('name + count + inversion + wire geometry change = exactly 1 history entry; Undo/Redo exact; invalid/noop apply leaves history untouched', () => {
    let c = emptyCircuit();
    const k = addComponent(c, 'XOR', { x: 400, y: 300 }), i = addComponent(c, 'Input', { x: 100, y: 100 });
    c = link(c, c.components[i].pins[0], c.components[k].pins[1]);
    const e = new Editor(); e.circuit = c;
    const s0 = clone(e.circuit);
    e.updateProperties(k, props(e.circuit, k)); expect(e.history).toHaveLength(0); // unchanged -> no entry
    expect(() => e.updateProperties(k, props(e.circuit, k, { inputCount: 99 }))).toThrow(); expect(e.history).toHaveLength(0);
    expect(() => e.updateProperties(k, props(e.circuit, k, { name: '' }))).toThrow(); expect(e.history).toHaveLength(0);
    expect(e.circuit).toEqual(s0);
    e.updateProperties(k, { name: 'Renamed', inputCount: 7, invertedInputs: [true, false, true, false, true, false, true] });
    expect(e.history).toHaveLength(1);
    const s1 = clone(e.circuit);
    e.undo(); expect(e.circuit).toEqual(s0); expect(e.history).toHaveLength(0); expect(e.future).toHaveLength(1);
    e.redo(); expect(e.circuit).toEqual(s1);
    // a change after Undo clears redo
    e.undo(); e.updateProperties(k, props(e.circuit, k, { name: 'Other' })); expect(e.future).toHaveLength(0);
    // refused while a draft exists
    e.place('AND', { x: 0, y: 0 }); expect(() => e.updateProperties(k, props(e.circuit, k, { name: 'zz' }))).toThrow(); e.cancel();
  });
  it('selection is pruned/kept consistently after properties undo', () => {
    const c = emptyCircuit(); const k = addComponent(c, 'AND', { x: 400, y: 300 });
    const e = new Editor(); e.circuit = c; e.selection = [k];
    e.updateProperties(k, props(e.circuit, k, { inputCount: 5 })); e.undo();
    expect(e.selection).toEqual([k]);
  });
});

describe('9 wire reconstruction on input-count change', () => {
  const rotations = [0, 90, 180, 270];
  const sources: Point[] = [{ x: 100, y: 300 }, { x: 150, y: 80 }, { x: 150, y: 560 }, { x: 700, y: 300 }, { x: 650, y: 80 }, { x: 400, y: 80 }, { x: 400, y: 560 }];
  it('every connected pin keeps its endpoint, wire/net ids and gets a valid orthogonal path (rotations x source positions x counts)', () => {
    const rows: Record<string, number> = { total: 0, threw: 0, spur: 0, nonOrth: 0, endpointMoved: 0, idChanged: 0, collideSelf: 0, collideOthers: 0 };
    const throws: Record<string, number> = {};
    for (const rotation of rotations) for (const src of sources) for (const [from, to] of [[2, 4], [4, 8], [8, 16], [16, 3], [3, 2], [2, 16], [16, 2], [5, 6], [6, 5]]) {
      let c = emptyCircuit();
      const k = addComponent(c, 'AND', { x: 400, y: 300 }, rotation), source = addComponent(c, 'Input', src), sink = addComponent(c, 'Output', { x: 800, y: 560 });
      c = updateComponentProperties(c, k, props(c, k, { inputCount: from }));
      const used = [0, from - 1].filter((v, i, a) => a.indexOf(v) === i);
      const sources2 = [source];
      for (const _ of used.slice(1)) sources2.push(addComponent(c, 'Input', { x: src.x + 40, y: src.y + 120 }));
      try {
        used.forEach((pinIndex, i) => { c = link(c, c.components[sources2[i]].pins[0], c.components[k].pins[pinIndex]); });
        c = link(c, c.components[k].pins.at(-1)!, c.components[sink].pins[0]);
      } catch { continue; }
      if (validateCircuit(c).length) continue;
      rows.total++;
      const wiresBefore = clone(c.geometry.wires);
      let next: Circuit;
      try {
        // keep connected pins: new count must still cover the highest connected index
        if (to <= Math.max(...used)) { rows.total--; continue; }
        next = updateComponentProperties(c, k, props(c, k, { inputCount: to }));
      } catch (e) { rows.threw++; throws[(e as Error).message] = (throws[(e as Error).message] ?? 0) + 1; continue; }
      for (const w of Object.values(next.geometry.wires)) {
        const old = wiresBefore[w.id];
        if (!old || old.net !== w.net || JSON.stringify(old.from) !== JSON.stringify(w.from) || JSON.stringify(old.to) !== JSON.stringify(w.to)) rows.idChanged++;
        const bad = orthogonalNoSpur(w.points);
        if (bad === 'non-orthogonal/zero-length') rows.nonOrth++;
        if (bad === 'retrace/U-turn overlap') rows.spur++;
        if (JSON.stringify(w.points[0]) !== JSON.stringify(endpointPosition(next, w.from)) || JSON.stringify(w.points.at(-1)) !== JSON.stringify(endpointPosition(next, w.to))) rows.endpointMoved++;
        // collisions: a wire attached to the resized gate vs. the new body
        if (w.from.type === 'pin' && w.to.type === 'pin') {
          const attached = [w.from, w.to].some(e => next.pins[(e as { id: string }).id].component === k);
          const hit = collidingSegments(next, w.points, 0);
          const own = componentObstacles(next, 0)[Object.keys(next.geometry.components).indexOf(k)];
          // collisions on parts other than the immediate pin lead count as body intrusions
          if (hit.length) { if (attached) rows.collideSelf++; else rows.collideOthers++; }
          void own;
        }
      }
    }
    summary['wire reconstruction'] = { rows, throws };
    expect(rows.nonOrth).toBe(0); expect(rows.endpointMoved).toBe(0); expect(rows.idChanged).toBe(0);
    expect(rows.threw).toBe(0);
    expect(rows.spur).toBe(0);
    expect(rows.collideSelf).toBe(0);
  });

  it('fixed waypoint preservation: waypoint on first segment, at corner, near pin, U-turn, Z-shape', () => {
    const rows: Record<string, unknown> = {};
    const shapes: Record<string, (src: Point) => Point[]> = {
      'corner (x mid, y of src)': s => [{ x: 250, y: s.y }],
      'z-shape two waypoints': s => [{ x: 220, y: s.y }, { x: 220, y: 300 }],
      'near-pin (-60 from gate)': () => [{ x: 340, y: 300 }],
      'u-turn waypoint beyond gate': s => [{ x: 160, y: s.y }, { x: 160, y: 40 }, { x: 330, y: 40 }],
      'obstacle-adjacent waypoint': s => [{ x: 330, y: s.y }],
    };
    for (const [name, make] of Object.entries(shapes)) for (const [from, to] of [[2, 4], [2, 16], [8, 3], [16, 2]]) for (const pinIndex of [0, 1]) {
      const src = { x: 100, y: 160 };
      let c = emptyCircuit();
      const k = addComponent(c, 'AND', { x: 400, y: 300 }), s = addComponent(c, 'Input', src);
      c = updateComponentProperties(c, k, props(c, k, { inputCount: from }));
      let ok = true;
      try { c = link(c, c.components[s].pins[0], c.components[k].pins[pinIndex], make(src)); } catch { ok = false; }
      if (!ok || validateCircuit(c).length) { rows[`${name} ${from}->${to} pin${pinIndex}`] = 'setup-invalid'; continue; }
      const wire = Object.values(c.geometry.wires)[0], anchors = clone(wire.anchors ?? []);
      let verdict: string;
      try {
        const next = updateComponentProperties(c, k, props(c, k, { inputCount: to }));
        const after = next.geometry.wires[wire.id];
        verdict = JSON.stringify(after.anchors) === JSON.stringify(anchors) ? 'anchors kept' : 'ANCHORS CHANGED';
        const onPath = anchors.every(a => after.points.some((p, i) => i && pointOn(after.points[i - 1], p, a)));
        if (!onPath) verdict += ' + ANCHOR OFF PATH';
        const bad = orthogonalNoSpur(after.points); if (bad) verdict += ' + ' + bad;
      } catch (e) { verdict = 'REJECTED: ' + (e as Error).message; }
      rows[`${name} ${from}->${to} pin${pinIndex}`] = verdict;
    }
    summary['waypoint preservation'] = rows;
    const bad = Object.entries(rows).filter(([, v]) => typeof v === 'string' && /CHANGED|OFF PATH|REJECTED|retrace/.test(v as string));
    summary['waypoint problems'] = bad;
    expect(bad).toEqual([]);
  });

  it('same-gate output -> own input feedback survives resizing (both endpoints move)', () => {
    const rows: unknown[] = [];
    for (const rotation of rotations) for (const [from, to] of [[2, 4], [4, 16], [16, 3], [3, 2]]) for (const pinIndex of [0, from - 1]) {
      let c = emptyCircuit();
      const k = addComponent(c, 'NOR', { x: 400, y: 300 }, rotation);
      c = updateComponentProperties(c, k, props(c, k, { inputCount: from }));
      try { c = link(c, c.components[k].pins.at(-1)!, c.components[k].pins[pinIndex]); } catch (e) { rows.push({ rotation, from, to, pinIndex, setup: (e as Error).message }); continue; }
      if (validateCircuit(c).length) { rows.push({ rotation, from, to, pinIndex, setup: 'invalid' }); continue; }
      try {
        if (to <= pinIndex) continue;
        const next = updateComponentProperties(c, k, props(c, k, { inputCount: to }));
        const w = Object.values(next.geometry.wires)[0];
        const bad = orthogonalNoSpur(w.points);
        const r = simulate(compileCircuit(next));
        rows.push({ rotation, from, to, pinIndex, bad, feedback: r.diagnostics.some(d => d.code === 'COMBINATIONAL_FEEDBACK'), errors: validateCircuit(next) });
      } catch (e) { rows.push({ rotation, from, to, pinIndex, threw: (e as Error).message }); }
    }
    summary['self feedback'] = rows;
    const bad = rows.filter((r: any) => r.threw || r.bad || r.setup || r.errors?.length || r.feedback === false);
    summary['self feedback problems'] = bad;
    expect(bad).toEqual([]);
  });

  it('enlarging the body: foreign wires crossing the new body are detected (informational)', () => {
    let c = emptyCircuit();
    const k = addComponent(c, 'AND', { x: 400, y: 300 }), a = addComponent(c, 'Input', { x: 400, y: 100 }), b = addComponent(c, 'Output', { x: 400, y: 500 });
    c = link(c, c.components[a].pins[0], c.components[b].pins[0]); // vertical-ish route passing near the AND body
    const crossingBefore = collidingSegments(c, Object.values(c.geometry.wires)[0].points, 0).length;
    const next = updateComponentProperties(c, k, props(c, k, { inputCount: 16 }));
    const after = collidingSegments(next, Object.values(next.geometry.wires)[0].points, 0).length;
    summary['foreign wire vs enlarged body'] = { crossingBefore, crossingAfter: after, validatorErrors: validateCircuit(next) };
    // A property change must either re-route or reject; silently committing a wire through the new body is a finding.
    expect(after).toBe(0);
  });
});

const pointOn = (a: Point, b: Point, p: Point) => (a.x === b.x ? p.x === a.x && p.y >= Math.min(a.y, b.y) && p.y <= Math.max(a.y, b.y) : p.y === a.y && p.x >= Math.min(a.x, b.x) && p.x <= Math.max(a.x, b.x));
void isBinaryGate; void rng;

afterAll(() => record('properties-outcomes', summary));
