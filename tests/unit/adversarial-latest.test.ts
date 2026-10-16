// Independent adversarial tests for 51552a7. These deliberately avoid using the code under test as an
// oracle: pin positions, circuit validity, connectivity groups and body bounds are re-derived here.
import { describe, it, expect, vi, afterEach } from "vitest";
import { writeFileSync } from "node:fs";
import { Editor } from "../../src/editor/editor";
import {
  addComponent,
  clone,
  electricalGraph,
  emptyCircuit,
  type Circuit,
  type ConnectionTarget,
  type Endpoint,
  type Kind,
  type Point,
} from "../../src/model/circuit";
import { deleteObjects } from "../../src/model/deletion";
import { connectTargets, targetPosition, validateCircuit } from "../../src/model/connections";
import { pinPosition, route, transform } from "../../src/geometry/geometry";
import { removeWireCorner } from "../../src/geometry/wire-edit";
import { simplifyPath } from "../../src/geometry/path";
import { connectionHits } from "../../src/geometry/connection-hit";
import { defaultRouting, planRoute, type RoutingSettings } from "../../src/geometry/routing";

/* ------------------------------------------------------------------ independent oracles */
const n0 = (v: number) => (v === 0 ? 0 : v); // normalise -0
const localPin = (kind: Kind, index: number): Point =>
  kind === "AND" || kind === "OR"
    ? index === 2 ? { x: 40, y: 0 } : { x: -40, y: index === 0 ? -10 : 10 }
    : kind === "NOT" ? (index === 0 ? { x: -40, y: 0 } : { x: 40, y: 0 })
    : kind === "Input" ? { x: 40, y: 0 } : { x: -40, y: 0 };
// SVG rotate(θ) semantics (y axis down): x' = x cosθ - y sinθ, y' = x sinθ + y cosθ
const rot = (p: Point, deg: number): Point => {
  const t = (deg * Math.PI) / 180, c = Math.round(Math.cos(t)), s = Math.round(Math.sin(t));
  return { x: n0(p.x * c - p.y * s), y: n0(p.x * s + p.y * c) };
};
const normalOf = (kind: Kind, index: number, deg: number): Point => {
  const l = localPin(kind, index);
  return rot({ x: Math.sign(l.x), y: 0 }, deg);
};
function pinAt(c: Circuit, pin: string): Point {
  const p = c.pins[pin], comp = c.components[p.component], pl = c.geometry.components[comp.id];
  const r = rot(localPin(comp.kind, p.index), pl.rotation);
  return { x: n0(pl.position.x + r.x), y: n0(pl.position.y + r.y) };
}
const endAt = (c: Circuit, e: Endpoint) => (e.type === "pin" ? pinAt(c, e.id) : c.geometry.junctions[e.id]);
const eq = (a: Point, b: Point) => a.x === b.x && a.y === b.y;

/** Raw structural check that does NOT call validateCircuit/assertCircuit. */
function rawCheck(c: Circuit): string[] {
  const errs: string[] = [];
  const seen = new Set<string>();
  for (const k of [...Object.keys(c.components), ...Object.keys(c.pins), ...Object.keys(c.nets), ...Object.keys(c.junctions), ...Object.keys(c.geometry.wires)]) {
    if (seen.has(k)) errs.push(`duplicate id ${k}`);
    seen.add(k);
  }
  for (const [k, v] of Object.entries(c.components)) {
    if (v.id !== k) errs.push(`component key/id mismatch ${k}`);
    if (!c.geometry.components[k]) errs.push(`component ${k} has no placement`);
    const pl = c.geometry.components[k];
    if (pl && ![pl.position.x, pl.position.y, pl.rotation].every(Number.isFinite)) errs.push(`non-finite placement ${k}`);
    for (const p of v.pins) if (!c.pins[p] || c.pins[p].component !== k) errs.push(`component ${k} bad pin ${p}`);
  }
  for (const k of Object.keys(c.geometry.components)) if (!c.components[k]) errs.push(`orphan placement ${k}`);
  for (const [k, p] of Object.entries(c.pins)) if (!c.components[p.component]?.pins.includes(k)) errs.push(`orphan pin ${k}`);
  for (const k of Object.keys(c.geometry.junctions)) if (!c.junctions[k]) errs.push(`orphan junction geometry ${k}`);
  for (const k of Object.keys(c.junctions)) if (!c.geometry.junctions[k]) errs.push(`junction ${k} has no geometry`);
  const adj = new Map<string, string[]>();
  const tok = (e: Endpoint) => `${e.type}:${e.id}`;
  for (const [k, w] of Object.entries(c.geometry.wires)) {
    if (w.id !== k) errs.push(`wire key/id mismatch ${k}`);
    let ok = true;
    for (const e of [w.from, w.to]) {
      const exists = e.type === "pin" ? !!(c.pins[e.id] && c.components[c.pins[e.id].component]) : !!(c.junctions[e.id] && c.geometry.junctions[e.id]);
      if (!exists) { errs.push(`wire ${k} references missing ${tok(e)}`); ok = false; }
    }
    if (!c.nets[w.net]) errs.push(`wire ${k} references missing net ${w.net}`);
    if (!ok) continue;
    if (!w.points.length || !w.points.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))) errs.push(`wire ${k} non-finite`);
    else {
      if (!eq(w.points[0], endAt(c, w.from))) errs.push(`wire ${k} start != endpoint`);
      if (!eq(w.points[w.points.length - 1], endAt(c, w.to))) errs.push(`wire ${k} end != endpoint`);
      for (let i = 1; i < w.points.length; i++) {
        const a = w.points[i - 1], b = w.points[i];
        if (eq(a, b)) errs.push(`wire ${k} zero-length segment`);
        if (a.x !== b.x && a.y !== b.y) errs.push(`wire ${k} diagonal segment`);
      }
    }
    const a = tok(w.from), b = tok(w.to);
    adj.set(a, [...(adj.get(a) ?? []), b]);
    adj.set(b, [...(adj.get(b) ?? []), a]);
  }
  // connected components of the endpoint graph must be exactly the nets
  const comp = new Map<string, number>();
  let count = 0;
  for (const s of adj.keys()) {
    if (comp.has(s)) continue;
    const stack = [s];
    while (stack.length) { const x = stack.pop()!; if (comp.has(x)) continue; comp.set(x, count); stack.push(...(adj.get(x) ?? [])); }
    count++;
  }
  const netOfComp = new Map<number, Set<string>>();
  for (const w of Object.values(c.geometry.wires)) {
    const i = comp.get(tok(w.from));
    if (i === undefined) continue;
    netOfComp.set(i, (netOfComp.get(i) ?? new Set()).add(w.net));
  }
  for (const [i, nets] of netOfComp) if (nets.size !== 1) errs.push(`wire component ${i} spans nets ${[...nets]}`);
  for (const net of Object.values(c.nets)) {
    const members = [...net.pins.map((p) => `pin:${p}`), ...net.junctions.map((j) => `junction:${j}`)];
    if (!members.length) errs.push(`empty net ${net.id}`);
    const comps = new Set(members.map((m) => comp.get(m)));
    if (comps.size !== 1 || comps.has(undefined)) errs.push(`net ${net.id} members are not one wire-connected component`);
    else {
      const idx = [...comps][0]!;
      const expected = [...comp.entries()].filter(([, v]) => v === idx).map(([k]) => k).sort();
      if (JSON.stringify(expected) !== JSON.stringify([...members].sort())) errs.push(`net ${net.id} membership != wire graph`);
    }
    if (!Object.values(c.geometry.wires).some((w) => w.net === net.id)) errs.push(`orphan net ${net.id}`);
  }
  for (const j of Object.values(c.junctions)) {
    if (!adj.has(`junction:${j.id}`)) errs.push(`orphan junction ${j.id}`);
    if (!c.nets[j.net]?.junctions.includes(j.id)) errs.push(`junction ${j.id} not in its net`);
  }
  return errs;
}
/** Wire-id groups connected through endpoint identity (never coordinates), minus excluded wires. */
function wireGroups(c: Circuit, exclude: Iterable<string> = []): string {
  const ex = new Set(exclude);
  const wires = Object.values(c.geometry.wires).filter((w) => !ex.has(w.id));
  const parent = new Map<string, string>();
  const find = (x: string): string => { while ((parent.get(x) ?? x) !== x) x = parent.get(x)!; return x; };
  const tok = (e: Endpoint) => `${e.type}:${e.id}`;
  for (const w of wires) {
    const a = find(tok(w.from)), b = find(tok(w.to));
    parent.set(a, parent.get(a) ?? a);
    parent.set(b, parent.get(b) ?? b);
    parent.set(find(a), find(b));
  }
  const groups = new Map<string, string[]>();
  for (const w of wires) groups.set(find(tok(w.from)), [...(groups.get(find(tok(w.from))) ?? []), w.id]);
  return JSON.stringify([...groups.values()].map((g) => g.sort()).sort((x, y) => x[0].localeCompare(y[0])));
}
const netGroups = (c: Circuit) => {
  const groups = new Map<string, string[]>();
  for (const w of Object.values(c.geometry.wires)) groups.set(w.net, [...(groups.get(w.net) ?? []), w.id]);
  return JSON.stringify([...groups.values()].map((g) => g.sort()).sort((x, y) => x[0].localeCompare(y[0])));
};

