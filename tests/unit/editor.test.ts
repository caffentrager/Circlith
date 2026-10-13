import { describe, it, expect } from "vitest";
import { Editor } from "../../src/editor/editor";
import {
  addComponent,
  clone,
  connect,
  electricalGraph,
  emptyCircuit,
  type Endpoint,
} from "../../src/model/circuit";
import { pinPosition, route, transform } from "../../src/geometry/geometry";
function fixture() {
  const c = emptyCircuit();
  const a = addComponent(c, "Input", { x: 100, y: 100 });
  const b = addComponent(c, "AND", { x: 300, y: 200 });
  const from: Endpoint = { type: "pin", id: c.components[a].pins[0] },
    to: Endpoint = { type: "pin", id: c.components[b].pins[0] };
  connect(c, from, to, route(pinPosition(c, from.id), pinPosition(c, to.id)));
  return { c, a, b, from, to };
}
function orthogonal(c: ReturnType<typeof emptyCircuit>) {
  for (const w of Object.values(c.geometry.wires)) {
    expect(w.points[0]).toEqual(
      w.from.type === "pin"
        ? pinPosition(c, w.from.id)
        : c.geometry.junctions[w.from.id],
    );
    expect(w.points.at(-1)).toEqual(
      w.to.type === "pin"
        ? pinPosition(c, w.to.id)
        : c.geometry.junctions[w.to.id],
    );
    for (let i = 1; i < w.points.length; i++) {
      const a = w.points[i - 1],
        b = w.points[i];
      expect(a.x === b.x || a.y === b.y).toBe(true);
      expect(a).not.toEqual(b);
    }
  }
}
describe("draft / command / history", () => {
  it("never commits a placement preview; cancel does not remove prior edits", () => {
    const e = new Editor();
    e.place("Input", { x: 100, y: 100 });
    e.confirm();
    const before = clone(e.circuit);
    e.place("AND", { x: 200, y: 100 });
    e.rotate();
    e.update({ x: 300, y: 300 });
    expect(e.circuit).toEqual(before);
    expect(e.history).toHaveLength(1);
    e.undo();
    expect(e.draft).toBeNull();
    expect(e.circuit).toEqual(before);
    expect(e.history).toHaveLength(1);
    e.undo();
    expect(e.circuit).toEqual(emptyCircuit());
    e.redo();
    expect(e.circuit).toEqual(before);
  });
  it("preserves redo through draft creation/cancel and blocks redo during drafts", () => {
    const e = new Editor();
    e.place("Input", { x: 0, y: 0 });
    e.confirm();
    e.undo();
    e.place("AND", { x: 0, y: 0 });
    e.redo();
    expect(e.future).toHaveLength(1);
    e.escape();
    e.redo();
    expect(Object.values(e.circuit.components)[0].kind).toBe("Input");
    e.undo();
    e.place("Output", { x: 0, y: 0 });
    e.confirm();
    expect(e.future).toHaveLength(0);
  });
  it("commits waypoint wire exactly once; route edits and cancel have no electrical effect", () => {
    const { c, from, to } = fixture();
    c.nets = {};
    c.geometry.wires = {};
    const e = new Editor();
    e.circuit = c;
    const before = clone(c);
    e.startWire(from);
    e.update({ x: 180, y: 160 });
    e.waypoint();
    e.backspace();
    expect(e.circuit).toEqual(before);
    e.confirm(to);
    expect(e.history).toHaveLength(1);
    orthogonal(e.circuit);
    e.undo();
    expect(e.circuit).toEqual(before);
  });
  it("keeps stable drafts through pan and focus changes", () => {
    const e = new Editor();
    e.place("AND", { x: 10, y: 20 });
    const draft = clone(e.draft);
    e.transient = "PAN";
    e.update({ x: 200, y: 200 });
    e.focus = "TEXT_EDITOR";
    e.transient = "NONE";
    e.focus = "CANVAS";
    expect(e.draft).toEqual(draft);
    expect(e.history).toHaveLength(0);
  });
});
describe("safe geometry", () => {
  it("preserves graph, fixed external span, deterministic geometry, and exact move undo", () => {
    const { c, a } = fixture();
    const before = clone(c);
    const e = new Editor();
    e.circuit = c;
    e.selection = [a];
    e.move({ x: 100, y: 100 });
    e.update({ x: 150, y: 160 });
    expect(e.circuit).toEqual(before);
    const result = e.preview();
    expect(electricalGraph(result)).toBe(electricalGraph(before));
    expect(result).toEqual(transform(c, [a], { x: 50, y: 60 }));
    orthogonal(result);
    expect(Object.values(result.geometry.wires)[0].points.slice(-2)).toEqual(
      Object.values(before.geometry.wires)[0].points.slice(-2),
    );
    e.confirm();
    expect(e.history).toHaveLength(1);
    e.undo();
    expect(e.circuit).toEqual(before);
    e.redo();
    expect(e.circuit).toEqual(result);
  });
  it("translates internal geometry rigidly and rotates without graph changes", () => {
    const { c, a, b } = fixture();
    const moved = transform(c, [a, b], { x: 40, y: 20 });
    expect(Object.values(moved.geometry.wires)[0].points).toEqual(
      Object.values(c.geometry.wires)[0].points.map((p) => ({
        x: p.x + 40,
        y: p.y + 20,
      })),
    );
    for (const rotation of [-90, 90, 180, 270]) {
      const rotated = transform(c, [a, b], { x: 0, y: 0 }, rotation);
      expect(electricalGraph(rotated)).toBe(electricalGraph(c));
      orthogonal(rotated);
      const single = transform(c, [b], { x: 0, y: 0 }, rotation);
      orthogonal(single);
    }
  });
  it("keeps a shared external junction fixed", () => {
    const { c, a, from } = fixture();
    const net = Object.keys(c.nets)[0];
    c.junctions.j = { id: "j", net };
    c.nets[net].junctions.push("j");
    c.geometry.junctions.j = { x: 200, y: 100 };
    connect(
      c,
      from,
      { type: "junction", id: "j" },
      route(pinPosition(c, from.id), c.geometry.junctions.j),
    );
    const moved = transform(c, [a], { x: 30, y: 70 });
    expect(moved.geometry.junctions).toEqual(c.geometry.junctions);
    expect(electricalGraph(moved)).toBe(electricalGraph(c));
    orthogonal(moved);
  });
  it("merges explicit nets without stale wire references", () => {
    const { c, a, to } = fixture();
    const x = addComponent(c, "Input", { x: 0, y: 0 }),
      y = addComponent(c, "Output", { x: 100, y: 0 });
    const p: Endpoint = { type: "pin", id: c.components[x].pins[0] };
    connect(
      c,
      p,
      { type: "pin", id: c.components[y].pins[0] },
      route({ x: 40, y: 0 }, { x: 60, y: 0 }),
    );
    connect(c, p, to, route(pinPosition(c, p.id), pinPosition(c, to.id)));
    expect(Object.keys(c.nets)).toHaveLength(1);
    for (const w of Object.values(c.geometry.wires))
      expect(c.nets[w.net]).toBeDefined();
    expect(c.nets[Object.keys(c.nets)[0]].pins).toContain(
      c.components[a].pins[0],
    );
  });
});
