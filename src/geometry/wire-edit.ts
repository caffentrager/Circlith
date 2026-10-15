import { clone, type Circuit, type Point } from "../model/circuit";
import { endpointPosition, route, same } from "./geometry";
import { clean, simplifyPath } from "./path";
export { simplifyPath } from "./path";

export type WireEditKind = "segment" | "corner" | "jog";

// Pure geometry: electrical endpoints and nets are never changed here.
export function nearestSegment(points: Point[], p: Point): number {
  let best = 0, distance = Infinity;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i], b = points[i + 1];
    const dx = b.x - a.x, dy = b.y - a.y;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
    const d = Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
    if (d < distance) { best = i; distance = d; }
  }
  return best;
}

export function editWirePath(points: Point[], index: number, kind: WireEditKind, delta: Point): Point[] {
  const next = points.map((p) => ({ ...p }));
  if (kind === "corner") {
    if (index <= 0 || index >= points.length - 1) return next;
    const prev = points[index - 1], corner = points[index], after = points[index + 1];
    const moved = { x: corner.x + delta.x, y: corner.y + delta.y };
    const incomingHorizontal = prev.y === corner.y;
    const outgoingHorizontal = corner.y === after.y;
    const left = incomingHorizontal ? { x: prev.x, y: moved.y } : { x: moved.x, y: prev.y };
    const right = outgoingHorizontal ? { x: after.x, y: moved.y } : { x: moved.x, y: after.y };
    return simplifyPath([
      ...next.slice(0, Math.max(0, index - 1)),
      ...(index === 1 ? [prev] : []), left, moved, right,
      ...(index === points.length - 2 ? [after] : []),
      ...next.slice(index + 2),
    ]);
  }
  if (index < 0 || index >= points.length - 1) return next;
  const a = points[index], b = points[index + 1], horizontal = a.y === b.y;
  const offset = horizontal ? { x: 0, y: delta.y } : { x: delta.x, y: 0 };
  const shift = (p: Point) => ({ x: p.x + offset.x, y: p.y + offset.y });
  if (kind === "jog") {
    // Keep a quarter of the original segment at each side; only its middle moves.
    const axis = horizontal ? "x" : "y";
    const lo = Math.min(a[axis], b[axis]), hi = Math.max(a[axis], b[axis]);
    if (hi - lo < 30) return next;
    const one = Math.max(lo + 10, Math.min(hi - 20, Math.round((lo + (hi - lo) / 3) / 10) * 10));
    const two = Math.max(one + 10, Math.min(hi - 10, Math.round((lo + 2 * (hi - lo) / 3) / 10) * 10));
    const p = { ...a, [axis]: a[axis] < b[axis] ? one : two };
    const q = { ...b, [axis]: a[axis] < b[axis] ? two : one };
    return simplifyPath([...next.slice(0, index + 1), p, shift(p), shift(q), q, ...next.slice(index + 1)]);
  }
  next[index] = shift(a); next[index + 1] = shift(b);
  if (index === 0) next.unshift({ ...a });
  if (index === points.length - 2) next.push({ ...b });
  return simplifyPath(next);
}

export function replaceWirePath(c: Circuit, key: string, points: Point[], anchors?: Point[]): Circuit {
  const wire = c.geometry.wires[key];
  if (!wire) throw new Error("배선이 없습니다.");
  const normalized = anchors?.length ? clean(points) : simplifyPath(points);
  if (normalized.length < 1 || normalized.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y)) ||
    !same(normalized[0], endpointPosition(c, wire.from)) ||
    !same(normalized[normalized.length - 1], endpointPosition(c, wire.to)) ||
    normalized.some((p, i) => i > 0 && p.x !== normalized[i - 1].x && p.y !== normalized[i - 1].y))
    throw new Error("연결점과 직각 경로를 유지해야 합니다.");
  const next = clone(c);
  next.geometry.wires[key].points = normalized;
  if (anchors) next.geometry.wires[key].anchors = structuredClone(anchors);
  return next;
}

export function simpleWirePath(c: Circuit, key: string, horizontal: boolean) {
  const w = c.geometry.wires[key];
  return route(endpointPosition(c, w.from), endpointPosition(c, w.to), horizontal);
}