/* ------------------------------------------------------------------ builders */
const pin = (c: Circuit, comp: string, i = 0): Endpoint => ({ type: "pin", id: c.components[comp].pins[i] });
function link(c: Circuit, a: ConnectionTarget, b: ConnectionTarget, horizontal = true): Circuit {
  const next = connectTargets(c, a, b, route(targetPosition(c, a), targetPosition(c, b), horizontal));
  if (!next) throw new Error("fixture link failed");
  return next;
}
const junctionAt = (c: Circuit, x: number, y: number) => {
  const hit = Object.entries(c.geometry.junctions).filter(([, p]) => p.x === x && p.y === y).map(([k]) => k);
  if (hit.length !== 1) throw new Error(`expected one junction at ${x},${y}, got ${hit.length}`);
  return hit[0];
};
function seedIds() {
  let n = 0;
  return vi.spyOn(globalThis.crypto, "randomUUID").mockImplementation(() => `id-${String(++n).padStart(4, "0")}` as `${string}-${string}-${string}-${string}-${string}`);
}
afterEach(() => vi.restoreAllMocks());

/** Everything deleteObjects must guarantee, checked independently. Returns the new circuit. */
function checkedDelete(c: Circuit, selection: string[]): Circuit {
  const before = clone(c), result = deleteObjects(c, selection);
  expect(c, "input circuit must not be mutated").toEqual(before);
  expect(rawCheck(result)).toEqual([]);
  const sel = new Set(selection);
  const removedWires = Object.keys(c.geometry.wires).filter((k) => sel.has(k));
  const removedComps = Object.keys(c.components).filter((k) => sel.has(k));
  // surviving wires keep ID, geometry, anchors and non-deleted endpoint identity
  expect(Object.keys(result.geometry.wires).sort()).toEqual(Object.keys(c.geometry.wires).filter((k) => !sel.has(k)).sort());
  const danglingFor = new Map<string, string>(); // deleted pin -> junction id
  for (const w of Object.values(result.geometry.wires)) {
    const old = c.geometry.wires[w.id];
    expect(w.points).toEqual(old.points);
    expect(w.anchors).toEqual(old.anchors);
    for (const side of ["from", "to"] as const) {
      const o = old[side], n = w[side];
      const deleted = o.type === "pin" && removedComps.includes(c.pins[o.id].component);
      if (!deleted) expect(n).toEqual(o);
      else {
        expect(n.type, "deleted pin end must become a junction").toBe("junction");
        expect(result.geometry.junctions[n.id]).toEqual(endAt(c, o)); // dangling end sits exactly where the pin was
        const prior = danglingFor.get(o.id);
        if (prior) expect(n.id, "wires that shared a deleted pin must share one dangling junction").toBe(prior);
        danglingFor.set(o.id, n.id);
      }
    }
  }
  expect(new Set(danglingFor.values()).size, "distinct deleted pins must never share a junction").toBe(danglingFor.size);
  for (const k of removedComps) {
    expect(result.components[k]).toBeUndefined();
    expect(result.geometry.components[k]).toBeUndefined();
    for (const p of c.components[k].pins) expect(result.pins[p]).toBeUndefined();
  }
  for (const k of Object.keys(c.components).filter((k) => !sel.has(k))) {
    expect(result.components[k]).toEqual(c.components[k]);
    expect(result.geometry.components[k]).toEqual(c.geometry.components[k]);
  }
  // connectivity is derived from endpoint identity and must match the nets after deletion
  expect(netGroups(result)).toBe(wireGroups(c, removedWires));
  return result;
}

