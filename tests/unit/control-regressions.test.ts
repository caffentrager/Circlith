import { describe, expect, it } from "vitest";
import { Editor } from "../../src/editor/editor";
import { addComponent, clone, connect, emptyCircuit } from "../../src/model/circuit";
import { projectSegment } from "../../src/geometry/path";
import { connectionHits } from "../../src/geometry/connection-hit";
import { joinCrossing, validateCircuit } from "../../src/model/connections";
import { pinPosition } from "../../src/geometry/geometry";
import { fitView, MIN_ZOOM, MAX_ZOOM, wheelZoomFactor, zoomView, ZOOM_STEP } from "../../src/geometry/view";

describe("audit coordinate and operation regressions", () => {
  it("preserves clamped grid coordinates exactly for either orthogonal direction", () => {
    for (let start = -870; start <= 870; start += 30) for (let end = -870; end <= 870; end += 50) for (const q of [-900, -380, 0, 190, 380, 900]) {
      const expected = Math.max(Math.min(start, end), Math.min(Math.max(start, end), q));
      expect(projectSegment({ x: start, y: 540 }, { x: end, y: 540 }, { x: q, y: 542 })).toEqual({ x: expected, y: 540 });
      if (start !== end) expect(projectSegment({ x: 540, y: start }, { x: 540, y: end }, { x: 542, y: q })).toEqual({ x: 540, y: expected });
    }
    expect(projectSegment({ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 1.25, y: 3 })).toEqual({ x: 1.25, y: 0 });
    expect(projectSegment({ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 })).toEqual({ x: 5, y: 5 });
  });
  it("joins the reported reversed-wire crossing at exactly one shared junction", () => {
    const c = emptyCircuit();
    for (const [net, points] of [["h", [{ x: 870, y: 540 }, { x: 30, y: 540 }]], ["v", [{ x: 380, y: 100 }, { x: 380, y: 900 }]]] as const) {
      const ids = [net + "a", net + "b"]; c.nets[net] = { id: net, pins: [], junctions: ids };
      ids.forEach((id, i) => { c.junctions[id] = { id, net }; c.geometry.junctions[id] = { ...points[i] }; });
      c.geometry.wires[net + "w"] = { id: net + "w", net, from: { type: "junction", id: ids[0] }, to: { type: "junction", id: ids[1] }, points: points.map((p) => ({ ...p })) };
    }
    const hits = connectionHits(c, { x: 380, y: 540 }, 1);
    expect(hits).toHaveLength(2); expect(hits.map((h) => h.position)).toEqual([{ x: 380, y: 540 }, { x: 380, y: 540 }]);
    const after = joinCrossing(c, hits.map((h) => h.target));
    expect(validateCircuit(after)).toEqual([]); expect(Object.keys(after.nets)).toHaveLength(1); expect(Object.keys(after.geometry.wires)).toHaveLength(4);
    expect(Object.values(after.geometry.wires).every((w) => w.points.every((p) => Number.isInteger(p.x) && Number.isInteger(p.y)))).toBe(true);
  });
  it("discards a failed one-shot rotation, retaining the circuit, selection and Redo", () => {
    for (const clockwise of [false, true]) {
      const e = new Editor(), c = emptyCircuit(), gate = addComponent(c, "AND", { x: 100, y: 100 }), output = addComponent(c, "Output", { x: 500, y: 100 });
      const from = { type: "pin", id: c.components[gate].pins[2] } as const, to = { type: "pin", id: c.components[output].pins[0] } as const;
      connect(c, from, to, [pinPosition(c, from.id), { x: 140, y: 130 }, { x: 100, y: 130 }, { x: 100, y: 200 }, { x: 460, y: 200 }, pinPosition(c, to.id)], [{ x: 100, y: 130 }]);
      expect(validateCircuit(c)).toEqual([]); e.circuit = c;
      e.place("Input", { x: 900, y: 900 }); e.confirm(); e.undo(); e.selection = [gate];
      const before = clone(e.circuit), future = clone(e.future);
      expect(() => e.rotate(clockwise)).toThrow(); expect(e.operation).toBe("NONE");
      e.update({ x: 350, y: 250 }); expect(e.preview()).toEqual(before); expect(e.circuit).toEqual(before);
      expect(e.selection).toEqual([gate]); expect(e.history).toHaveLength(0); expect(e.future).toEqual(future);
    }
  });
});

describe("normalized zoom", () => {
  it("scales with total wheel distance, supports reverse/line/page input and bounds single impulses", () => {
    const whole = wheelZoomFactor(-100, 0, 700), small = wheelZoomFactor(-10, 0, 700);
    expect(whole).toBeCloseTo(1.1, 12); expect(small ** 10).toBeCloseTo(whole, 12);
    expect(wheelZoomFactor(-1, 0, 700)).toBeLessThan(1.002);
    expect(wheelZoomFactor(-1, 1, 700)).toBe(wheelZoomFactor(-16, 0, 700));
    expect(wheelZoomFactor(-1, 2, 700)).toBe(wheelZoomFactor(-240, 0, 700));
    expect(wheelZoomFactor(-100, 0, 700, true)).toBeCloseTo(1 / whole, 12);
  });
  it("ignores zero/nonfinite deltas and keeps the drawing coordinate under the zoom anchor", () => {
    const view = { x: 40, y: -30, zoom: 0.3 }, anchor = { x: 320, y: 200 };
    for (const delta of [0, NaN, Infinity, -Infinity]) expect(zoomView(view, wheelZoomFactor(delta, 0, 700), anchor)).toBe(view);
    const next = zoomView(view, 1.1, anchor);
    expect((anchor.x - next.x) / next.zoom).toBeCloseTo((anchor.x - view.x) / view.zoom, 10);
    expect((anchor.y - next.y) / next.zoom).toBeCloseTo((anchor.y - view.y) / view.zoom, 10);
  });
  it("uses one range for fit and manual zoom without a jump at 50%", () => {
    const c = emptyCircuit(); addComponent(c, "Input", { x: 0, y: 0 }); addComponent(c, "Output", { x: 3000, y: 0 });
    const fit = fitView(c, 860, 690)!;
    expect(fit.zoom).toBeLessThan(0.5);
    expect(zoomView(fit, 1 / ZOOM_STEP, { x: 400, y: 300 }).zoom).toBeLessThan(fit.zoom);
    expect(zoomView(fit, ZOOM_STEP, { x: 400, y: 300 }).zoom).toBeCloseTo(fit.zoom * ZOOM_STEP, 10);
    expect(zoomView(fit, 1e-10, { x: 0, y: 0 }).zoom).toBe(MIN_ZOOM);
    expect(zoomView(fit, 1e10, { x: 0, y: 0 }).zoom).toBe(MAX_ZOOM);
  });
});
