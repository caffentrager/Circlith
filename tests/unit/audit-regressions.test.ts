// Regression tests for the 2026-10-18 independent audit (qa-audit/20261018). Each block names the finding it guards.
import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { addComponent, clone, connect, emptyCircuit, gateInputCount, inputY, type Circuit, type Kind, type Point } from '../../src/model/circuit';
import { updateComponentProperties, type ComponentProperties } from '../../src/model/component-properties';
import { connectTargets, validateCircuit } from '../../src/model/connections';
import { pinPosition, route } from '../../src/geometry/geometry';
import { componentObstacles, defaultRouting, planRoute } from '../../src/geometry/routing';
import { compileCircuit, simulate } from '../../src/simulation/simulator';
import type { LogicValue } from '../../src/simulation/logic';
import { GateBody } from '../../src/renderer/GateBody';

const values: LogicValue[] = ['0', '1', 'X', 'Z'];
function inverterWithSpare() {
  const c = emptyCircuit();
  const a = addComponent(c, 'Input', { x: 100, y: 100 }), b = addComponent(c, 'Input', { x: 100, y: 300 });
  const n = addComponent(c, 'NOT', { x: 300, y: 100 }), o = addComponent(c, 'Output', { x: 500, y: 100 });
  const wire = (from: string, to: string) => connect(c, { type: 'pin', id: from }, { type: 'pin', id: to }, route(pinPosition(c, from), pinPosition(c, to)));
  wire(c.components[a].pins[0], c.components[n].pins[0]); wire(c.components[n].pins[1], c.components[o].pins[0]);
  return { c, a, b, n, o };
}
const renameAll = (c: Circuit, from: string, to: string): Circuit => JSON.parse(JSON.stringify(c).split(JSON.stringify(from)).join(JSON.stringify(to)));
const props = (c: Circuit, key: string, over: Partial<ComponentProperties> = {}): ComponentProperties => {
  const comp = c.components[key];
  return { name: comp.name, inputCount: gateInputCount(comp), invertedInputs: comp.pins.filter(p => c.pins[p].direction === 'in').map(p => !!c.pins[p].inverted), ...over };
};
function link(c: Circuit, a: string, b: string, anchors: Point[] = []): Circuit {
  const from = { type: 'pin' as const, id: a }, to = { type: 'pin' as const, id: b };
  const plan = planRoute(c, pinPosition(c, a), pinPosition(c, b), defaultRouting, { from, to, anchors });
  return connectTargets(c, from, to, plan.points, anchors)!;
}

describe('F1: real net IDs never collide with synthetic floating-pin signals', () => {
  it.each(['pin:', 'junction:', 'net:', 'x-', 'pin:pin:'])('net id "%s<floating pin id>" keeps NOT semantics for every input pair', prefix => {
    const { c, a, b, o } = inverterWithSpare();
    const renamed = renameAll(c, Object.keys(c.nets)[0], `${prefix}${c.components[b].pins[0]}`);
    expect(validateCircuit(renamed)).toEqual([]);
    const plan = compileCircuit(renamed);
    for (const va of values) for (const vb of values) {
      const result = simulate(plan, { [a]: va, [b]: vb });
      expect(result.outputs[o]).toBe(va === '0' ? '1' : va === '1' ? '0' : 'X');
      for (const pin of Object.keys(renamed.pins)) expect(result.pins).toHaveProperty([pin]);
    }
  });
});

describe('F3: malformed records are reported, never thrown', () => {
  const mutations: Record<string, (c: Circuit, f: ReturnType<typeof inverterWithSpare>) => void> = {
    'component record deleted, pins and wires kept': (c, f) => { delete c.components[f.n]; },
    'component is null': (c, f) => { (c.components as Record<string, unknown>)[f.n] = null; },
    'component.pins undefined': (c, f) => { (c.components[f.n] as { pins?: string[] }).pins = undefined; },
    'geometry missing': c => { (c as { geometry?: unknown }).geometry = undefined; },
    'geometry.components missing': c => { (c.geometry as { components?: unknown }).components = undefined; },
    'components / pins / nets missing': c => { (c as { components?: unknown }).components = undefined; (c as { pins?: unknown }).pins = undefined; (c as { nets?: unknown }).nets = undefined; },
    'net.pins undefined': c => { (Object.values(c.nets)[0] as { pins?: string[] }).pins = undefined; },
    'wire endpoint undefined': c => { (Object.values(c.geometry.wires)[0] as { from?: unknown }).from = undefined; },
    'wire.points undefined': c => { (Object.values(c.geometry.wires)[0] as { points?: unknown }).points = undefined; },
    'wire.points contains null': c => { (Object.values(c.geometry.wires)[0].points as unknown[])[0] = null; },
  };
  for (const [name, mutate] of Object.entries(mutations)) it(name, () => {
    const f = inverterWithSpare(), c = clone(f.c);
    mutate(c, f);
    expect(() => validateCircuit(c)).not.toThrow();
    expect(validateCircuit(c).length).toBeGreaterThan(0);
    const result = simulate(compileCircuit(c), { [f.a]: '1' });
    expect(result.diagnostics.map(d => d.code)).toEqual(['INVALID_CIRCUIT']);
    expect(result.outputs).toEqual({});
  });
});

