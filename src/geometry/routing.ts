import { gateHalfHeight, gateInputCount, type Circuit, type ConnectionTarget, type Point } from "../model/circuit";
import { rotatePoint, route } from "./geometry";
import { anchorOffsets, clean, pointOnSegment, same, simplifyPath } from "./path";
import { settingsKey } from '../config/app-mode';

export type RoutingSettings = {
  version: 1;
  pathMode: "smart" | "horizontal" | "vertical";
  overlapMode: "avoid" | "warn";
};
export const defaultRouting: RoutingSettings = { version: 1, pathMode: "smart", overlapMode: "avoid" };
export const routingStorageKey = settingsKey('routing.v1');
export const routingLabel = (s: RoutingSettings) =>
  `${s.pathMode === "smart" ? "스마트 자동" : s.pathMode === "horizontal" ? "가로 우선" : "세로 우선"} · ${s.overlapMode === "avoid" ? "자동 우회" : "겹침 경고"}`;
export function validateRouting(value: unknown): RoutingSettings {
  const s = value as RoutingSettings | null;
  if (!s || s.version !== 1 || !["smart", "horizontal", "vertical"].includes(s.pathMode) || !["avoid", "warn"].includes(s.overlapMode))
    throw new Error("지원하지 않는 배선 설정입니다.");
  return { version: 1, pathMode: s.pathMode, overlapMode: s.overlapMode };
}
type Rect = { left: number; right: number; top: number; bottom: number };
export function componentObstacles(c: Circuit, margin = 10): Rect[] {
  return Object.entries(c.geometry.components).map(([key, p]) => {
    const height = gateHalfHeight(gateInputCount(c.components[key]));
    const vertical = p.rotation % 180 !== 0, x = (vertical ? height : 30) + margin, y = (vertical ? 30 : height) + margin;
    return { left: p.position.x - x, right: p.position.x + x, top: p.position.y - y, bottom: p.position.y + y };
  });
}
const inside = (p: Point, r: Rect) => p.x > r.left && p.x < r.right && p.y > r.top && p.y < r.bottom;
function intersects(a: Point, b: Point, r: Rect) {
  return a.y === b.y
    ? a.y > r.top && a.y < r.bottom && Math.max(a.x, b.x) > r.left && Math.min(a.x, b.x) < r.right
    : a.x > r.left && a.x < r.right && Math.max(a.y, b.y) > r.top && Math.min(a.y, b.y) < r.bottom;
}
export function collidingSegments(c: Circuit, points: Point[], margin = 0): [Point, Point][] {
  const rects = componentObstacles(c, margin);
  return points.slice(1).flatMap((b, i) => rects.some((r) => intersects(points[i], b, r)) ? [[points[i], b] as [Point, Point]] : []);
}
function escape(c: Circuit, p: Point, toward: Point, target?: ConnectionTarget): Point {
  if (target?.type === "wire") {
    const pts = c.geometry.wires[target.id].points;
    const i = pts.findIndex((a, index) => index < pts.length - 1 && pointOnSegment(a, pts[index + 1], p));
    if (i < 0) return p;
    return pts[i].y === pts[i + 1].y ? { x: p.x, y: p.y + (toward.y < p.y ? -10 : 10) }
      : { x: p.x + (toward.x < p.x ? -10 : 10), y: p.y };
  }
  if (target?.type !== "pin") return p;
  const pin = c.pins[target.id], placement = c.geometry.components[pin.component];
  const normal = rotatePoint({ x: pin.direction === "out" ? 10 : -10, y: 0 }, placement.rotation);
  return { x: p.x + normal.x, y: p.y + normal.y };
}
type Entry = { state: number; cost: number; score: number };
class Heap {
  items: Entry[] = [];
  less(a: Entry, b: Entry) { return a.score < b.score || (a.score === b.score && a.state < b.state); }
  push(item: Entry) {
    const a = this.items; a.push(item); let i = a.length - 1;
    while (i > 0) { const p = (i - 1) >> 1; if (!this.less(a[i], a[p])) break; [a[i], a[p]] = [a[p], a[i]]; i = p; }
  }
  pop() {
    const a = this.items, first = a[0], last = a.pop()!;
    if (a.length) { a[0] = last; let i = 0;
      while (true) { let j = i, l = i * 2 + 1, r = l + 1;
        if (l < a.length && this.less(a[l], a[j])) j = l;
        if (r < a.length && this.less(a[r], a[j])) j = r;
        if (i === j) break; [a[i], a[j]] = [a[j], a[i]]; i = j;
      }
    }
    return first;
  }
}

