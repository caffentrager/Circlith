import { afterAll, describe, expect, it } from 'vitest';
import { addComponent, clone, emptyCircuit, gateInputCount, type Circuit, type Point } from '../src/model/circuit';
import { updateComponentProperties, type ComponentProperties } from '../src/model/component-properties';
import { connectTargets, validateCircuit } from '../src/model/connections';
import { pinPosition } from '../src/geometry/geometry';
import { componentObstacles, defaultRouting, planRoute } from '../src/geometry/routing';
import { record } from './helpers';

const props = (c: Circuit, key: string, over: Partial<ComponentProperties> = {}): ComponentProperties => {
  const comp = c.components[key];
  return { name: comp.name, inputCount: gateInputCount(comp), invertedInputs: comp.pins.filter(p => c.pins[p].direction === 'in').map(p => !!c.pins[p].inverted), ...over };
};
function link(c: Circuit, a: string, b: string, anchors: Point[] = []): Circuit {
  const from = { type: 'pin' as const, id: a }, to = { type: 'pin' as const, id: b };
  const plan = planRoute(c, pinPosition(c, a), pinPosition(c, b), defaultRouting, { from, to, anchors });
  return connectTargets(c, from, to, plan.points, anchors)!;
}
/** (wire, component) pairs whose polyline strictly crosses the component's body rectangle (no margin). */
function crossings(c: Circuit): Set<string> {
  const rects = componentObstacles(c, 0), keys = Object.keys(c.geometry.components), out = new Set<string>();
  for (const w of Object.values(c.geometry.wires)) for (let i = 1; i < w.points.length; i++) {
    const a = w.points[i - 1], b = w.points[i];
    rects.forEach((r, k) => {
      const hit = a.y === b.y ? a.y > r.top && a.y < r.bottom && Math.max(a.x, b.x) > r.left && Math.min(a.x, b.x) < r.right
        : a.x > r.left && a.x < r.right && Math.max(a.y, b.y) > r.top && Math.min(a.y, b.y) < r.bottom;
      if (hit) out.add(`${w.id}|${keys[k]}`);
    });
  }
  return out;
}
const summary: Record<string, unknown> = {};

describe('resize-induced wire/body crossings', () => {
  it('counts crossings introduced by Properties input-count changes (wire from a source around the gate)', () => {
    const rows: Record<string, number> = { scenarios: 0, validAfter: 0, introduced: 0, introducedOwnBody: 0, introducedOtherBody: 0, introducedWithBlockedReroute: 0 };
    const examples: unknown[] = [];
    const sources: Point[] = [{ x: 100, y: 300 }, { x: 150, y: 80 }, { x: 150, y: 560 }, { x: 700, y: 300 }, { x: 650, y: 80 }, { x: 400, y: 80 }, { x: 400, y: 560 }, { x: 650, y: 560 }];
    for (const rotation of [0, 90, 180, 270]) for (const src of sources) for (const [from, to] of [[2, 4], [4, 8], [8, 16], [2, 16], [3, 5]]) for (const pinIndex of [0, 1]) {
      let c = emptyCircuit();
      const k = addComponent(c, 'AND', { x: 400, y: 300 }, rotation), s = addComponent(c, 'Input', src);
      c = updateComponentProperties(c, k, props(c, k, { inputCount: from }));
      try { c = link(c, c.components[s].pins[0], c.components[k].pins[pinIndex]); } catch { continue; }
      if (validateCircuit(c).length) continue;
      rows.scenarios++;
      const before = crossings(c);
      let next: Circuit;
      try { next = updateComponentProperties(c, k, props(c, k, { inputCount: to })); } catch { continue; }
      rows.validAfter++;
      const introduced = [...crossings(next)].filter(x => !before.has(x));
      if (introduced.length) {
        rows.introduced++;
        if (introduced.some(x => x.endsWith('|' + k))) rows.introducedOwnBody++;
        if (introduced.some(x => !x.endsWith('|' + k))) rows.introducedOtherBody++;
        if (examples.length < 3) examples.push({ rotation, src, from, to, pinIndex, before: Object.values(c.geometry.wires)[0].points, after: Object.values(next.geometry.wires)[0].points });
        // Is a clean reroute actually available? planRoute with the same endpoints and no anchors.
        const w = Object.values(next.geometry.wires)[0];
        const plan = planRoute(next, w.points[0], w.points.at(-1)!, defaultRouting, { from: w.from, to: w.to });
        if (plan.blocked) rows.introducedWithBlockedReroute++;
      }
    }
    summary['resize wire/body crossings'] = { rows, examples };
    expect(rows.introduced).toBe(0);
  });
});
afterAll(() => record('collision-outcomes', summary));
void clone;