/* ------------------------------------------------------------------ 5. Delete attacks */
describe("Delete: topology repartition", () => {
  it("A: deleting the Input keeps the wire, creates one dangling junction at the pin, exact Undo/Redo", () => {
    let c = emptyCircuit();
    const a = addComponent(c, "Input", { x: 100, y: 100 }), b = addComponent(c, "Output", { x: 400, y: 100 });
    c = link(c, pin(c, a), pin(c, b));
    const e = new Editor(); e.circuit = c;
    const snapshot = JSON.stringify(c);
    e.selection = [a];
    e.deleteSelection();
    expect(rawCheck(e.circuit)).toEqual([]);
    expect(Object.keys(e.circuit.junctions)).toHaveLength(1);
    expect(Object.keys(e.circuit.geometry.wires)).toEqual(Object.keys(c.geometry.wires));
    expect(e.circuit.components[b]).toBeDefined();
    const after = JSON.stringify(e.circuit);
    expect(e.selection).toEqual([]);
    e.undo();
    expect(JSON.stringify(e.circuit), "Undo must restore byte-identical state").toBe(snapshot);
    e.redo();
    expect(JSON.stringify(e.circuit)).toBe(after);
  });

  it("B: fan-out from one pin: all wires share ONE junction and keep IDs; works for 3-way fan-out", () => {
    let c = emptyCircuit();
    const a = addComponent(c, "Input", { x: 100, y: 200 });
    const outs = [100, 200, 300, 400].map((y) => addComponent(c, "Output", { x: 400, y }));
    for (const o of outs) c = link(c, pin(c, a), pin(c, o));
    expect(Object.keys(c.nets)).toHaveLength(1);
    const r = checkedDelete(c, [a]);
    expect(Object.keys(r.junctions)).toHaveLength(1);
    expect(Object.keys(r.nets)).toHaveLength(1);
    expect(Object.keys(r.geometry.wires)).toHaveLength(4);
  });

  /** A ── J1 ── J2 ── B with side branches X (at J1) and Y (at J2). */
  function bridgeScene() {
    let c = emptyCircuit();
    const a = addComponent(c, "Input", { x: 100, y: 200 }), b = addComponent(c, "Output", { x: 600, y: 200 });
    const x = addComponent(c, "Output", { x: 340, y: 100 }), y = addComponent(c, "Output", { x: 440, y: 100 });
    c = link(c, pin(c, a), pin(c, b));
    const w = Object.keys(c.geometry.wires)[0];
    c = link(c, { type: "wire", id: w, position: { x: 300, y: 200 } }, pin(c, x), false);
    const j1 = junctionAt(c, 300, 200);
    const t1 = Object.values(c.geometry.wires).find((q) => q.from.type === "junction" && q.from.id === j1 && q.to.type === "pin" && q.to.id === c.components[b].pins[0])!.id;
    c = link(c, { type: "wire", id: t1, position: { x: 400, y: 200 } }, pin(c, y), false);
    const j2 = junctionAt(c, 400, 200);
    const bridge = Object.values(c.geometry.wires).find((q) => q.from.type === "junction" && q.from.id === j1 && q.to.type === "junction" && q.to.id === j2)!.id;
    return { c, a, b, x, y, j1, j2, bridge };
  }
  it("C: deleting the bridge wire yields exactly two disjoint nets, each keeping its own pins", () => {
    const { c, a, b, x, y, bridge } = bridgeScene();
    expect(rawCheck(c)).toEqual([]);
    expect(Object.keys(c.nets)).toHaveLength(1);
    const r = checkedDelete(c, [bridge]);
    expect(Object.keys(r.nets)).toHaveLength(2);
    const pinsOf = (ks: string[]) => ks.map((k) => c.components[k].pins[0]).sort().join();
    expect(Object.values(r.nets).map((n) => n.pins.slice().sort().join()).sort()).toEqual([pinsOf([a, x]), pinsOf([b, y])].sort());
    const e = new Editor(); e.circuit = c; const before = JSON.stringify(c);
    e.selection = [bridge]; e.deleteSelection();
    e.undo();
    expect(JSON.stringify(e.circuit)).toBe(before);
    expect(Object.keys(e.circuit.nets)).toHaveLength(1);
  });

  it("D: [component, wire] and [wire, component] selection orders are equivalent (identical result with seeded IDs)", () => {
    const run = (order: "cw" | "wc") => {
      vi.restoreAllMocks(); seedIds();
      let c = emptyCircuit();
      const a = addComponent(c, "Input", { x: 100, y: 100 }), b = addComponent(c, "Output", { x: 400, y: 100 }), d = addComponent(c, "Output", { x: 400, y: 300 });
      c = link(c, pin(c, a), pin(c, b)); c = link(c, pin(c, a), pin(c, d));
      const w = Object.keys(c.geometry.wires)[0];
      const r = deleteObjects(c, order === "cw" ? [a, w] : [w, a]);
      expect(rawCheck(r)).toEqual([]);
      return JSON.stringify(r);
    };
    expect(run("cw")).toBe(run("wc"));
  });

  it("E (SPEC AMBIGUITY): deleting both parts of A──B without selecting the wire leaves a floating wire between two distinct dangling ends; result must still be valid with exact Undo", () => {
    let c = emptyCircuit();
    const a = addComponent(c, "Input", { x: 100, y: 100 }), b = addComponent(c, "Output", { x: 400, y: 100 });
    c = link(c, pin(c, a), pin(c, b));
    const r = checkedDelete(c, [a, b]);
    const w = Object.values(r.geometry.wires)[0];
    expect(w.from.type === "junction" && w.to.type === "junction" && w.from.id !== w.to.id).toBe(true);
    const e = new Editor(); e.circuit = c; const before = JSON.stringify(c);
    e.selection = [a, b]; e.deleteSelection(); e.undo();
    expect(JSON.stringify(e.circuit)).toBe(before);
  });

  describe("F: branch with partial selections", () => {
    const scene = () => {
      let c = emptyCircuit();
      const a = addComponent(c, "Input", { x: 100, y: 200 }), cc = addComponent(c, "Output", { x: 500, y: 200 }), b = addComponent(c, "Output", { x: 340, y: 100 });
      c = link(c, pin(c, a), pin(c, cc));
      const w = Object.keys(c.geometry.wires)[0];
      c = link(c, { type: "wire", id: w, position: { x: 300, y: 200 } }, pin(c, b), false);
      const wires = Object.values(c.geometry.wires);
      const aj = wires.find((q) => q.from.type === "pin" && q.from.id === c.components[a].pins[0])!.id;
      const bj = wires.find((q) => q.to.type === "pin" && q.to.id === c.components[b].pins[0])!.id;
      const jc = wires.find((q) => q.to.type === "pin" && q.to.id === c.components[cc].pins[0])!.id;
      return { c, a, b, cc, aj, bj, jc };
    };
    const cases: [string, (s: ReturnType<typeof scene>) => string[]][] = [
      ["A only", (s) => [s.a]],
      ["A + AJ wire", (s) => [s.a, s.aj]],
      ["A + B", (s) => [s.a, s.b]],
      ["B + BJ wire", (s) => [s.b, s.bj]],
      ["A + B + C (no wires)", (s) => [s.a, s.b, s.cc]],
      ["all wires, no components", (s) => [s.aj, s.bj, s.jc]],
      ["everything", (s) => [s.a, s.b, s.cc, s.aj, s.bj, s.jc]],
      ["C + AJ", (s) => [s.cc, s.aj]],
    ];
    for (const [name, pickSel] of cases)
      it(name, () => {
        const s = scene();
        expect(rawCheck(s.c)).toEqual([]);
        const r = checkedDelete(s.c, pickSel(s));
        for (const j of Object.keys(r.junctions))
          expect(Object.values(r.geometry.wires).some((w) => [w.from, w.to].some((e) => e.type === "junction" && e.id === j)), "orphan junction").toBe(true);
        const e = new Editor(); e.circuit = s.c; const before = JSON.stringify(s.c);
        e.selection = pickSel(s); e.deleteSelection();
        expect(rawCheck(e.circuit)).toEqual([]);
        expect(netGroups(e.circuit)).toBe(netGroups(r));
        e.undo(); expect(JSON.stringify(e.circuit)).toBe(before);
      });
  });

  it("G: Delete → Undo → new edit → Redo must NOT re-apply the old delete", () => {
    let c = emptyCircuit();
    const a = addComponent(c, "Input", { x: 100, y: 100 }), b = addComponent(c, "Output", { x: 400, y: 100 });
    c = link(c, pin(c, a), pin(c, b));
    const e = new Editor(); e.circuit = c;
    e.selection = [a]; e.deleteSelection();
    e.undo();
    expect(e.future).toHaveLength(1);
    e.place("AND", { x: 600, y: 600 }); e.confirm();
    expect(e.future, "a new committed edit must drop the stale Redo branch").toHaveLength(0);
    const state = JSON.stringify(e.circuit);
    e.redo();
    expect(JSON.stringify(e.circuit)).toBe(state);
    expect(e.circuit.components[a]).toBeDefined();
    expect(rawCheck(e.circuit)).toEqual([]);
  });

  it("deleting nothing / unknown IDs / an empty selection creates no history entry", () => {
    let c = emptyCircuit();
    const a = addComponent(c, "Input", { x: 100, y: 100 }), b = addComponent(c, "Output", { x: 400, y: 100 });
    c = link(c, pin(c, a), pin(c, b));
    const e = new Editor(); e.circuit = c;
    e.selection = []; e.deleteSelection();
    e.selection = ["does-not-exist"]; e.deleteSelection();
    expect(e.history).toHaveLength(0);
    expect(deleteObjects(c, ["nope"])).toEqual(c);
  });
});

/* ------------------------------------------------------------------ 17. same coordinates != same connection */
describe("coincident coordinates never create or merge connections", () => {
  it("two Inputs stacked on the same spot: deleting one leaves the other net untouched", () => {
    let c = emptyCircuit();
    const i1 = addComponent(c, "Input", { x: 100, y: 100 }), i2 = addComponent(c, "Input", { x: 100, y: 100 });
    const o1 = addComponent(c, "Output", { x: 400, y: 100 }), o2 = addComponent(c, "Output", { x: 400, y: 200 });
    c = link(c, pin(c, i1), pin(c, o1)); c = link(c, pin(c, i2), pin(c, o2));
    expect(Object.keys(c.nets)).toHaveLength(2);
    const r = checkedDelete(c, [i1]);
    expect(Object.keys(r.nets)).toHaveLength(2);
    const dangling = Object.values(r.junctions)[0];
    expect(r.nets[dangling.net].pins).toEqual([c.components[o1].pins[0]]);
    const other = Object.values(r.nets).find((n) => n.pins.includes(c.components[i2].pins[0]))!;
    expect(other.pins).toContain(c.components[o2].pins[0]);
    expect(other.pins).not.toContain(c.components[o1].pins[0]);
    const r2 = checkedDelete(r, [i2]);
    expect(Object.keys(r2.nets)).toHaveLength(2);
    expect(Object.keys(r2.junctions)).toHaveLength(2);
  });

  it("a junction of net N1 exactly on a pin of net N2: deleting that pin's part keeps N1 and N2 apart", () => {
    let c = emptyCircuit();
    const a = addComponent(c, "Input", { x: 100, y: 200 }), t = addComponent(c, "Output", { x: 500, y: 200 }), x = addComponent(c, "Output", { x: 340, y: 100 });
    c = link(c, pin(c, a), pin(c, t));
    const w = Object.keys(c.geometry.wires)[0];
    c = link(c, { type: "wire", id: w, position: { x: 300, y: 200 } }, pin(c, x), false); // J1 at (300,200)
    const j1 = junctionAt(c, 300, 200);
    const i2 = addComponent(c, "Input", { x: 260, y: 200 }); // its output pin is ALSO at (300,200)
    const y = addComponent(c, "Output", { x: 500, y: 400 });
    c = link(c, pin(c, i2), pin(c, y));
    expect(Object.keys(c.nets)).toHaveLength(2);
    const r = checkedDelete(c, [i2]);
    expect(Object.keys(r.nets)).toHaveLength(2);
    const j2 = Object.values(r.geometry.wires).find((q) => q.from.type === "junction" && q.to.type === "pin" && q.to.id === c.components[y].pins[0])!.from;
    expect(r.geometry.junctions[j2.id]).toEqual({ x: 300, y: 200 });
    expect(r.junctions[j2.id].net).not.toBe(r.junctions[j1].net);
    const moved = transform(c, [i2], { x: 0, y: 0 });
    expect(electricalGraph(moved)).toBe(electricalGraph(c));
    expect(rawCheck(moved)).toEqual([]);
  });
});

