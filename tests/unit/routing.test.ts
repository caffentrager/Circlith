import { describe, expect, it } from "vitest";
import { Editor } from "../../src/editor/editor";
import { collidingSegments, defaultRouting, planRoute, validateRouting } from "../../src/geometry/routing";
import { endpointPosition, pinPosition, route } from "../../src/geometry/geometry";
import { anchorOffsets, pointOnSegment } from "../../src/geometry/path";
import { addComponent, clone, connect, electricalGraph, emptyCircuit, type Endpoint } from "../../src/model/circuit";
import { connectTargets, validateCircuit } from "../../src/model/connections";

function fixture() {
  const c = emptyCircuit(), a = addComponent(c, "Input", { x: 100, y: 200 }), b = addComponent(c, "Output", { x: 500, y: 200 });
  const from: Endpoint = { type: "pin", id: c.components[a].pins[0] }, to: Endpoint = { type: "pin", id: c.components[b].pins[0] };
  return { c, a, b, from, to, start: pinPosition(c, from.id), end: pinPosition(c, to.id) };
}
describe("routing policy", () => {
  it("avoids multiple rotated bodies deterministically while retaining endpoints and orthogonality", () => {
    const { c, from, to, start, end } = fixture();
    for (const [x, y, rotation] of [[240, 200, 0], [340, 180, 90], [390, 240, 270]]) addComponent(c, "AND", { x, y }, rotation);
    const before = clone(c);
    for (const pathMode of ["smart", "horizontal", "vertical"] as const) {
      const settings = { ...defaultRouting, pathMode }, result = planRoute(c, start, end, settings, { from, to });
      expect(result.blocked).toBe(false); expect(collidingSegments(c, result.points, 10)).toEqual([]);
      expect(result.points[0]).toEqual(start); expect(result.points.at(-1)).toEqual(end);
      expect(result).toEqual(planRoute(c, start, end, settings, { from, to }));
      const connected = connectTargets(c, from, to, result.points)!;
      expect(validateCircuit(connected)).toEqual([]);
    }
    expect(c).toEqual(before);
  });
  it("distinguishes horizontal/vertical, chooses dominant smart axis, and warns without blocking", () => {
    const c = emptyCircuit(), a = { x: 0, y: 0 }, b = { x: 60, y: 180 };
    expect(planRoute(c, a, b, defaultRouting).points).toEqual(route(a, b, false));
    expect(planRoute(c, a, b, { ...defaultRouting, pathMode: "horizontal" }).points).toEqual(route(a, b, true));
    expect(planRoute(c, a, b, { ...defaultRouting, pathMode: "vertical" }).points).toEqual(route(a, b, false));
    addComponent(c, "AND", { x: 30, y: 0 });
    const warn = planRoute(c, a, b, { ...defaultRouting, pathMode: "horizontal", overlapMode: "warn" });
    expect(warn.blocked).toBe(false); expect(warn.collisions.length).toBeGreaterThan(0);
  });
  it("preserves explicit anchors including retraced anchors and reports an anchor trapped in a body", () => {
    const { c, from, to, start, end } = fixture(), anchors = [{ x: 200, y: 300 }, { x: 180, y: 300 }];
    const result = planRoute(c, start, end, defaultRouting, { from, to, anchors });
    for (const a of anchors) expect(result.points.some((p, i) => i > 0 && pointOnSegment(result.points[i - 1], p, a))).toBe(true);
    expect(validateCircuit(connectTargets(c, from, to, result.points, anchors)!)).toEqual([]);
    addComponent(c, "AND", anchors[0]);
    expect(planRoute(c, start, end, defaultRouting, { from, to, anchors }).blocked).toBe(true);
  });
  it("uses rotated pin normals and treats wire crossings as unconnected geometry", () => {
    const { c, a, from, to } = fixture(); c.geometry.components[a].rotation = 270;
    const start = pinPosition(c, from.id), end = pinPosition(c, to.id);
    const r = planRoute(c, start, end, defaultRouting, { from, to });
    expect(r.blocked).toBe(false); expect(r.points[1].x).toBe(start.x); expect(r.points[1].y).toBeLessThan(start.y);
    const next = connectTargets(c, from, to, r.points)!;
    expect(Object.keys(next.junctions)).toHaveLength(0); expect(validateCircuit(next)).toEqual([]);
  });
  it("retains the order of retraced anchors and assigns them to the correct side of a branch split", () => {
    expect(anchorOffsets([{ x: 0, y: 0 }, { x: 100, y: 0 }], [{ x: 80, y: 0 }, { x: 20, y: 0 }])).toBeNull();
    const { c, from, to, start, end } = fixture(), anchors = [{ x: 320, y: 200 }, { x: 250, y: 200 }];
    const planned = planRoute(c, start, end, { ...defaultRouting, pathMode: "horizontal" }, { anchors });
    expect(anchorOffsets(planned.points, anchors)).not.toBeNull();
    const wired = connectTargets(c, from, to, planned.points, anchors)!, key = Object.keys(wired.geometry.wires)[0];
    const input = addComponent(wired, "Input", { x: 100, y: 100 }), pin: Endpoint = { type: "pin", id: wired.components[input].pins[0] };
    const joined = connectTargets(wired, pin, { type: "wire", id: key, position: { x: 300, y: 200 } }, route(pinPosition(wired, pin.id), { x: 300, y: 200 }))!;
    expect(validateCircuit(joined)).toEqual([]); expect(joined.geometry.wires[key].anchors).toEqual([]);
    expect(Object.values(joined.geometry.wires).find((w) => w.anchors?.length === 2)?.anchors).toEqual(anchors);
  });
  it("rejects invalid stored policies", () => {
    for (const bad of [null, {}, { ...defaultRouting, version: 2 }, { ...defaultRouting, pathMode: "bad" }]) expect(() => validateRouting(bad)).toThrow();
    expect(validateRouting(defaultRouting)).toEqual(defaultRouting);
  });
  it("reports bounded-search failure instead of silently accepting an obstructed route", () => {
    const { c, from, to, start, end } = fixture(); addComponent(c, "AND", { x: 300, y: 200 });
    for (let i = 0; i < 100; i++) addComponent(c, "AND", { x: 1000 + i * 100, y: 1000 + i * 100 });
    expect(planRoute(c, start, end, defaultRouting, { from, to }).blocked).toBe(true);
  });
});
describe("combined move and rotation", () => {
  it("previews repeated R and Shift+R from the original and commits one exact Undo/Redo", () => {
    const { c, a, from, to, start, end } = fixture(); connect(c, from, to, route(start, end));
    addComponent(c, "AND", { x: 300, y: 280 });
    const e = new Editor(); e.circuit = c; e.selection = [a]; const before = clone(c), graph = electricalGraph(c);
    e.move({ x: 100, y: 200 }); e.update({ x: 160, y: 250 }); e.rotate(); e.rotate(); e.rotate(true);
    const result = e.previewResult();
    expect(result.blocked).toBe(false); expect(e.circuit).toEqual(before); expect(e.history).toHaveLength(0);
    expect(result.circuit.geometry.components[a]).toEqual({ position: { x: 160, y: 250 }, rotation: 270 });
    expect(electricalGraph(result.circuit)).toBe(graph); expect(validateCircuit(result.circuit)).toEqual([]);
    expect(collidingSegments(result.circuit, Object.values(result.circuit.geometry.wires)[0].points)).toEqual([]);
    e.confirm(); expect(e.history).toHaveLength(1); e.undo(); expect(e.circuit).toEqual(before); e.redo(); expect(e.circuit).toEqual(result.circuit);
    e.move({ x: 0, y: 0 }); e.rotate(); e.update({ x: 40, y: 50 }); e.cancel(); expect(e.circuit).toEqual(result.circuit);
  });
  it("reroutes a stationary wire when an unrelated component is dragged over it, keeping the graph", () => {
    const { c, from, to, start, end } = fixture(); connect(c, from, to, route(start, end));
    const obstacle = addComponent(c, "AND", { x: 300, y: 100 });
    const e = new Editor(); e.circuit = c; e.selection = [obstacle];
    e.move({ x: 300, y: 100 }); e.update({ x: 300, y: 200 });
    const next = e.previewResult(); expect(next.blocked).toBe(false);
    expect(electricalGraph(next.circuit)).toBe(electricalGraph(c));
    expect(collidingSegments(next.circuit, Object.values(next.circuit.geometry.wires)[0].points, 10)).toEqual([]);
    expect(validateCircuit(next.circuit)).toEqual([]);
  });
  it("keeps manually fixed points and leaves blocked edits cancellable without history mutation", () => {
    const { c, a, from, to, start, end } = fixture(), anchors = [{ x: 250, y: 300 }];
    const planned = planRoute(c, start, end, defaultRouting, { from, to, anchors });
    const e = new Editor(); e.circuit = connectTargets(c, from, to, planned.points, anchors)!;
    const obstacle = addComponent(e.circuit, "AND", { x: 250, y: 400 }), before = clone(e.circuit);
    e.selection = [obstacle]; e.move({ x: 250, y: 400 }); e.update(anchors[0]); e.rotate();
    expect(e.previewResult().blocked).toBe(true); expect(() => e.confirm()).toThrow();
    expect(e.circuit).toEqual(before); expect(e.history).toHaveLength(0); e.cancel();
    e.selection = [a]; e.move({ x: 0, y: 0 }); e.update({ x: 0, y: 20 });
    const moved = e.preview();
    expect(Object.values(moved.geometry.wires)[0].anchors).toEqual(anchors);
    expect(validateCircuit(moved)).toEqual([]);
    expect(endpointPosition(moved, from)).toEqual(pinPosition(moved, from.id));
  });
});
