import { afterAll, describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { GateBody } from '../src/renderer/GateBody';
import { addComponent, emptyCircuit, gateHalfHeight, gateInputCount, inputY, type Kind, type Point } from '../src/model/circuit';
import { updateComponentProperties } from '../src/model/component-properties';
import { boxComponents, pinPosition, rotatePoint } from '../src/geometry/geometry';
import { componentObstacles } from '../src/geometry/routing';
import { fitView } from '../src/geometry/view';
import { record } from './helpers';

const summary: Record<string, unknown> = {};
type Bubble = { cx: number; cy: number; r: number };
function parse(kind: Kind, n: number, inverted: boolean[]) {
  const html = renderToStaticMarkup(createElement(GateBody, { kind, inputCount: n, invertedInputs: inverted }));
  const bubbles: Record<string, Bubble> = {}, outBubble: Bubble[] = [];
  for (const m of html.matchAll(/<circle[^>]*>/g)) {
    const t = m[0], num = (a: string) => Number(new RegExp(`${a}="([^"]+)"`).exec(t)![1]);
    const idx = /data-input-bubble="(\d+)"/.exec(t);
    const b = { cx: num('cx'), cy: num('cy'), r: num('r') };
    if (idx) bubbles[idx[1]] = b; else outBubble.push(b);
  }
  const leads: { y: number; to: number }[] = [];
  for (const m of html.matchAll(/d="M -40 (-?[\d.]+) H (-?[\d.]+)"/g)) leads.push({ y: Number(m[1]), to: Number(m[2]) });
  return { html, bubbles, outBubble, leads };
}

describe('8.2 inversion bubble vs pin geometry (parsed from the real SVG output)', () => {
  const rows: unknown[] = [];
  const PIN_R = 5;
  for (const kind of ['AND', 'NAND', 'OR', 'NOR', 'XOR', 'XNOR'] as Kind[]) for (const n of [2, 3, 4, 8, 15, 16]) {
    it(`${kind} x${n} all inputs inverted`, () => {
      const { bubbles, leads } = parse(kind, n, Array(n).fill(true));
      let reversed = 0, pinInsideBubble = 0, pinCircleOverlap = 0, leadShort = 0;
      for (let i = 0; i < n; i++) {
        const y = inputY(i, n), b = bubbles[String(i)], lead = leads.find(l => l.y === y)!;
        expect(b).toBeDefined();
        expect(b.cy).toBe(y);
        if (lead.to > -40) leadShort++; // lead must run from the pin toward the body (increasing x)
        if (lead.to < -40) reversed++;
        const d = Math.abs(b.cx - -40);
        if (d < b.r) pinInsideBubble++;
        if (d < b.r + PIN_R) pinCircleOverlap++;
      }
      rows.push({ kind, n, reversed, pinInsideBubble, pinCircleOverlap, leadShort });
      expect({ reversed, pinInsideBubble }).toEqual({ reversed: 0, pinInsideBubble: 0 });
    });
  }
  it('records the full table', () => { summary['bubble geometry'] = rows; });
});

describe('8.1 pin / symbol / selection / obstacle / fit consistency over kind x count x rotation', () => {
  it('pins lie exactly on the rotated symbol lead start and bounds contain every pin and bubble', () => {
    let checked = 0;
    const bad: unknown[] = [];
    for (const kind of ['AND', 'OR', 'XOR', 'NAND', 'NOR', 'XNOR'] as Kind[]) for (const n of [2, 3, 4, 8, 16]) for (const rotation of [0, 90, 180, 270]) {
      let c = emptyCircuit();
      const k = addComponent(c, kind, { x: 500, y: 500 }, rotation);
      c = updateComponentProperties(c, k, { name: kind, inputCount: n, invertedInputs: Array(n).fill(true) });
      const { bubbles } = parse(kind, n, Array(n).fill(true));
      const comp = c.components[k];
      const half = gateHalfHeight(gateInputCount(comp));
      const rect = componentObstacles(c, 0)[0];
      comp.pins.forEach((pin, i) => {
        const p = pinPosition(c, pin), local = i === n ? { x: 40, y: 0 } : { x: -40, y: inputY(i, n) };
        const r = rotatePoint(local, rotation), expected: Point = { x: r.x + 500, y: r.y + 500 };
        if (p.x !== expected.x || p.y !== expected.y) bad.push({ kind, n, rotation, i, p, expected });
        if (p.x < rect.left - 10 || p.x > rect.right + 10 || p.y < rect.top - 10 || p.y > rect.bottom + 10) bad.push({ kind, n, rotation, i, out: 'pin outside obstacle rect' });
        if (i < n) { const b = bubbles[String(i)], rb = rotatePoint({ x: b.cx, y: b.cy }, rotation);
          const q = { x: rb.x + 500, y: rb.y + 500 };
          if (q.x < rect.left - 12 || q.x > rect.right + 12 || q.y < rect.top - 12 || q.y > rect.bottom + 12) bad.push({ kind, n, rotation, i, out: 'bubble outside bounds' }); }
        checked++;
      });
      const hx = rotation % 180 ? half + 1 : 41, hy = rotation % 180 ? 41 : half + 1;
      const selected = boxComponents(c, { x: 500 - hx, y: 500 - hy }, { x: 500 + hx, y: 500 + hy });
      if (!selected.includes(k)) bad.push({ kind, n, rotation, out: 'box selection misses fully enclosed gate' });
      const view = fitView(c, 1000, 800, [k])!;
      const full = componentObstacles(c, 0)[0];
      const sx1 = full.left * view.zoom + view.x, sx2 = full.right * view.zoom + view.x, sy1 = full.top * view.zoom + view.y, sy2 = full.bottom * view.zoom + view.y;
      if (sx1 < 0 || sy1 < 0 || sx2 > 1000 || sy2 > 800) bad.push({ kind, n, rotation, out: 'fitView clips the gate body', sx1, sx2, sy1, sy2 });
    }
    summary['pin/bounds consistency'] = { checked, bad: bad.length, first: bad.slice(0, 5) };
    expect(bad).toEqual([]);
  });
});

afterAll(() => record('geometry-outcomes', summary));