/* ------------------------------------------------------------------ 16. torture test */
describe("topology torture (spec §16)", () => {
  it("every step changes only the expected connectivity; full Undo/Redo is exact", () => {
    let c = emptyCircuit();
    const A = addComponent(c, "Input", { x: 100, y: 200 }), C = addComponent(c, "Output", { x: 500, y: 200 }), B = addComponent(c, "Output", { x: 340, y: 100 });
    const D = addComponent(c, "Output", { x: 240, y: 400 }), E = addComponent(c, "Output", { x: 440, y: 400 });
    c = link(c, pin(c, A), pin(c, C));
    const w1 = Object.keys(c.geometry.wires)[0];
    c = link(c, { type: "wire", id: w1, position: { x: 300, y: 200 } }, pin(c, B), false); // J1
    const j1 = junctionAt(c, 300, 200);
    c = link(c, { type: "junction", id: j1 }, pin(c, D), false); // J1 -> down -> D (corner at 300,400)
    const jd = Object.values(c.geometry.wires).find((q) => q.to.type === "pin" && q.to.id === c.components[D].pins[0])!.id;
    c = link(c, { type: "wire", id: jd, position: { x: 300, y: 400 } }, pin(c, E)); // J2 at (300,400)
    const j2 = junctionAt(c, 300, 400);
    type W = Circuit["geometry"]["wires"][string];
    const touchesJ = (id: string) => (w: W) => [w.from, w.to].some((e) => e.type === "junction" && e.id === id);
    const e = new Editor(); e.circuit = c;
    const states: { label: string; json: string }[] = [];
    const record = (label: string, expectedGroups?: string) => {
      expect(rawCheck(e.circuit), label).toEqual([]);
      if (expectedGroups !== undefined) expect(netGroups(e.circuit), label).toBe(expectedGroups);
      states.push({ label, json: JSON.stringify(e.circuit) });
    };
    record("initial", wireGroups(c));
    e.selection = [B]; e.deleteSelection();
    record("delete B", wireGroups(c));
    const bridge = Object.values(e.circuit.geometry.wires).filter((w) => touchesJ(j1)(w) && touchesJ(j2)(w)).map((w) => w.id);
    expect(bridge).toHaveLength(1);
    const g0 = wireGroups(e.circuit, bridge);
    e.selection = [...bridge]; e.deleteSelection();
    record("delete bridge", g0);
    expect(Object.keys(e.circuit.nets)).toHaveLength(2);
    const g1 = wireGroups(e.circuit);
    e.selection = [A, C]; e.deleteSelection();
    record("delete A+C", g1);
    e.selection = [D]; e.move({ x: 0, y: 0 }); e.update({ x: 60, y: 100 }); e.confirm();
    record("move D", g1);
    e.selection = [E]; e.rotate();
    record("rotate E", g1);
    e.selection = [D, E]; e.deleteSelection();
    record("delete D+E", g1);
    for (let i = states.length - 2; i >= 0; i--) {
      e.undo();
      expect(JSON.stringify(e.circuit), `undo -> ${states[i].label}`).toBe(states[i].json);
    }
    for (let i = 1; i < states.length; i++) {
      e.redo();
      expect(JSON.stringify(e.circuit), `redo -> ${states[i].label}`).toBe(states[i].json);
    }
    expect(e.history).toHaveLength(states.length - 1);
  });
});

/* ------------------------------------------------------------------ 6. corner deletion */
describe("wire corner deletion", () => {
  const LPATH = () => {
    let c = emptyCircuit();
    const a = addComponent(c, "Input", { x: 100, y: 100 }), b = addComponent(c, "Output", { x: 400, y: 300 });
    c = link(c, pin(c, a), pin(c, b));
    return { c, w: Object.keys(c.geometry.wires)[0], a, b };
  };
  const manual = (pts: Point[], anchors?: Point[], inA: Point = { x: 100, y: 100 }, outA: Point = { x: 400, y: 200 }) => {
    let c = emptyCircuit();
    const a = addComponent(c, "Input", inA), b = addComponent(c, "Output", outA);
    c = connectTargets(c, pin(c, a), pin(c, b), pts, anchors)!;
    return { c, w: Object.keys(c.geometry.wires)[0], a, b };
  };
  const len = (pts: Point[]) => pts.slice(1).reduce((s, p, i) => s + Math.abs(p.x - pts[i].x) + Math.abs(p.y - pts[i].y), 0);
  const onPath = (pts: Point[], p: Point) =>
    pts.some((q, i) => i > 0 && ((q.x === pts[i - 1].x && p.x === q.x && p.y >= Math.min(q.y, pts[i - 1].y) && p.y <= Math.max(q.y, pts[i - 1].y)) ||
      (q.y === pts[i - 1].y && p.y === q.y && p.x >= Math.min(q.x, pts[i - 1].x) && p.x <= Math.max(q.x, pts[i - 1].x))));

  it("L: removes exactly the corner, keeps endpoints, Manhattan length, graph; selectedCorner cleared; exact Undo", () => {
    const { c, w } = LPATH();
    const e = new Editor(); e.circuit = c;
    const corner = c.geometry.wires[w].points[1];
    e.selectCorner(w, 1);
    expect(e.selectedCorner).toEqual({ wire: w, index: 1 });
    e.deleteSelection();
    const pts = e.circuit.geometry.wires[w].points;
    expect(rawCheck(e.circuit)).toEqual([]);
    expect(pts.some((p) => eq(p, corner))).toBe(false);
    expect(len(pts)).toBe(len(c.geometry.wires[w].points));
    expect(electricalGraph(e.circuit)).toBe(electricalGraph(c));
    expect(e.selectedCorner).toBeNull();
    e.undo();
    expect(JSON.stringify(e.circuit)).toBe(JSON.stringify(c));
    expect(e.selectedCorner).toBeNull();
  });

  for (const idx of [1, 2])
    it(`Z: deleting corner ${idx} keeps endpoints/orthogonality/graph and never lengthens the wire`, () => {
      const { c, w } = manual([{ x: 140, y: 100 }, { x: 250, y: 100 }, { x: 250, y: 200 }, { x: 360, y: 200 }]);
      const e = new Editor(); e.circuit = c;
      const corner = c.geometry.wires[w].points[idx];
      e.selectCorner(w, idx); e.deleteSelection();
      const pts = e.circuit.geometry.wires[w].points;
      expect(rawCheck(e.circuit)).toEqual([]);
      expect(pts.some((p) => eq(p, corner))).toBe(false);
      expect(len(pts)).toBeLessThanOrEqual(len(c.geometry.wires[w].points));
      expect(electricalGraph(e.circuit)).toBe(electricalGraph(c));
      e.undo(); expect(JSON.stringify(e.circuit)).toBe(JSON.stringify(c));
    });

  for (const idx of [1, 2])
    it(`C-shape (both pins exit the same way): deleting corner ${idx} stays valid`, () => {
      let c = emptyCircuit();
      const a = addComponent(c, "Input", { x: 100, y: 100 }), b = addComponent(c, "Input", { x: 100, y: 200 });
      c = connectTargets(c, pin(c, a), pin(c, b), [{ x: 140, y: 100 }, { x: 200, y: 100 }, { x: 200, y: 200 }, { x: 140, y: 200 }])!;
      const w = Object.keys(c.geometry.wires)[0];
      const e = new Editor(); e.circuit = c;
      e.selectCorner(w, idx); e.deleteSelection();
      expect(rawCheck(e.circuit)).toEqual([]);
      expect(electricalGraph(e.circuit)).toBe(electricalGraph(c));
      e.undo(); expect(JSON.stringify(e.circuit)).toBe(JSON.stringify(c));
    });

  it("pinned anchors other than the deleted corner survive on the path (staircase, both corners anchored)", () => {
    const stairs = [{ x: 140, y: 100 }, { x: 200, y: 100 }, { x: 200, y: 160 }, { x: 300, y: 160 }, { x: 300, y: 220 }, { x: 360, y: 220 }];
    const anchors = [stairs[1], stairs[3]];
    const { c, w } = manual(stairs, anchors, { x: 100, y: 100 }, { x: 400, y: 220 });
    expect(rawCheck(c)).toEqual([]);
    const e = new Editor(); e.circuit = c;
    e.selectCorner(w, 2); // unpinned corner
    e.deleteSelection();
    const after = e.circuit.geometry.wires[w];
    expect(rawCheck(e.circuit)).toEqual([]);
    expect(after.anchors).toEqual(anchors);
    for (const p of anchors) expect(onPath(after.points, p)).toBe(true);
    expect(after.points.some((p) => eq(p, stairs[2]))).toBe(false);
    const e2 = new Editor(); e2.circuit = c;
    e2.selectCorner(w, 1); e2.deleteSelection(); // pinned corner itself
    expect(e2.circuit.geometry.wires[w].anchors).toEqual([stairs[3]]);
    expect(onPath(e2.circuit.geometry.wires[w].points, stairs[3])).toBe(true);
    expect(rawCheck(e2.circuit)).toEqual([]);
  });

  it("a deletion whose opposite-L would cross a component is refused: circuit, history and Redo untouched", () => {
    const { c, w } = LPATH();
    addComponent(c, "Output", { x: 250, y: 300 }); // sits on the vertical-first alternative
    const e = new Editor(); e.circuit = c;
    e.future = [{ label: "x", before: clone(c), after: clone(c) }];
    const before = JSON.stringify(c);
    e.selectCorner(w, 1);
    expect(() => e.deleteSelection()).toThrow();
    expect(JSON.stringify(e.circuit)).toBe(before);
    expect(e.history).toHaveLength(0);
    expect(e.future).toHaveLength(1);
    e.routing = { ...defaultRouting, overlapMode: "warn" };
    e.deleteSelection();
    expect(e.history).toHaveLength(1);
    expect(rawCheck(e.circuit)).toEqual([]);
  });

  it("endpoints are never corners", () => {
    const { c, w } = LPATH();
    const e = new Editor(); e.circuit = c;
    const last = c.geometry.wires[w].points.length - 1;
    for (const i of [-1, 0, last, last + 5]) {
      e.selectCorner(w, i);
      expect(e.selectedCorner).toBeNull();
      expect(() => removeWireCorner(c, w, i)).toThrow();
    }
    expect(e.history).toHaveLength(0);
  });

  it("stale selectedCorner: a Redo that changes the wire geometry must drop the corner selection (docs say Undo/Redo clear it)", () => {
    const { c, w } = manual([{ x: 140, y: 100 }, { x: 250, y: 100 }, { x: 250, y: 200 }, { x: 360, y: 200 }]);
    const e = new Editor(); e.circuit = c; e.selection = [w];
    e.beginWireEdit(w, 1, "segment", { x: 250, y: 150 }); e.update({ x: 290, y: 150 }); e.confirm();
    expect(e.history).toHaveLength(1);
    e.undo();
    e.selectCorner(w, 1);
    expect(e.selectedCorner).not.toBeNull();
    e.redo();
    expect(e.selectedCorner).toBeNull();
  });

  it("selectedCorner is cleared by Undo, tool change, box-select finish, Esc, any commit, Select-net and Select-all style replacement", () => {
    const fresh = () => {
      const { c, w } = manual([{ x: 140, y: 100 }, { x: 250, y: 100 }, { x: 250, y: 200 }, { x: 360, y: 200 }]);
      const e = new Editor(); e.circuit = c; e.selectCorner(w, 1);
      expect(e.selectedCorner).not.toBeNull();
      return { e, w };
    };
    let t = fresh(); t.e.setTool("WIRE"); expect(t.e.selectedCorner, "tool change").toBeNull();
    t = fresh(); t.e.beginBox({ x: 0, y: 0 }); t.e.updateBox({ x: 50, y: 50 }); t.e.finishBox(true); expect(t.e.selectedCorner, "box finish").toBeNull();
    t = fresh(); t.e.escape(); expect(t.e.selectedCorner, "Esc").toBeNull();
    t = fresh(); t.e.place("AND", { x: 600, y: 600 }); t.e.confirm(); expect(t.e.selectedCorner, "commit").toBeNull();
    t = fresh(); t.e.selectNet(); expect(t.e.selectedCorner, "select net").toBeNull();
    t = fresh(); t.e.place("AND", { x: 600, y: 600 }); t.e.confirm(); t.e.undo(); expect(t.e.selectedCorner, "undo").toBeNull();
    t = fresh(); t.e.startWire({ type: "pin", id: Object.keys(t.e.circuit.pins)[0] }); expect(t.e.selectedCorner, "start wire").toBeNull();
    t = fresh(); t.e.beginWireEdit(t.w, 1, "segment", { x: 0, y: 0 }); expect(t.e.selectedCorner, "begin wire edit").toBeNull();
  });

  it("stale selection: Redo of a delete must prune IDs that no longer exist", () => {
    let c = emptyCircuit();
    const a = addComponent(c, "Input", { x: 100, y: 100 }), b = addComponent(c, "Output", { x: 400, y: 100 });
    c = link(c, pin(c, a), pin(c, b));
    const e = new Editor(); e.circuit = c;
    e.selection = [a]; e.deleteSelection(); e.undo();
    e.selection = [a]; // user re-selects the restored part
    e.redo(); // Input is deleted again
    expect(e.circuit.components[a]).toBeUndefined();
    expect(e.selection).not.toContain(a);
  });

  it("Delete with a draft active is rejected even when a corner or objects are selected", () => {
    const { c, w, a } = LPATH();
    const e = new Editor(); e.circuit = c;
    e.selection = [a]; e.selectedCorner = { wire: w, index: 1 };
    e.startWire(pin(c, a));
    const before = JSON.stringify(c);
    expect(() => e.deleteSelection()).toThrow();
    expect(JSON.stringify(e.circuit)).toBe(before);
    expect(e.history).toHaveLength(0);
    e.escape();
    expect(JSON.stringify(e.circuit)).toBe(before);
  });
});

