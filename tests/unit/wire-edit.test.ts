import { describe, expect, it } from "vitest";
import { Editor } from "../../src/editor/editor";
import { editWirePath, replaceWirePath, simplifyPath } from "../../src/geometry/wire-edit";
import { endpointPosition } from "../../src/geometry/geometry";
import { addComponent, clone, connect, electricalGraph, emptyCircuit, type Point } from "../../src/model/circuit";

function fixture(points: Point[] = [{ x: 140, y: 100 }, { x: 240, y: 100 }, { x: 240, y: 200 }, { x: 360, y: 200 }, { x: 360, y: 300 }]) {
  const c = emptyCircuit();
  const a = addComponent(c, "Input", { x: 100, y: 100 });
  const b = addComponent(c, "Output", { x: 400, y: 300 });
  connect(c, { type: "pin", id: c.components[a].pins[0] }, { type: "pin", id: c.components[b].pins[0] }, points);
  const wire = Object.keys(c.geometry.wires)[0];
  const editor = new Editor(); editor.circuit = c; editor.selection = [wire];
  return { c, wire, editor };
}

function valid(c: ReturnType<typeof emptyCircuit>, wire: string) {
  const w = c.geometry.wires[wire];
  expect(w.points[0]).toEqual(endpointPosition(c, w.from));
  expect(w.points.at(-1)).toEqual(endpointPosition(c, w.to));
  for (let i = 1; i < w.points.length; i++) {
    const a = w.points[i - 1], b = w.points[i];
    expect(a.x === b.x || a.y === b.y).toBe(true);
    expect(a).not.toEqual(b);
  }
}

describe("wire geometry", () => {
  it("moves every segment/corner and adds jogs without changing endpoints or electrical graph", () => {
    const { c, wire } = fixture();
    const original = clone(c), points = c.geometry.wires[wire].points;
    for (const kind of ["segment", "corner", "jog"] as const)
      for (let index = kind === "corner" ? 1 : 0; index < points.length - 1; index++)
        for (const x of [-300, -10, 0, 20, 300])
          for (const y of [-300, -10, 0, 20, 300]) {
            const result = editWirePath(points, index, kind, { x, y });
            const after = replaceWirePath(c, wire, result);
            valid(after, wire);
            expect(electricalGraph(after)).toBe(electricalGraph(c));
            expect(editWirePath(points, index, kind, { x, y })).toEqual(result);
          }
    expect(c).toEqual(original);
  });
  it("handles straight/short/reversed segments and removes zero-length and collinear points", () => {
    for (const points of [
      [{ x: 0, y: 0 }, { x: 100, y: 0 }],
      [{ x: 0, y: 0 }, { x: 0, y: 100 }],
      [{ x: 100, y: 0 }, { x: 0, y: 0 }],
      [{ x: 0, y: 100 }, { x: 0, y: 0 }],
    ]) {
      for (const kind of ["segment", "jog"] as const) {
        const result = editWirePath(points, 0, kind, { x: 20, y: 30 });
        expect(result[0]).toEqual(points[0]);
        expect(result.at(-1)).toEqual(points.at(-1));
        expect(result.length).toBeGreaterThan(2);
      }
    }
    const short = [{ x: 0, y: 0 }, { x: 20, y: 0 }];
    expect(editWirePath(short, 0, "jog", { x: 0, y: 30 })).toEqual(short);
    expect(simplifyPath([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 }])).toEqual([{ x: 0, y: 0 }, { x: 20, y: 0 }]);
  });
  it("rejects disconnected, diagonal, nonfinite and collapsed routes; graph fingerprint detects endpoint changes", () => {
    const { c, wire } = fixture();
    for (const points of [[], [{ x: 0, y: 0 }, { x: 360, y: 300 }],
      [{ x: 140, y: 100 }, { x: 360, y: 300 }],
      [{ x: 140, y: 100 }, { x: Infinity, y: 100 }, { x: 360, y: 300 }]])
      expect(() => replaceWirePath(c, wire, points)).toThrow();
    const corrupt = clone(c);
    corrupt.geometry.wires[wire].to = corrupt.geometry.wires[wire].from;
    expect(electricalGraph(corrupt)).not.toBe(electricalGraph(c));
  });
});

describe("wire history", () => {
  it("previews safely, commits once, restores exact paths and cancels without losing Redo", () => {
    const { c, wire, editor: e } = fixture(); const before = clone(c);
    e.beginWireEdit(wire, 1, "segment", { x: 240, y: 150 });
    e.update({ x: 280, y: 150 });
    expect(e.circuit).toEqual(before);
    const after = e.preview(); valid(after, wire);
    e.confirm(); expect(e.history).toHaveLength(1);
    expect(e.circuit).toEqual(after);
    e.undo(); expect(e.circuit).toEqual(before);
    e.beginWireEdit(wire, 0, "jog", { x: 180, y: 100 });
    e.update({ x: 180, y: 200 }); e.undo();
    expect(e.circuit).toEqual(before); expect(e.future).toHaveLength(1);
    e.redo(); expect(e.circuit).toEqual(after);
    e.beginWireEdit(wire, 0, "segment", { x: 0, y: 0 });
    e.confirm(); expect(e.history).toHaveLength(1);
  });
  it("redraws fixed endpoints, supports waypoint backtracking, and tidies multiple wires in one Undo", () => {
    const { c, wire, editor: e } = fixture(); const before = clone(c);
    e.rerouteWire(wire); e.update({ x: 200, y: 220 }); e.waypoint();
    const checkpoint = clone(e.draft);
    e.update({ x: 300, y: 250 }); e.waypoint(); e.backspace();
    expect(e.draft && "waypoints" in e.draft && e.draft.waypoints).toEqual(checkpoint && "waypoints" in checkpoint && checkpoint.waypoints);
    expect(e.circuit).toEqual(before);
    valid(e.preview(), wire); e.confirm(); expect(e.history).toHaveLength(1);
    e.undo(); expect(e.circuit).toEqual(before);
    const w = c.geometry.wires[wire]; connect(e.circuit, w.from, w.to, w.points);
    e.selection = Object.keys(e.circuit.geometry.wires);
    const both = clone(e.circuit);
    e.tidyWires(false); expect(e.history).toHaveLength(1);
    for (const key of e.selection) valid(e.circuit, key);
    expect(electricalGraph(e.circuit)).toBe(electricalGraph(both));
    e.undo(); expect(e.circuit).toEqual(both);
  });
});
