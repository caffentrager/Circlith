import { describe, expect, it } from "vitest";
import { Editor } from "../../src/editor/editor";
import { clone, connect, emptyCircuit, addComponent, type Endpoint } from "../../src/model/circuit";
import { connectTargets, validateCircuit } from "../../src/model/connections";
import { planWireCleanup, applyWireCleanup } from "../../src/model/wire-cleanup";
import { pinPosition, route } from "../../src/geometry/geometry";

function fixture() {
  const c = emptyCircuit(), a = addComponent(c, "Input", { x: 100, y: 100 }), b = addComponent(c, "Output", { x: 500, y: 100 });
  const from: Endpoint = { type: "pin", id: c.components[a].pins[0] }, to: Endpoint = { type: "pin", id: c.components[b].pins[0] };
  connect(c, from, to, route(pinPosition(c, from.id), pinPosition(c, to.id)));
  const original = Object.keys(c.geometry.wires)[0];
  const result = connectTargets(c, { type: "wire", id: original, position: { x: 220, y: 100 } }, { type: "wire", id: original, position: { x: 340, y: 100 } },
    [{ x: 220, y: 100 }, { x: 220, y: 160 }, { x: 340, y: 160 }, { x: 340, y: 100 }], [{ x: 220, y: 160 }, { x: 340, y: 160 }])!;
  const loop = Object.values(result.geometry.wires).find((w) => w.anchors?.length)!.id;
  return { c: result, loop, original, from, to };
}

describe("duplicate wire route cleanup", () => {
  it("removes the reported detour, preserving every node and all remaining geometry exactly", () => {
    const { c, loop } = fixture(), before = clone(c), plan = planWireCleanup(c, [loop]);
    expect(plan.remove).toEqual([loop]); expect(plan.keep).toHaveLength(1);
    const result = applyWireCleanup(c, plan), expected = clone(c); delete expected.geometry.wires[loop];
    expect(result).toEqual(expected); expect(c).toEqual(before);
    expect(validateCircuit(result)).toEqual([]); expect(Object.keys(result.junctions)).toHaveLength(2);
  });
  it("treats reverse directions as duplicates, keeps original equal routes and batches multiple copies", () => {
    const { c, loop } = fixture(), base = c.geometry.wires[planWireCleanup(c, [loop]).keep[0]];
    connect(c, base.to, base.from, [...base.points].reverse());
    const extra = Object.keys(c.geometry.wires).at(-1)!;
    const plan = planWireCleanup(c, [base.id]);
    expect(plan.keep).toEqual([base.id]); expect(new Set(plan.remove)).toEqual(new Set([loop, extra]));
    expect(planWireCleanup(c, [base.id, loop, extra])).toEqual(plan);
    expect(validateCircuit(applyWireCleanup(c, plan))).toEqual([]);
  });
  it("preserves a detour with a real middle branch and does not delete arbitrary cycles", () => {
    const { c, loop } = fixture(), extra = addComponent(c, "Output", { x: 500, y: 300 });
    const to: Endpoint = { type: "pin", id: c.components[extra].pins[0] };
    const branched = connectTargets(c, { type: "wire", id: loop, position: { x: 280, y: 160 } }, to,
      route({ x: 280, y: 160 }, pinPosition(c, to.id)))!;
    expect(planWireCleanup(branched, Object.keys(branched.geometry.wires))).toEqual({ remove: [], keep: [] });
    expect(validateCircuit(branched)).toEqual([]);
  });
  it("limits cleanup to selected nets and never merges coordinate-coincident endpoint IDs", () => {
    const { c, loop, from, to } = fixture();
    const x = addComponent(c, "Input", { x: 100, y: 100 }), y = addComponent(c, "Output", { x: 500, y: 100 });
    const p: Endpoint = { type: "pin", id: c.components[x].pins[0] }, q: Endpoint = { type: "pin", id: c.components[y].pins[0] };
    connect(c, p, q, route(pinPosition(c, p.id), pinPosition(c, q.id))); const other = Object.keys(c.geometry.wires).at(-1)!;
    expect(planWireCleanup(c, [other])).toEqual({ remove: [], keep: [] });
    const cleaned = applyWireCleanup(c, planWireCleanup(c, [loop]));
    expect(cleaned.geometry.wires[other]).toEqual(c.geometry.wires[other]); expect(Object.keys(cleaned.nets)).toHaveLength(2);
    // Even after an explicit net merge, matching positions do not equate different pins.
    connect(c, from, p, [pinPosition(c, from.id)]); connect(c, to, q, [pinPosition(c, to.id)]);
    expect(planWireCleanup(c, [other]).remove).toEqual([loop]);
    expect(validateCircuit(applyWireCleanup(c, planWireCleanup(c, [other])))).toEqual([]);
  });
  it("retains a longer obstacle-free path instead of the straight route through a component", () => {
    const { c, loop } = fixture(), straight = planWireCleanup(c, [loop]).keep[0];
    addComponent(c, "AND", { x: 280, y: 100 });
    const plan = planWireCleanup(c, [loop]); expect(plan.keep).toEqual([loop]); expect(plan.remove).toEqual([straight]);
    expect(validateCircuit(applyWireCleanup(c, plan))).toEqual([]);
  });
  it("rejects stale or forged bridge removal without mutation", () => {
    const { c, loop, original } = fixture(), before = clone(c), plan = planWireCleanup(c, [loop]);
    for (const remove of [[original], [loop, loop], [loop, original], ["missing"]])
      expect(() => applyWireCleanup(c, { ...plan, remove })).toThrow();
    expect(c).toEqual(before);
  });
  it("previews without mutations, cancels without discarding Redo, and commits one exact Undo/Redo", () => {
    const { c, loop } = fixture(), e = new Editor(), before = clone(c); e.circuit = c; e.selection = [loop];
    expect(e.beginWireCleanup()).toBe(1); expect(e.operation).toBe("WIRE_CLEANUP");
    expect(e.preview()).toEqual(before); expect(e.circuit).toEqual(before); expect(e.history).toHaveLength(0);
    e.escape(); expect(e.circuit).toEqual(before);
    e.beginWireCleanup(); e.confirm(); const after = clone(e.circuit);
    expect(e.history).toHaveLength(1); expect(e.selection.every((key) => !!after.geometry.wires[key])).toBe(true);
    e.undo(); expect(e.circuit).toEqual(before); e.selection = [loop]; e.beginWireCleanup(); e.undo();
    expect(e.circuit).toEqual(before); expect(e.future).toHaveLength(1); e.redo(); expect(e.circuit).toEqual(after);
    expect(e.beginWireCleanup()).toBe(0); expect(e.draft).toBeNull(); expect(e.history).toHaveLength(1);
  });
});