/* ------------------------------------------------------------------ 7. OR / NOT / AND */
describe("gate pins, rotation, routing and Safe Move", () => {
  const KINDS: Kind[] = ["AND", "OR", "NOT"];
  const ROTS = [0, 90, 180, 270];
  const bodyRect = (c: Circuit, k: string) => {
    const pl = c.geometry.components[k];
    const corners = [{ x: -30, y: -20 }, { x: 30, y: -20 }, { x: 30, y: 20 }, { x: -30, y: 20 }].map((p) => rot(p, pl.rotation));
    return { l: pl.position.x + Math.min(...corners.map((p) => p.x)), r: pl.position.x + Math.max(...corners.map((p) => p.x)), t: pl.position.y + Math.min(...corners.map((p) => p.y)), b: pl.position.y + Math.max(...corners.map((p) => p.y)) };
  };
  const crossesBody = (c: Circuit, pts: Point[]) =>
    Object.keys(c.components).some((k) => {
      const r = bodyRect(c, k);
      return pts.slice(1).some((q, i) => {
        const p = pts[i];
        return p.y === q.y
          ? p.y > r.t && p.y < r.b && Math.max(p.x, q.x) > r.l && Math.min(p.x, q.x) < r.r
          : p.x > r.l && p.x < r.r && Math.max(p.y, q.y) > r.t && Math.min(p.y, q.y) < r.b;
      });
    });
  const dir = (a: Point, b: Point) => ({ x: n0(Math.sign(b.x - a.x)), y: n0(Math.sign(b.y - a.y)) });
  const scene = (kind: Kind, rotation: number) => {
    const c = emptyCircuit();
    const src = addComponent(c, "Input", { x: 100, y: 300 }), g = addComponent(c, kind, { x: 500, y: 300 }, rotation), dst = addComponent(c, "Output", { x: 900, y: 300 });
    return { c, src, g, dst };
  };
  const normOf = (c: Circuit, e: Endpoint) => {
    const p = c.pins[e.id];
    return normalOf(c.components[p.component].kind, p.index, c.geometry.components[p.component].rotation);
  };

  for (const kind of KINDS)
    for (const r of ROTS)
      it(`${kind}@${r}: pin count/direction/positions match an independent SVG-rotation model`, () => {
        const c = emptyCircuit();
        const g = addComponent(c, kind, { x: 200, y: 200 }, r);
        const pins = c.components[g].pins.map((p) => c.pins[p]);
        expect(pins.map((p) => p.direction)).toEqual(kind === "NOT" ? ["in", "out"] : ["in", "in", "out"]);
        for (const p of pins) {
          const l = rot(localPin(kind, p.index), r);
          expect(pinPosition(c, p.id)).toEqual({ x: 200 + l.x, y: 200 + l.y });
          expect(pinAt(c, p.id)).toEqual({ x: 200 + l.x, y: 200 + l.y });
        }
        expect(new Set(pins.map((p) => JSON.stringify(pinAt(c, p.id)))).size).toBe(pins.length);
      });

  for (const kind of KINDS)
    for (const r of ROTS)
      it(`${kind}@${r}: smart routes leave/enter along pin normals, end exactly on pins, never cross a body`, () => {
        const { c, src, g, dst } = scene(kind, r);
        const cases: [Endpoint, Endpoint][] = [[pin(c, src), pin(c, g, 0)], [pin(c, g, kind === "NOT" ? 1 : 2), pin(c, dst)]];
        if (kind !== "NOT") cases.push([pin(c, src), pin(c, g, 1)]);
        for (const [from, to] of cases) {
          const res = planRoute(c, endAt(c, from), endAt(c, to), defaultRouting, { from, to });
          const pts = res.points;
          expect(res.blocked).toBe(false);
          expect(pts[0]).toEqual(endAt(c, from));
          expect(pts[pts.length - 1]).toEqual(endAt(c, to));
          for (let i = 1; i < pts.length; i++) { expect(eq(pts[i], pts[i - 1])).toBe(false); expect(pts[i].x === pts[i - 1].x || pts[i].y === pts[i - 1].y).toBe(true); }
          expect(dir(pts[0], pts[1]), `leaves ${from.id} along its normal`).toEqual(normOf(c, from));
          const nn = normOf(c, to);
          expect(dir(pts[pts.length - 2], pts[pts.length - 1]), `enters ${to.id} against its normal`).toEqual({ x: n0(-nn.x), y: n0(-nn.y) });
          expect(crossesBody(c, pts), "route crosses a body").toBe(false);
        }
      });

  for (const kind of KINDS)
    for (const r of ROTS)
      it(`${kind}@${r}: a straight Input→Output line through the gate is routed around it in every path mode`, () => {
        const { c, src, dst } = scene(kind, r);
        for (const mode of ["smart", "horizontal", "vertical"] as const) {
          const settings: RoutingSettings = { ...defaultRouting, pathMode: mode };
          const from = pin(c, src), to = pin(c, dst);
          const res = planRoute(c, endAt(c, from), endAt(c, to), settings, { from, to });
          expect(res.blocked, mode).toBe(false);
          expect(crossesBody(c, res.points), mode).toBe(false);
        }
      });

  it("manual waypoints keep their order and stay on the polyline when an obstacle forces a detour", () => {
    const { c, src, dst } = scene("OR", 90);
    const waypoints = [{ x: 300, y: 300 }, { x: 300, y: 500 }, { x: 700, y: 500 }, { x: 700, y: 300 }];
    const from = pin(c, src), to = pin(c, dst);
    const res = planRoute(c, endAt(c, from), endAt(c, to), defaultRouting, { from, to, anchors: waypoints });
    expect(res.blocked).toBe(false);
    const pts = res.points, arc: number[] = [0];
    for (let i = 1; i < pts.length; i++) arc.push(arc[i - 1] + Math.abs(pts[i].x - pts[i - 1].x) + Math.abs(pts[i].y - pts[i - 1].y));
    let cursor = 0;
    const found: number[] = [];
    for (const wp of waypoints) {
      let hit = -1;
      for (let i = 1; i < pts.length && hit < 0; i++) {
        const a = pts[i - 1], b = pts[i];
        const on = a.y === b.y ? wp.y === a.y && wp.x >= Math.min(a.x, b.x) && wp.x <= Math.max(a.x, b.x) : wp.x === a.x && wp.y >= Math.min(a.y, b.y) && wp.y <= Math.max(a.y, b.y);
        const off = arc[i - 1] + Math.abs(wp.x - a.x) + Math.abs(wp.y - a.y);
        if (on && off >= cursor) hit = off;
      }
      expect(hit, `waypoint ${JSON.stringify(wp)} lost or reordered`).toBeGreaterThanOrEqual(0);
      found.push(hit); cursor = hit;
    }
    expect(found).toEqual([...found].sort((x, y) => x - y));
    expect(crossesBody(c, pts)).toBe(false);
  });

  for (const kind of KINDS)
    for (const r of ROTS)
      it(`${kind}@${r}: Safe Move keeps wire IDs/endpoints/graph, geometry stays valid, Undo is byte-exact (blocked moves leave no trace)`, () => {
        const s = scene(kind, r);
        let c = s.c;
        const pairs: [Endpoint, Endpoint][] = [[pin(c, s.src), pin(c, s.g, 0)], [pin(c, s.g, kind === "NOT" ? 1 : 2), pin(c, s.dst)]];
        for (const [f, t] of pairs) c = connectTargets(c, f, t, planRoute(c, endAt(c, f), endAt(c, t), defaultRouting, { from: f, to: t }).points)!;
        expect(rawCheck(c)).toEqual([]);
        const identity = (cc: Circuit) => JSON.stringify(Object.values(cc.geometry.wires).map((w) => [w.id, w.from, w.to, w.net]));
        for (const delta of [{ x: 0, y: 100 }, { x: 100, y: -100 }, { x: -200, y: 0 }, { x: 40, y: 40 }, { x: 0, y: -200 }]) {
          const e = new Editor(); e.circuit = clone(c); e.selection = [s.g];
          const before = JSON.stringify(e.circuit);
          e.move({ x: 0, y: 0 }); e.update(delta);
          try { e.confirm(); } catch { e.cancel(); }
          expect(rawCheck(e.circuit), JSON.stringify(delta)).toEqual([]);
          expect(identity(e.circuit)).toBe(identity(c));
          expect(electricalGraph(e.circuit)).toBe(electricalGraph(c));
          if (e.history.length) { expect(e.history).toHaveLength(1); e.undo(); }
          expect(JSON.stringify(e.circuit)).toBe(before);
        }
      });

  it("drag + R, R, Shift+R is ONE command/ONE Undo, the net rotation is applied once, wires leave along the new normals, Undo is exact", () => {
    const s = scene("OR", 0);
    let c = s.c;
    const pairs: [Endpoint, Endpoint][] = [[pin(c, s.src), pin(c, s.g, 0)], [pin(c, s.g, 2), pin(c, s.dst)]];
    for (const [f, t] of pairs) c = connectTargets(c, f, t, planRoute(c, endAt(c, f), endAt(c, t), defaultRouting, { from: f, to: t }).points)!;
    const e = new Editor(); e.circuit = c; e.selection = [s.g];
    const before = JSON.stringify(c);
    e.move({ x: 0, y: 0 }); e.update({ x: 0, y: 100 });
    e.rotate(); e.rotate(); e.rotate(true);
    expect(e.circuit.geometry.components[s.g].rotation, "draft must not mutate committed state").toBe(0);
    e.confirm();
    expect(e.history).toHaveLength(1);
    expect(e.circuit.geometry.components[s.g].rotation).toBe(270);
    expect(e.circuit.geometry.components[s.g].position).toEqual({ x: 500, y: 400 });
    expect(rawCheck(e.circuit)).toEqual([]);
    expect(electricalGraph(e.circuit)).toBe(electricalGraph(c));
    for (const w of Object.values(e.circuit.geometry.wires))
      for (const [end, first] of [[w.from, true], [w.to, false]] as [Endpoint, boolean][]) {
        if (end.type !== "pin" || e.circuit.pins[end.id].component !== s.g) continue;
        const n = normOf(e.circuit, end), pts = w.points;
        const d = first ? dir(pts[0], pts[1]) : dir(pts[pts.length - 1], pts[pts.length - 2]);
        expect(d, `wire ${w.id} at rotated pin ${e.circuit.pins[end.id].index}`).toEqual(n);
      }
    e.undo();
    expect(JSON.stringify(e.circuit)).toBe(before);
    e.redo(); e.undo();
    expect(JSON.stringify(e.circuit)).toBe(before);
  });
});

