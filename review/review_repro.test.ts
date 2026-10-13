import { describe, it, expect } from "vitest";
import { addComponent, clone, connect, electricalGraph, emptyCircuit, type Endpoint } from "../../src/model/circuit";
import { pinPosition, route, transform } from "../../src/geometry/geometry";

const onGrid = (n: number) => n % 10 === 0;

describe("REVIEW repros", () => {
  it("R1 multi-select rotation keeps every pin/component on the 10-unit grid", () => {
    const c = emptyCircuit();
    const a = addComponent(c, "AND", { x: 100, y: 100 });
    const b = addComponent(c, "AND", { x: 130, y: 100 });
    const r = transform(c, [a, b], { x: 0, y: 0 }, 90);
    for (const k of [a, b]) {
      const p = r.geometry.components[k].position;
      expect([p.x, p.y].every(onGrid), JSON.stringify(p)).toBe(true);
    }
    for (const k of Object.keys(r.pins)) {
      const p = pinPosition(r, k);
      expect([p.x, p.y].every(onGrid), `pin ${JSON.stringify(p)}`).toBe(true);
    }
  });

  it("R2 safe move never makes a wire fold back over itself", () => {
    const c = emptyCircuit();
    const i = addComponent(c, "Input", { x: 100, y: 100 });           // out pin (140,100)
    const g = addComponent(c, "AND", { x: 300, y: 190 });              // in pin0 (260,180)
    const from: Endpoint = { type: "pin", id: c.components[i].pins[0] };
    const to: Endpoint = { type: "pin", id: c.components[g].pins[0] };
    connect(c, from, to, [{ x: 140, y: 100 }, { x: 200, y: 100 }, { x: 200, y: 180 }, { x: 260, y: 180 }]);
    const moved = transform(c, [i], { x: 0, y: 200 });                 // drag Input far below the wire's corner
    const pts = Object.values(moved.geometry.wires)[0].points;
    // consecutive collinear segments must not reverse direction
    for (let k = 2; k < pts.length; k++) {
      const [p, q, r] = [pts[k - 2], pts[k - 1], pts[k]];
      const dx1 = Math.sign(q.x - p.x), dy1 = Math.sign(q.y - p.y);
      const dx2 = Math.sign(r.x - q.x), dy2 = Math.sign(r.y - q.y);
      expect(dx1 * dx2 + dy1 * dy2, JSON.stringify(pts)).not.toBe(-1);
    }
  });

  it("R3 electricalGraph() ignores wire endpoints, so it cannot detect rewiring", () => {
    const c = emptyCircuit();
    const i = addComponent(c, "Input", { x: 0, y: 0 });
    const o1 = addComponent(c, "Output", { x: 200, y: 0 });
    const o2 = addComponent(c, "Output", { x: 200, y: 100 });
    const f: Endpoint = { type: "pin", id: c.components[i].pins[0] };
    const t: Endpoint = { type: "pin", id: c.components[o1].pins[0] };
    connect(c, f, t, route(pinPosition(c, f.id), pinPosition(c, t.id)));
    const before = electricalGraph(c);
    const bad = clone(c);
    Object.values(bad.geometry.wires)[0].to = { type: "pin", id: c.components[o2].pins[0] };
    expect(electricalGraph(bad)).toBe(before);   // passes => invariant helper is blind
  });

  it("R4 draft wire may join two output pins / duplicate an existing wire (no validation)", () => {
    const c = emptyCircuit();
    const a = addComponent(c, "Input", { x: 0, y: 0 });
    const b = addComponent(c, "Input", { x: 200, y: 0 });
    const f: Endpoint = { type: "pin", id: c.components[a].pins[0] };
    const t: Endpoint = { type: "pin", id: c.components[b].pins[0] };
    connect(c, f, t, route(pinPosition(c, f.id), pinPosition(c, t.id)));
    connect(c, f, t, route(pinPosition(c, f.id), pinPosition(c, t.id), false));
    expect(Object.keys(c.geometry.wires)).toHaveLength(2);
  });
});
