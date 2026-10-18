import { describe, it } from 'vitest';
import { addComponent, clone, emptyCircuit, gateInputCount, type Circuit, type Point } from '../src/model/circuit';
import { updateComponentProperties, type ComponentProperties } from '../src/model/component-properties';
import { connectTargets, validateCircuit } from '../src/model/connections';
import { pinPosition } from '../src/geometry/geometry';
import { collidingSegments, componentObstacles, defaultRouting, planRoute } from '../src/geometry/routing';
import { record } from './helpers';

const props = (c: Circuit, key: string, over: Partial<ComponentProperties> = {}): ComponentProperties => {
  const comp = c.components[key];
  return { name: comp.name, inputCount: gateInputCount(comp),
    invertedInputs: comp.pins.filter(p => c.pins[p].direction === 'in').map(p => !!c.pins[p].inverted), ...over };
};
function link(c: Circuit, a: string, b: string, anchors: Point[] = []): Circuit {
  const from = { type: 'pin' as const, id: a }, to = { type: 'pin' as const, id: b };
  const plan = planRoute(c, pinPosition(c, a), pinPosition(c, b), defaultRouting, { from, to, anchors });
  return connectTargets(c, from, to, plan.points, anchors)!;
}
describe('probe', () => {
  it('collision examples', () => {
    const out: unknown[] = [];
    const sources: Point[] = [{ x: 100, y: 300 }, { x: 150, y: 80 }, { x: 150, y: 560 }, { x: 700, y: 300 }];
    for (const rotation of [0, 90, 180, 270]) for (const src of sources) for (const [from, to] of [[2, 4], [8, 16], [16, 3]]) {
      let c = emptyCircuit();
      const k = addComponent(c, 'AND', { x: 400, y: 300 }, rotation), s = addComponent(c, 'Input', src);
      c = updateComponentProperties(c, k, props(c, k, { inputCount: from }));
      try { c = link(c, c.components[s].pins[0], c.components[k].pins[0]); } catch { continue; }
      if (validateCircuit(c).length) continue;
      const before = clone(Object.values(c.geometry.wires)[0].points);
      const next = updateComponentProperties(c, k, props(c, k, { inputCount: to }));
      const w = Object.values(next.geometry.wires)[0];
      const hit = collidingSegments(next, w.points, 0);
      if (hit.length) {
        const rects = componentObstacles(next, 0);
        out.push({ rotation, src, from, to, before, after: w.points, hit, gateRect: rects[Object.keys(next.geometry.components).indexOf(k)] });
      }
    }
    record('probe-wire-collisions', out.slice(0, 12));
    record('probe-wire-collisions-count', out.length);
  });
  it('waypoint rejections', () => {
    const out: unknown[] = [];
    const src = { x: 100, y: 160 };
    const cases: [string, Point[], number, number, number][] = [
      ['z-shape', [{ x: 220, y: 160 }, { x: 220, y: 300 }], 16, 2, 0],
      ['near-pin', [{ x: 340, y: 300 }], 8, 3, 0],
      ['near-pin', [{ x: 340, y: 300 }], 16, 2, 1],
    ];
    for (const [name, anchors, from, to, pinIndex] of cases) {
      let c = emptyCircuit();
      const k = addComponent(c, 'AND', { x: 400, y: 300 }), s = addComponent(c, 'Input', src);
      c = updateComponentProperties(c, k, props(c, k, { inputCount: from }));
      c = link(c, c.components[s].pins[0], c.components[k].pins[pinIndex], anchors);
      const w = Object.values(c.geometry.wires)[0];
      let verdict = 'ok';
      try { updateComponentProperties(c, k, props(c, k, { inputCount: to })); } catch (e) { verdict = (e as Error).message; }
      out.push({ name, from, to, pinIndex, anchors: w.anchors, before: w.points, verdict, pinBefore: pinPosition(c, c.components[k].pins[pinIndex]) });
    }
    record('probe-waypoint-rejections', out);
  });
});