/* ------------------------------------------------------------------ 9/14. hit testing */
describe("connection hit testing in screen space", () => {
  const ZOOMS = [0.1, 0.25, 0.5, 1, 1.5, 2];
  const lone = () => { const c = emptyCircuit(); const a = addComponent(c, "Input", { x: 100, y: 100 }); return { c, pinId: c.components[a].pins[0], at: { x: 140, y: 100 } }; };
  const ids = (hits: ReturnType<typeof connectionHits>) => hits.map((h) => h.target.type === "wire" ? h.target.id : h.target.id);

  for (const z of ZOOMS)
    it(`zoom ${z}: a pin is captured at 12.9 screen px and not at 13.1 px in all four directions`, () => {
      const { c, pinId, at } = lone();
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]])
        for (const [px, expectHit] of [[12.9, true], [13.1, false]] as const) {
          const hits = connectionHits(c, { x: at.x + (dx * px) / z, y: at.y + (dy * px) / z }, z);
          expect(hits.length > 0, `${px}px dir ${dx},${dy}`).toBe(expectHit);
          if (expectHit) expect(hits[0].target).toEqual({ type: "pin", id: pinId });
        }
    });

  it("the same DRAWING distance changes outcome with zoom, the same SCREEN distance does not", () => {
    const { c, at } = lone();
    const p = { x: at.x + 20, y: at.y };
    expect(connectionHits(c, p, 0.5)).toHaveLength(1); // 10 px
    expect(connectionHits(c, p, 1)).toHaveLength(0); // 20 px
    for (const z of ZOOMS) expect(connectionHits(c, { x: at.x + 8 / z, y: at.y }, z)).toHaveLength(1);
  });

  const andScene = () => { const c = emptyCircuit(); const g = addComponent(c, "AND", { x: 400, y: 300 }); return { c, in0: c.components[g].pins[0], in1: c.components[g].pins[1] }; };
  for (const z of ZOOMS)
    it(`zoom ${z}: adjacent AND inputs — nearest wins or an explicit tie, never an arbitrary pick, independent of insertion order`, () => {
      const { c, in0, in1 } = andScene();
      const reversed = clone(c); reversed.pins = Object.fromEntries(Object.entries(c.pins).reverse());
      for (const y of [290, 296, 299, 300, 301, 304, 310]) {
        const p = { x: 360, y };
        const a = ids(connectionHits(c, p, z)), b = ids(connectionHits(reversed, p, z));
        expect(b, `insertion-order dependence at y=${y}`).toEqual(a);
        const d0 = Math.abs(y - 290) * z, d1 = Math.abs(y - 310) * z;
        if (d0 > 13 && d1 > 13) expect(a, `nothing in range at y=${y}`).toEqual([]);
        else if (Math.abs(d0 - d1) > 0.5) expect(a, `nearest at y=${y}`).toEqual([d0 < d1 ? in0 : in1].filter((k) => (k === in0 ? d0 : d1) <= 13));
        else expect([...a].sort()).toEqual([in0, in1].sort());
      }
    });

  it("parallel wires of different nets 10 units apart: the nearer one is the only hit at every zoom", () => {
    let c = emptyCircuit();
    const i1 = addComponent(c, "Input", { x: 100, y: 100 }), o1 = addComponent(c, "Output", { x: 700, y: 100 });
    const i2 = addComponent(c, "Input", { x: 100, y: 110 }), o2 = addComponent(c, "Output", { x: 700, y: 110 });
    c = link(c, pin(c, i1), pin(c, o1)); c = link(c, pin(c, i2), pin(c, o2));
    const [wa, wb] = Object.keys(c.geometry.wires);
    for (const z of ZOOMS) {
      expect(ids(connectionHits(c, { x: 400, y: 100 }, z)), `zoom ${z} on A`).toEqual([wa]);
      expect(ids(connectionHits(c, { x: 400, y: 110 }, z)), `zoom ${z} on B`).toEqual([wb]);
    }
  });

  it("a crossing near the pointer reports both wires at ONE position and never mutates nets", () => {
    let c = emptyCircuit();
    const i1 = addComponent(c, "Input", { x: 100, y: 200 }), o1 = addComponent(c, "Output", { x: 700, y: 200 });
    const i2 = addComponent(c, "Input", { x: 400, y: 20 }, 90), o2 = addComponent(c, "Output", { x: 400, y: 380 }, 90);
    c = link(c, pin(c, i1), pin(c, o1)); c = link(c, pin(c, i2), pin(c, o2), false);
    const before = JSON.stringify(c);
    for (const z of ZOOMS.filter((v) => v >= 0.25)) { // at 0.1 a pin 10px away legitimately outranks wires
      const hits = connectionHits(c, { x: 400 + 5 / z, y: 200 + 5 / z }, z);
      expect(hits).toHaveLength(2);
      expect(new Set(hits.map((h) => JSON.stringify(h.position))).size).toBe(1);
      expect(hits.every((h) => h.target.type === "wire")).toBe(true);
    }
    expect(JSON.stringify(c)).toBe(before);
    expect(Object.keys(c.nets)).toHaveLength(2);
  });

  it("a gate's body centre is not swallowed by pin capture at the supported zooms (clicking a body must reach the body)", () => {
    // Pin capture is a screen-space radius. If it covers the whole body the component can no longer
    // be selected or dragged by clicking it. 'covered' lists the zooms where the body centre hits a pin.
    const covered: Record<string, number[]> = {};
    for (const kind of ["AND", "OR", "NOT", "Input", "Output"] as Kind[]) {
      const c = emptyCircuit(); addComponent(c, kind, { x: 400, y: 300 });
      covered[kind] = ZOOMS.filter((z) => connectionHits(c, { x: 400, y: 300 }, z).length > 0);
    }
    expect(covered).toEqual({ AND: [], OR: [], NOT: [], Input: [], Output: [] });
  });
});

