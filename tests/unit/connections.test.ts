import { describe, it, expect } from "vitest";
import { Editor } from "../../src/editor/editor";
import { addComponent, clone, connect, electricalGraph, emptyCircuit, type ConnectionTarget, type Point } from "../../src/model/circuit";
import { connectTargets, joinCrossing, targetPosition, validateCircuit } from "../../src/model/connections";
import { endpointPosition, pinPosition, route, transform } from "../../src/geometry/geometry";
import { connectionHits } from "../../src/geometry/connection-hit";
import { simplifyPath } from "../../src/geometry/path";

function fixture() {
  const c = emptyCircuit();
  const a = addComponent(c, "Input", { x: 100, y: 100 });
  const b = addComponent(c, "Output", { x: 400, y: 200 });
  const from = { type: "pin", id: c.components[a].pins[0] } as const;
  const to = { type: "pin", id: c.components[b].pins[0] } as const;
  connect(c, from, to, route(pinPosition(c, from.id), pinPosition(c, to.id)));
  const wire = Object.keys(c.geometry.wires)[0];
  const extra = addComponent(c, "Output", { x: 600, y: 300 });
  return { c, a, b, wire, from, to, extra: { type: "pin", id: c.components[extra].pins[0] } as const };
}
function branch(c: ReturnType<typeof emptyCircuit>, from: ConnectionTarget, to: ConnectionTarget) {
  return connectTargets(c, from, to, route(targetPosition(c, from), targetPosition(c, to)))!;
}

describe("wire branch transactions", () => {
  it("splits one named wire, keeps its ID, connects a pin, and reuses the junction", () => {
    const { c, wire, extra, from, to } = fixture(), before = clone(c);
    const result = branch(c, { type: "wire", id: wire, position: { x: 240, y: 100 } }, extra);
    expect(c).toEqual(before);
    expect(validateCircuit(result)).toEqual([]);
    expect(Object.keys(result.geometry.wires)).toHaveLength(3);
    expect(result.geometry.wires[wire].from).toEqual(from);
    const junction = Object.keys(result.junctions)[0];
    expect(result.geometry.wires[wire].to).toEqual({ type: "junction", id: junction });
    const net = Object.values(result.nets)[0];
    expect(net.pins.sort()).toEqual([from.id, to.id, extra.id].sort());
    const next = branch(result, { type: "junction", id: junction }, to);
    expect(Object.keys(next.junctions)).toEqual([junction]); expect(validateCircuit(next)).toEqual([]);
  });
  it("merges two nets via middle-to-middle wire, and splits the same wire twice in either order", () => {
    const { c, wire, extra } = fixture();
    const otherInput = addComponent(c, "Input", { x: 100, y: 400 });
    const otherPin = { type: "pin", id: c.components[otherInput].pins[0] } as const;
    connect(c, otherPin, extra, route(pinPosition(c, otherPin.id), pinPosition(c, extra.id)));
    const otherWire = Object.keys(c.geometry.wires)[1];
    const joined = branch(c, { type: "wire", id: wire, position: { x: 240, y: 100 } },
      { type: "wire", id: otherWire, position: { x: 300, y: 400 } });
    expect(Object.keys(joined.nets)).toHaveLength(1); expect(Object.keys(joined.junctions)).toHaveLength(2);
    expect(Object.keys(joined.geometry.wires)).toHaveLength(5); expect(validateCircuit(joined)).toEqual([]);
    for (const [x1, x2] of [[180, 300], [300, 180]]) {
      const from = { type: "wire", id: wire, position: { x: x1, y: 100 } } as const;
      const to = { type: "wire", id: wire, position: { x: x2, y: 100 } } as const;
      const cycle = connectTargets(c, from, to, [from.position, { x: x1, y: 60 }, { x: x2, y: 60 }, to.position])!;
      expect(Object.keys(cycle.junctions)).toHaveLength(2); expect(validateCircuit(cycle)).toEqual([]);
    }
  });
  it("cancels without creating junctions or invalidating Redo; one Undo restores splits, nets and IDs", () => {
    const { c, wire, extra } = fixture(), e = new Editor(); e.circuit = c;
    const before = clone(c), target = { type: "wire", id: wire, position: { x: 240, y: 100 } } as const;
    e.startWire(target); e.update({ x: 240, y: 250 }); e.escape();
    expect(e.circuit).toEqual(before); expect(e.history).toHaveLength(0);
    e.startWire(target); e.confirm(extra); const after = clone(e.circuit);
    expect(e.history).toHaveLength(1); expect(validateCircuit(after)).toEqual([]);
    e.undo(); expect(e.circuit).toEqual(before);
    e.startWire(target); e.update({ x: 240, y: 250 }); e.undo();
    expect(e.future).toHaveLength(1); expect(e.circuit).toEqual(before);
    e.redo(); expect(e.circuit).toEqual(after);
    e.selection = [wire]; e.selectNet(); expect(e.selection).toHaveLength(3);
  });
  it("reuses endpoints, rejects invalid targets without mutation, and catches broken ownership", () => {
    const { c, wire, extra, from } = fixture(), before = clone(c);
    const result = branch(c, { type: "wire", id: wire, position: pinPosition(c, from.id) }, extra);
    expect(Object.keys(result.junctions)).toHaveLength(0); expect(validateCircuit(result)).toEqual([]);
    expect(() => branch(c, { type: "wire", id: wire, position: { x: 200, y: 110 } }, extra)).toThrow();
    expect(c).toEqual(before);
    const corrupt = clone(result); corrupt.geometry.wires[wire].net = "missing";
    expect(validateCircuit(corrupt).length).toBeGreaterThan(0);
    const disconnected = clone(result); delete disconnected.geometry.wires[Object.keys(disconnected.geometry.wires)[1]];
    expect(validateCircuit(disconnected)).toContain("실제 배선과 연결망 불일치");
  });
});

