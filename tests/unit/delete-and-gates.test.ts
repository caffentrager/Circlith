import { describe, it, expect } from "vitest";
import { Editor } from "../../src/editor/editor";
import {
  addComponent,
  clone,
  connect,
  electricalGraph,
  emptyCircuit,
  type Endpoint,
  type Kind,
} from "../../src/model/circuit";
import { deleteObjects } from "../../src/model/deletion";
import { pinPosition, route } from "../../src/geometry/geometry";
import { assertCircuit, validateCircuit } from "../../src/model/connections";
import { connectionHits } from "../../src/geometry/connection-hit";
function fixture() {
  const c = emptyCircuit(),
    a = addComponent(c, "Input", { x: 100, y: 100 }),
    b = addComponent(c, "Output", { x: 400, y: 300 });
  const from: Endpoint = { type: "pin", id: c.components[a].pins[0] },
    to: Endpoint = { type: "pin", id: c.components[b].pins[0] };
  connect(c, from, to, route(pinPosition(c, from.id), pinPosition(c, to.id)));
  return { c, a, b, wire: Object.keys(c.geometry.wires)[0], from, to };
}
describe("explicit deletion transactions", () => {
  it("deletes a component while preserving attached geometry with a dangling endpoint, exact Undo/Redo", () => {
    const { c, a, wire } = fixture(),
      e = new Editor(),
      before = clone(c);
    e.circuit = c;
    e.selection = [a];
    e.deleteSelection();
    expect(e.circuit.components[a]).toBeUndefined();
    expect(e.circuit.geometry.wires[wire].from.type).toBe("junction");
    expect(e.circuit.geometry.wires[wire].points).toEqual(
      c.geometry.wires[wire].points,
    );
    assertCircuit(e.circuit);
    const after = clone(e.circuit);
    expect(e.history).toHaveLength(1);
    e.undo();
    expect(e.circuit).toEqual(before);
    e.redo();
    expect(e.circuit).toEqual(after);
  });
  it("deletes a wire without deleting its components and cleans unused nets and junctions", () => {
    const { c, a, b, wire } = fixture();
    const next = deleteObjects(c, [wire]);
    expect(Object.keys(next.components)).toEqual([a, b]);
    expect(next.nets).toEqual({});
    expect(next.geometry.wires).toEqual({});
    expect(validateCircuit(next)).toEqual([]);
    expect(Object.keys(c.geometry.wires)).toEqual([wire]);
  });
  it("splits a net at a deleted bridge without changing remaining wire IDs or geometry", () => {
    const c = emptyCircuit(),
      a = addComponent(c, "Input", { x: 100, y: 100 }),
      b = addComponent(c, "Output", { x: 500, y: 100 });
    c.nets.n = { id: "n", pins: [], junctions: ["j1", "j2"] };
    c.junctions.j1 = { id: "j1", net: "n" };
    c.junctions.j2 = { id: "j2", net: "n" };
    c.geometry.junctions = { j1: { x: 200, y: 100 }, j2: { x: 300, y: 100 } };
    const ends: Endpoint[] = [
      { type: "pin", id: c.components[a].pins[0] },
      { type: "junction", id: "j1" },
      { type: "junction", id: "j2" },
      { type: "pin", id: c.components[b].pins[0] },
    ];
    for (let i = 0; i < 3; i++) {
      const p = (e: Endpoint) =>
        e.type === "pin" ? pinPosition(c, e.id) : c.geometry.junctions[e.id];
      connect(c, ends[i], ends[i + 1], route(p(ends[i]), p(ends[i + 1])));
    }
    assertCircuit(c);
    const ids = Object.keys(c.geometry.wires),
      next = deleteObjects(c, [ids[1]]);
    expect(Object.keys(next.nets)).toHaveLength(2);
    expect(Object.keys(next.geometry.wires)).toEqual([ids[0], ids[2]]);
    expect(next.geometry.wires[ids[0]].points).toEqual(
      c.geometry.wires[ids[0]].points,
    );
    assertCircuit(next);
  });
  it("shared removed pin remains one junction and multi-delete is one history item", () => {
    const { c, a, from } = fixture(),
      out = addComponent(c, "Output", { x: 400, y: 400 }),
      target: Endpoint = { type: "pin", id: c.components[out].pins[0] };
    connect(
      c,
      from,
      target,
      route(pinPosition(c, from.id), pinPosition(c, target.id)),
    );
    const e = new Editor();
    e.circuit = c;
    e.selection = [a];
    e.deleteSelection();
    expect(Object.keys(e.circuit.junctions)).toHaveLength(1);
    expect(Object.keys(e.circuit.nets)).toHaveLength(1);
    assertCircuit(e.circuit);
    e.undo();
    e.selection = [a, ...Object.keys(c.geometry.wires)];
    e.deleteSelection();
    expect(e.history).toHaveLength(1);
    expect(e.circuit.junctions).toEqual({});
    assertCircuit(e.circuit);
  });
  it("rejects deletion during drafts without clearing history or Redo", () => {
    const e = new Editor();
    e.place("AND", { x: 200, y: 100 });
    e.confirm();
    e.undo();
    e.place("OR", { x: 300, y: 100 });
    expect(() => e.deleteSelection()).toThrow(/초안/);
    expect(e.history).toHaveLength(0);
    expect(e.future).toHaveLength(1);
  });
  it("removes only a selected corner, retaining electrical identity, other route portions, and exact undo", () => {
    const { c, wire } = fixture(),
      e = new Editor();
    e.circuit = c;
    e.selectCorner(wire, 1);
    const before = clone(c);
    e.deleteSelection();
    expect(electricalGraph(e.circuit)).toBe(electricalGraph(c));
    expect(e.circuit.geometry.wires[wire].points).not.toContainEqual(
      c.geometry.wires[wire].points[1],
    );
    assertCircuit(e.circuit);
    expect(e.history).toHaveLength(1);
    e.undo();
    expect(e.circuit).toEqual(before);
  });
  it("will not silently discard another pinned waypoint or commit a blocked corner removal", () => {
    const { c, wire } = fixture(),
      e = new Editor();
    c.geometry.wires[wire].anchors = [{ x: 200, y: 100 }];
    e.circuit = c;
    e.selectCorner(wire, 1);
    expect(() => e.deleteSelection()).toThrow();
    expect(e.history).toHaveLength(0);
    expect(e.circuit).toEqual(c);
  });
});
describe("gate pins and expanded hit regions", () => {
  for (const kind of ["AND", "OR", "NOT"] as Kind[])
    it(`${kind} has correct input/output pins through rotations`, () => {
      for (const rotation of [0, 90, 180, 270]) {
        const c = emptyCircuit(),
          key = addComponent(c, kind, { x: 200, y: 200 }, rotation),
          pins = c.components[key].pins.map((k) => c.pins[k]);
        expect(pins.map((p) => p.direction)).toEqual(
          kind === "NOT" ? ["in", "out"] : ["in", "in", "out"],
        );
        expect(
          new Set(pins.map((p) => JSON.stringify(pinPosition(c, p.id)))).size,
        ).toBe(pins.length);
        assertCircuit(c);
      }
    });
  it("allows pin/junction capture at 12px and keeps wire capture at 11px for every zoom", () => {
    const { c, from } = fixture();
    for (const zoom of [0.5, 1, 2]) {
      expect(
        connectionHits(c, { x: 140, y: 100 - 12 / zoom }, zoom)[0].target,
      ).toEqual(from);
      expect(
        connectionHits(c, { x: 220, y: 100 + 11 / zoom }, zoom)[0].target.type,
      ).toBe("wire");
      expect(
        connectionHits(c, { x: 220, y: 100 + 13 / zoom }, zoom),
      ).toHaveLength(0);
    }
  });
  it("magnetizes a nearby crossing to the same explicit-choice point without merging the nets", () => {
    const { c } = fixture(),
      a = addComponent(c, "Input", { x: 240, y: 20 }, 90),
      b = addComponent(c, "Output", { x: 240, y: 300 }, 90);
    const from: Endpoint = { type: "pin", id: c.components[a].pins[0] },
      to: Endpoint = { type: "pin", id: c.components[b].pins[0] };
    connect(c, from, to, route(pinPosition(c, from.id), pinPosition(c, to.id)));
    for (const zoom of [0.5, 1, 2]) {
      const hits = connectionHits(
        c,
        { x: 240 + 6 / zoom, y: 100 + 6 / zoom },
        zoom,
      );
      expect(hits).toHaveLength(2);
      expect(hits.map((h) => h.position)).toEqual([
        { x: 240, y: 100 },
        { x: 240, y: 100 },
      ]);
    }
    expect(Object.keys(c.nets)).toHaveLength(2);
    expect(c.junctions).toEqual({});
  });
});