/* ------------------------------------------------------------------ 15. seeded fuzz */
function mulberry32(a: number) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const VALIDATOR_MESSAGE = /오류|불일치|잘못된 ID|중복 연결망/;
function fuzz(seed: number, steps: number) {
  const rnd = mulberry32(seed);
  const pick = <T,>(a: T[]): T => a[Math.floor(rnd() * a.length)];
  const e = new Editor();
  const log: string[] = [], stats: Record<string, number> = {}, rejected: Record<string, string[]> = {};
  const stack: string[] = [JSON.stringify(e.circuit)];
  const fail = (step: number, why: string): never => {
    if (process.env.FUZZ_DUMP) writeFileSync(process.env.FUZZ_DUMP, JSON.stringify({ seed, step, why, selection: e.selection, circuit: e.circuit }, null, 1));
    throw new Error(`FUZZ FAILURE seed=${seed} step=${step}: ${why}\nlast ops:\n${log.slice(-12).join("\n")}`);
  };
  const grid = (lo: number, hi: number) => lo + Math.floor(rnd() * ((hi - lo) / 10 + 1)) * 10;
  for (let step = 0; step < steps; step++) {
    const before = JSON.stringify(e.circuit), hBefore = e.history.length;
    const pins = Object.keys(e.circuit.pins), comps = Object.keys(e.circuit.components), wires = Object.keys(e.circuit.geometry.wires);
    const op = pick(["place", "place", "place", "wire", "wire", "wire", "branch", "move", "rotate", "delwire", "delcomp", "delmixed", "corner", "wirewp", "wirewp", "segment", "reroute", "tidy", "cleanup", "join", "join", "undo", "redo"]);
    let thrown: unknown = null, label: string = op;
    e.selectedCorner = null; // every UI selection command clears it; the fuzz sets e.selection directly
    try {
      if (op === "place") {
        const kind = pick<Kind>(["AND", "OR", "NOT", "Input", "Output"]);
        label = `place ${kind}`;
        e.place(kind, { x: grid(100, 800), y: grid(100, 600) }); e.confirm();
      } else if (op === "wire" && pins.length >= 2) {
        const p = pick(pins), q = pick(pins.filter((x) => x !== p));
        label = `wire ${p.slice(0, 4)}->${q.slice(0, 4)}`;
        e.startWire({ type: "pin", id: p }); e.update(endAt(e.circuit, { type: "pin", id: q }), { type: "pin", id: q }); e.confirm({ type: "pin", id: q });
      } else if (op === "branch" && wires.length && pins.length) {
        const w = e.circuit.geometry.wires[pick(wires)], i = Math.floor(rnd() * (w.points.length - 1)), a = w.points[i], b = w.points[i + 1];
        const total = Math.max(1, (Math.abs(b.x - a.x) + Math.abs(b.y - a.y)) / 10), k = Math.floor(rnd() * (total + 1));
        const position = { x: a.x + Math.sign(b.x - a.x) * 10 * k, y: a.y + Math.sign(b.y - a.y) * 10 * k };
        const q = pick(pins);
        label = `branch ${w.id.slice(0, 4)}@${position.x},${position.y}->${q.slice(0, 4)}`;
        e.startWire({ type: "wire", id: w.id, position }); e.confirm({ type: "pin", id: q });
      } else if (op === "move" && comps.length) {
        const chosen = [pick(comps), ...(rnd() < 0.3 ? [pick(comps)] : [])];
        const d = { x: grid(-200, 200), y: grid(-200, 200) };
        label = `move ${chosen.map((k) => k.slice(0, 4))} by ${d.x},${d.y}`;
        e.selection = chosen; e.move({ x: 0, y: 0 }); e.update(d);
        if (rnd() < 0.4) e.rotate(rnd() < 0.5);
        e.confirm();
      } else if (op === "rotate" && comps.length) {
        e.selection = [pick(comps)]; label = `rotate ${e.selection[0].slice(0, 4)}`; e.rotate(rnd() < 0.5);
      } else if (op === "delwire" && wires.length) {
        e.selection = wires.filter(() => rnd() < 0.3); label = `delwire x${e.selection.length}`;
        const expected = e.selection.length ? wireGroups(e.circuit, e.selection) : null;
        e.deleteSelection();
        if (expected !== null && netGroups(e.circuit) !== expected) fail(step, "wire deletion changed connectivity unexpectedly");
      } else if (op === "delcomp" && comps.length) {
        e.selection = comps.filter(() => rnd() < 0.3); label = `delcomp x${e.selection.length}`;
        e.deleteSelection();
      } else if (op === "delmixed" && comps.length) {
        e.selection = [...comps.filter(() => rnd() < 0.25), ...wires.filter(() => rnd() < 0.25)]; label = `delmixed x${e.selection.length}`;
        e.deleteSelection();
      } else if (op === "corner" && wires.length) {
        const w = pick(wires), pts = simplifyPath(e.circuit.geometry.wires[w].points); e.selection = [];
        if (pts.length > 2) { const i = 1 + Math.floor(rnd() * (pts.length - 2)); label = `corner ${w.slice(0, 4)}#${i}`; e.selectCorner(w, i); if (!e.selectedCorner) fail(step, "selectCorner refused a valid corner"); e.deleteSelection(); }
      } else if (op === "wirewp" && pins.length >= 2) {
        const p = pick(pins), q = pick(pins.filter((x) => x !== p)), tq: ConnectionTarget = { type: "pin", id: q };
        label = `wire+waypoints ${p.slice(0, 4)}->${q.slice(0, 4)}`;
        e.startWire({ type: "pin", id: p });
        for (let k = 0, n = 1 + Math.floor(rnd() * 2); k < n; k++) { e.update({ x: grid(100, 800), y: grid(100, 600) }); e.waypoint(); }
        e.update(endAt(e.circuit, tq), tq); e.confirm(tq);
      } else if (op === "segment" && wires.length) {
        const w = pick(wires), pts = simplifyPath(e.circuit.geometry.wires[w].points);
        const kind = pick<"segment" | "jog" | "corner">(["segment", "segment", "jog", "corner"]);
        const index = kind === "corner" ? 1 + Math.floor(rnd() * Math.max(1, pts.length - 2)) : Math.floor(rnd() * Math.max(1, pts.length - 1));
        label = `wire-edit ${kind} ${w.slice(0, 4)}#${index}`;
        e.beginWireEdit(w, index, kind, { x: 0, y: 0 }); e.update({ x: grid(-100, 100), y: grid(-100, 100) }); e.confirm();
      } else if (op === "reroute" && wires.length) {
        const w = pick(wires), end = endAt(e.circuit, e.circuit.geometry.wires[w].to);
        label = `reroute ${w.slice(0, 4)}`;
        e.rerouteWire(w); e.update({ x: grid(100, 800), y: grid(100, 600) }); e.waypoint(); e.update(end); e.confirm();
      } else if (op === "tidy" && wires.length) {
        e.selection = wires.filter(() => rnd() < 0.3); label = `tidy x${e.selection.length}`;
        e.tidyWires(rnd() < 0.5 ? true : rnd() < 0.5 ? false : undefined);
      } else if (op === "cleanup" && wires.length) {
        e.selection = [pick(wires)]; label = "cleanup duplicates";
        if (e.beginWireCleanup()) e.confirm();
      } else if (op === "join" && wires.length >= 2) {
        // find a strict interior crossing of two different wires and join it explicitly
        const all = wires.map((k) => e.circuit.geometry.wires[k]);
        const found: { a: string; b: string; p: Point }[] = [];
        for (const wa of all) for (const wb of all) {
          if (wa.id >= wb.id) continue;
          for (let i = 1; i < wa.points.length; i++) for (let j = 1; j < wb.points.length; j++) {
            const a1 = wa.points[i - 1], a2 = wa.points[i], b1 = wb.points[j - 1], b2 = wb.points[j];
            const ah = a1.y === a2.y, bh = b1.y === b2.y;
            if (ah === bh) continue;
            const [h1, h2, v1, v2] = ah ? [a1, a2, b1, b2] : [b1, b2, a1, a2];
            const p = { x: v1.x, y: h1.y };
            if (p.x > Math.min(h1.x, h2.x) && p.x < Math.max(h1.x, h2.x) && p.y > Math.min(v1.y, v2.y) && p.y < Math.max(v1.y, v2.y)) found.push({ a: wa.id, b: wb.id, p });
          }
        }
        if (found.length) { const f = pick(found); label = `join ${f.a.slice(0, 4)}x${f.b.slice(0, 4)}@${f.p.x},${f.p.y}`; e.joinWires([{ type: "wire", id: f.a, position: f.p }, { type: "wire", id: f.b, position: f.p }]); }
      } else if (op === "undo") e.undo();
      else if (op === "redo") e.redo();
    } catch (err) { thrown = err; e.cancel(); }
    log.push(`${step}: ${label}${thrown ? ` !! ${(thrown as Error).message}` : ""}`);
    if (thrown && VALIDATOR_MESSAGE.test((thrown as Error).message)) {
      (rejected[op] ??= []).push((thrown as Error).message);
      // Deletion/placement/basic wiring must never produce a candidate the validator rejects.
      if (["place", "wire", "branch", "delwire", "delcomp", "delmixed"].includes(op)) fail(step, `validator rejected a state the editor produced: ${(thrown as Error).message}`);
    }
    if (e.draft) e.cancel();
    const productErrors = validateCircuit(e.circuit);
    if (productErrors.length) fail(step, `product validateCircuit rejects the COMMITTED circuit: ${productErrors.join(' | ')}`);
    for (const [k, pl] of Object.entries(e.circuit.geometry.components))
      if (pl.position.x % 10 !== 0 || pl.position.y % 10 !== 0) fail(step, `component ${k.slice(0, 4)} left the 10-unit grid: ${JSON.stringify(pl.position)}`);
    for (const p of Object.keys(e.circuit.pins)) { const q = pinAt(e.circuit, p); if (q.x % 10 !== 0 || q.y % 10 !== 0) fail(step, `pin ${p.slice(0, 4)} left the grid: ${JSON.stringify(q)}`); }
    const problems = rawCheck(e.circuit);
    if (problems.length) fail(step, `invalid circuit: ${problems.slice(0, 4).join(" | ")}`);
    if (thrown && JSON.stringify(e.circuit) !== before) fail(step, "failed operation changed the committed circuit");
    if (!thrown && ["move", "rotate", "segment", "reroute", "tidy", "corner"].includes(op) && e.history.length === hBefore + 1) {
      const ident = (json: string) => { const c = JSON.parse(json) as Circuit; return JSON.stringify({ comps: Object.keys(c.components), pins: c.pins, nets: c.nets, junctions: c.junctions, wires: Object.values(c.geometry.wires).map((w) => [w.id, w.from, w.to, w.net]) }); };
      if (ident(before) !== ident(JSON.stringify(e.circuit))) fail(step, `${op} changed electrical identity (wire ids/endpoints/nets/junctions)`);
    }
    const delta = e.history.length - hBefore;
    if (op === "undo" || op === "redo") {
      if (JSON.stringify(e.circuit) !== stack[e.history.length]) fail(step, `${op} did not restore the exact snapshot #${e.history.length}`);
    } else if (delta === 1) {
      stack.length = hBefore + 1; stack.push(JSON.stringify(e.circuit)); stats[op] = (stats[op] ?? 0) + 1;
    } else if (delta !== 0) fail(step, `operation produced ${delta} history entries`);
    else if (JSON.stringify(e.circuit) !== before) fail(step, "circuit changed without a history entry");
  }
  const final = JSON.stringify(e.circuit), depth = e.history.length;
  while (e.history.length) e.undo();
  if (JSON.stringify(e.circuit) !== JSON.stringify(emptyCircuit())) fail(steps, "full Undo did not return to the empty circuit");
  for (let i = 0; i < depth; i++) e.redo();
  if (JSON.stringify(e.circuit) !== final) fail(steps, "full Redo did not reproduce the final circuit");
  return { depth, stats, rejected: Object.fromEntries(Object.entries(rejected).map(([k, v]) => [k, [...new Set(v)].concat(`x${v.length}`)])), comps: Object.keys(e.circuit.components).length, wires: Object.keys(e.circuit.geometry.wires).length };
}
describe("seeded random invariant test", () => {
  it("seed 12345, 800 steps (and it really exercised the risky operations)", () => {
    const r = fuzz(12345, 800);
    console.log("FUZZ12345", JSON.stringify(r, null, 1));
    expect(r.depth).toBeGreaterThan(50);
    for (const op of ["wire", "delcomp", "move"]) expect(r.stats[op] ?? 0, `committed ${op}`).toBeGreaterThan(3);
  });
  for (const seed of [1, 7, 42, 2024, 99991])
    it(`seed ${seed}, 400 steps`, () => { fuzz(seed, 400); });
});
// Opt-in soak: FUZZ_EXTRA=150 npx vitest run tests/unit/adversarial-latest.test.ts -t soak
const soakSeeds = Number(process.env.FUZZ_EXTRA ?? 0);
it.skipIf(!soakSeeds)(`fuzz soak: ${soakSeeds} extra seeds x 500 steps`, () => {
  for (let i = 0; i < soakSeeds; i++) fuzz(1000 + i, 500);
}, 900_000);
