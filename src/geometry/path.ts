import type { Point } from "../model/circuit";

export const same = (a: Point, b: Point) => a.x === b.x && a.y === b.y;
export function clean(points: Point[]): Point[] {
  const result: Point[] = [];
  for (const p of points)
    if (!result.length || !same(result[result.length - 1], p)) result.push({ ...p });
  return result;
}

// Stack reduction removes redundant collinear vertices and retraced spurs in O(n).
// Electrical junctions are wire endpoints, so they remain protected boundaries.
export function simplifyPath(points: Point[]): Point[] {
  const result: Point[] = [];
  for (const point of clean(points)) {
    while (result.length >= 2) {
      const a = result[result.length - 2], b = result[result.length - 1];
      if (!((a.x === b.x && b.x === point.x) || (a.y === b.y && b.y === point.y))) break;
      result.pop();
    }
    if (!result.length || !same(result[result.length - 1], point)) result.push({ ...point });
  }
  return result;
}

export function projectSegment(a: Point, b: Point, p: Point): Point {
  const dx = b.x - a.x, dy = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
  return { x: a.x + t * dx, y: a.y + t * dy };
}

export function pointOnSegment(a: Point, b: Point, p: Point): boolean {
  const q = projectSegment(a, b, p);
  return Math.hypot(q.x - p.x, q.y - p.y) < 1e-7;
}