describe('N1 / N3: resizing a gate keeps routes clear of the new body and keeps fixed waypoints', () => {
  it('no wire crosses the enlarged body (wire looping around from the far side)', () => {
    let crossings = 0;
    for (const rotation of [0, 90, 180, 270]) for (const src of [{ x: 100, y: 300 }, { x: 700, y: 300 }, { x: 650, y: 80 }, { x: 650, y: 560 }]) for (const [from, to] of [[2, 4], [4, 8], [8, 16]]) {
      let c = emptyCircuit();
      const k = addComponent(c, 'AND', { x: 400, y: 300 }, rotation), s = addComponent(c, 'Input', src);
      if (from !== 2) c = updateComponentProperties(c, k, props(c, k, { inputCount: from }));
      try { c = link(c, c.components[s].pins[0], c.components[k].pins[0]); } catch { continue; }
      const next = updateComponentProperties(c, k, props(c, k, { inputCount: to }));
      expect(validateCircuit(next)).toEqual([]);
      const rects = componentObstacles(next, 0), index = Object.keys(next.geometry.components).indexOf(k), r = rects[index];
      for (const w of Object.values(next.geometry.wires)) for (let i = 1; i < w.points.length; i++) {
        const p = w.points[i - 1], q = w.points[i];
        const hit = p.y === q.y ? p.y > r.top && p.y < r.bottom && Math.max(p.x, q.x) > r.left && Math.min(p.x, q.x) < r.right
          : p.x > r.left && p.x < r.right && Math.max(p.y, q.y) > r.top && Math.min(p.y, q.y) < r.bottom;
        if (hit) crossings++;
      }
    }
    expect(crossings).toBe(0);
  });
  it.each([[[{ x: 220, y: 160 }, { x: 220, y: 300 }], 16, 2, 0], [[{ x: 340, y: 300 }], 8, 3, 0], [[{ x: 340, y: 300 }], 16, 2, 1]] as const)(
    'fixed waypoints survive %j (%i -> %i inputs, pin %i)', (anchors, from, to, pinIndex) => {
      let c = emptyCircuit();
      const k = addComponent(c, 'AND', { x: 400, y: 300 }), s = addComponent(c, 'Input', { x: 100, y: 160 });
      c = updateComponentProperties(c, k, props(c, k, { inputCount: from }));
      c = link(c, c.components[s].pins[0], c.components[k].pins[pinIndex], [...anchors]);
      const wire = Object.values(c.geometry.wires)[0];
      const next = updateComponentProperties(c, k, props(c, k, { inputCount: to }));
      expect(next.geometry.wires[wire.id].anchors).toEqual(wire.anchors);
      expect(validateCircuit(next)).toEqual([]);
    });
});

describe('N2: inversion bubbles never swallow their pin', () => {
  it.each(['AND', 'NAND', 'OR', 'NOR', 'XOR', 'XNOR'] as Kind[])('%s with 2..16 inverted inputs', kind => {
    for (const n of [2, 3, 4, 7, 8, 15, 16]) {
      const html = renderToStaticMarkup(createElement(GateBody, { kind, inputCount: n, invertedInputs: Array(n).fill(true) }));
      for (let i = 0; i < n; i++) {
        const y = inputY(i, n);
        const bubble = new RegExp(`data-input-bubble="${i}" cx="(-?[\\d.]+)" cy="${y}" r="([\\d.]+)"`).exec(html)!;
        const lead = new RegExp(`d="M -40 ${y} H (-?[\\d.]+)"`).exec(html)!;
        expect(Math.abs(Number(bubble[1]) + 40)).toBeGreaterThan(Number(bubble[2])); // pin centre outside the bubble
        expect(Number(lead[1])).toBeGreaterThanOrEqual(-40); // lead never runs backwards
      }
    }
  });
});

describe('P3-4 / P3-8', () => {
  it('validateCircuit stays near-linear on a 4000-sink fan-out', () => {
    const c = emptyCircuit();
    const src = addComponent(c, 'Input', { x: 0, y: 0 });
    const net = { id: 'n', pins: [c.components[src].pins[0]], junctions: [] as string[] };
    c.nets.n = net;
    for (let i = 0; i < 4000; i++) {
      const out = addComponent(c, 'Output', { x: 300 + (i % 100) * 100, y: 40 + Math.floor(i / 100) * 40 });
      const pin = c.components[out].pins[0];
      net.pins.push(pin);
      const w = `w${i}`;
      c.geometry.wires[w] = { id: w, net: 'n', from: { type: 'pin', id: net.pins[0] }, to: { type: 'pin', id: pin }, points: route(pinPosition(c, net.pins[0]), pinPosition(c, pin)) };
    }
    const start = performance.now();
    expect(validateCircuit(c)).toEqual([]);
    expect(performance.now() - start).toBeLessThan(150); // was ~270 ms and growing 4x per doubling
  });
  it('FLOATING_INPUT lists each related object once', () => {
    const c = emptyCircuit();
    const n = addComponent(c, 'NOT', { x: 200, y: 100 }), o = addComponent(c, 'Output', { x: 400, y: 100 });
    connect(c, { type: 'pin', id: c.components[n].pins[1] }, { type: 'pin', id: c.components[o].pins[0] }, route(pinPosition(c, c.components[n].pins[1]), pinPosition(c, c.components[o].pins[0])));
    const d = simulate(compileCircuit(c)).diagnostics.find(x => x.code === 'FLOATING_INPUT')!;
    expect(new Set(d.objects).size).toBe(d.objects.length);
  });
});