// Coordinate-compressed rectilinear graph; orientation is part of each search state.
function search(a: Point, b: Point, rects: Rect[], horizontal?: boolean): Point[] | null {
  if (same(a, b)) return [a];
  const clear = (p: Point, q: Point) => !rects.some((r) => intersects(p, q, r));
  if (rects.some((r) => inside(a, r) || inside(b, r))) return null;
  const candidates = [route(a, b, true), route(a, b, false)].filter((pts) => pts.every((p, i) => i === 0 || clear(pts[i - 1], p)));
  // A clear preferred L is optimal in length and bend count; smart uses the dominant axis.
  const preferred = horizontal ?? Math.abs(b.x - a.x) >= Math.abs(b.y - a.y);
  const direct = candidates.find((pts) => pts.length < 2 || (pts[0].y === pts[1].y) === preferred);
  if (direct) return direct;
  const xs = [...new Set([a.x, b.x, ...rects.flatMap((r) => [r.left, r.right])])].sort((x, y) => x - y);
  const ys = [...new Set([a.y, b.y, ...rects.flatMap((r) => [r.top, r.bottom])])].sort((x, y) => x - y);
  if (xs.length * ys.length > 30000) return null;
  const nx = xs.length, count = nx * ys.length;
  const point = (n: number) => ({ x: xs[n % nx], y: ys[Math.floor(n / nx)] });
  const start = ys.indexOf(a.y) * nx + xs.indexOf(a.x), end = ys.indexOf(b.y) * nx + xs.indexOf(b.x);
  const costs = new Float64Array(count * 3).fill(Infinity), parents = new Int32Array(count * 3).fill(-1), heap = new Heap();
  costs[start * 3] = 0; heap.push({ state: start * 3, cost: 0, score: 0 });
  while (heap.items.length) {
    const current = heap.pop(); if (current.cost !== costs[current.state]) continue;
    const n = Math.floor(current.state / 3), axis = current.state % 3, p = point(n);
    if (n === end) {
      const pts: Point[] = []; let state = current.state;
      while (state !== -1) { pts.push(point(Math.floor(state / 3))); state = parents[state]; }
      return simplifyPath(pts.reverse());
    }
    const x = n % nx, y = Math.floor(n / nx);
    const neighbors = [x > 0 ? n - 1 : -1, x + 1 < nx ? n + 1 : -1, y > 0 ? n - nx : -1, y + 1 < ys.length ? n + nx : -1];
    for (const next of neighbors) {
      if (next < 0) continue;
      const q = point(next), direction = p.y === q.y ? 1 : 2;
      if (!clear(p, q)) continue;
      const state = next * 3 + direction;
      const cost = current.cost + Math.abs(q.x - p.x) + Math.abs(q.y - p.y) + (axis && axis !== direction ? 20 : 0)
        + (!axis && (direction === 1) !== preferred ? 5 : 0);
      if (cost >= costs[state]) continue;
      costs[state] = cost; parents[state] = current.state;
      heap.push({ state, cost, score: cost + Math.abs(q.x - b.x) + Math.abs(q.y - b.y) });
    }
  }
  return null;
}

export function planRoute(c: Circuit, a: Point, b: Point, settings: RoutingSettings,
  options: { from?: ConnectionTarget; to?: ConnectionTarget; anchors?: Point[]; horizontal?: boolean } = {}) {
  const preferred = options.horizontal ?? (settings.pathMode === "smart" ? undefined : settings.pathMode === "horizontal");
  const smart = settings.pathMode === "smart" && options.horizontal === undefined;
  const first = smart ? escape(c, a, options.anchors?.[0] ?? b, options.from) : a;
  const last = smart ? escape(c, b, options.anchors?.at(-1) ?? a, options.to) : b;
  const stops = clean([first, ...(options.anchors ?? []), last]);
  const rects = settings.overlapMode === "avoid" ? componentObstacles(c) : [];
  let blocked = false, points: Point[] = [a];
  if (rects.some((r) => intersects(a, first, r) || intersects(last, b, r))) blocked = true;
  for (let i = 1; i < stops.length; i++) {
    const result = search(stops[i - 1], stops[i], rects, preferred);
    if (!result) blocked = true;
    // Keep every manually fixed interval; global simplification could erase a U-turn anchor.
    points.push(...(result ?? route(stops[i - 1], stops[i], preferred ?? true)));
  }
  points.push(last, b);
  points = clean(points);
  // Simplify only if all explicit anchors remain on the resulting polyline.
  const simplified = simplifyPath(points);
  if (anchorOffsets(simplified, options.anchors ?? []) !== null) points = simplified;
  const collisions = collidingSegments(c, points);
  return { points, blocked: blocked || (settings.overlapMode === "avoid" && collisions.length > 0), collisions };
}