describe("crossings and cleanup", () => {
  it("leaves geometric crossings separate until explicit join; one junction connects four segments", () => {
    const { c, wire } = fixture();
    const a = addComponent(c, "Input", { x: 240, y: 40 }, 90);
    const b = addComponent(c, "Output", { x: 240, y: 300 }, 90);
    const from = { type: "pin", id: c.components[a].pins[0] } as const, to = { type: "pin", id: c.components[b].pins[0] } as const;
    connect(c, from, to, route(pinPosition(c, from.id), pinPosition(c, to.id)));
    const other = Object.keys(c.geometry.wires)[1];
    expect(Object.keys(c.nets)).toHaveLength(2); expect(Object.keys(c.junctions)).toHaveLength(0);
    const hits = connectionHits(c, { x: 240, y: 100 }, 1);
    expect(hits).toHaveLength(2);
    const before = clone(c), after = joinCrossing(c, hits.map((h) => h.target));
    expect(c).toEqual(before); expect(Object.keys(after.nets)).toHaveLength(1);
    expect(Object.keys(after.geometry.wires)).toHaveLength(4); expect(Object.keys(after.junctions)).toHaveLength(1);
    expect(validateCircuit(after)).toEqual([]);
    expect(connectionHits(after, { x: 240, y: 100 }, 1)[0].target.type).toBe("junction");
    const e = new Editor(); e.circuit = c; e.joinWires(hits.map((h) => h.target)); e.undo(); expect(e.circuit).toEqual(before);
    expect(() => joinCrossing(c, [{ type: "wire", id: wire, position: { x: 140, y: 100 } }, { type: "wire", id: other, position: { x: 140, y: 100 } }])).toThrow();
  });
  it("normalizes the reported spur after component stretch while keeping actual branch endpoints", () => {
    const { c, a, wire, extra } = fixture();
    c.geometry.wires[wire].points = [{ x: 140, y: 100 }, { x: 200, y: 100 }, { x: 200, y: 200 }, { x: 360, y: 200 }];
    const moved = transform(c, [a], { x: 0, y: 200 });
    expect(moved.geometry.wires[wire].points).toEqual([{ x: 140, y: 300 }, { x: 200, y: 300 }, { x: 200, y: 200 }, { x: 360, y: 200 }]);
    expect(electricalGraph(moved)).toBe(electricalGraph(c)); expect(validateCircuit(moved)).toEqual([]);
    const branched = branch(c, { type: "wire", id: wire, position: { x: 180, y: 100 } }, extra);
    const j = clone(branched.geometry.junctions), changed = transform(branched, [a], { x: 100, y: 200 });
    expect(changed.geometry.junctions).toEqual(j); expect(validateCircuit(changed)).toEqual([]);
    expect(electricalGraph(changed)).toBe(electricalGraph(branched));
    const points: Point[] = [{ x: 0, y: 0 }, { x: 0, y: 100 }, { x: -30, y: 100 }, { x: 100, y: 100 }];
    expect(simplifyPath(points)).toEqual([{ x: 0, y: 0 }, { x: 0, y: 100 }, { x: 100, y: 100 }]);
  });
  it("uses nearest pins and constant screen thresholds, grid-projected segments and unique junctions", () => {
    const { c, wire } = fixture();
    for (const zoom of [.5, 1, 2]) {
      expect(connectionHits(c, { x: 220, y: 100 + 11 / zoom }, zoom)[0].target.type).toBe("wire");
      expect(connectionHits(c, { x: 220, y: 100 + 13 / zoom }, zoom)).toHaveLength(0);
    }
    const a = addComponent(c, "AND", { x: 600, y: 200 });
    expect(connectionHits(c, { x: 560, y: 188 }, .5)[0].target).toEqual({ type: "pin", id: c.components[a].pins[0] });
    const h = connectionHits(c, { x: 223, y: 101 }, 2)[0];
    expect(h.position).toEqual({ x: 220, y: 100 });
  });
  it("keeps an existing connection when pins overlap and can stretch it out again", () => {
    const { c, a, wire } = fixture();
    const collapsed = transform(c, [a], { x: 220, y: 100 });
    expect(collapsed.geometry.wires[wire].points).toEqual([{ x: 360, y: 200 }]);
    expect(validateCircuit(collapsed)).toEqual([]);
    expect(electricalGraph(collapsed)).toBe(electricalGraph(c));
    const expanded = transform(collapsed, [a], { x: -220, y: -100 });
    expect(expanded.geometry.wires[wire].points).toEqual(c.geometry.wires[wire].points);
    expect(validateCircuit(expanded)).toEqual([]);
  });
});
