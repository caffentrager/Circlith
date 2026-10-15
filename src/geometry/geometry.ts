import {
  clone,
  type Circuit,
  type Endpoint,
  type Point,
} from "../model/circuit";
import { clean, simplifyPath } from "./path";
export { clean, same } from "./path";
export const snap = (p: Point): Point => ({
  x: Math.round(p.x / 10) * 10,
  y: Math.round(p.y / 10) * 10,
});
export function rotatePoint(p: Point, degrees: number): Point {
  const turns = (((degrees / 90) % 4) + 4) % 4;
  return turns === 0
    ? { ...p }
    : turns === 1
      ? { x: -p.y, y: p.x }
      : turns === 2
        ? { x: -p.x, y: -p.y }
        : { x: p.y, y: -p.x };
}
export function pinPosition(c: Circuit, key: string): Point {
  const pin = c.pins[key],
    comp = c.components[pin.component],
    place = c.geometry.components[comp.id];
  const local =
    comp.kind === "AND"
      ? pin.index === 2
        ? { x: 40, y: 0 }
        : { x: -40, y: pin.index === 0 ? -10 : 10 }
      : { x: comp.kind === "Input" ? 40 : -40, y: 0 };
  const p = rotatePoint(local, place.rotation);
  return { x: p.x + place.position.x, y: p.y + place.position.y };
}
export const endpointPosition = (c: Circuit, e: Endpoint) =>
  e.type === "pin" ? pinPosition(c, e.id) : c.geometry.junctions[e.id];
export function route(a: Point, b: Point, horizontal = true): Point[] {
  return clean([a, horizontal ? { x: b.x, y: a.y } : { x: a.x, y: b.y }, b]);
}
export function boxComponents(c: Circuit, start: Point, end: Point): string[] {
  const left = Math.min(start.x, end.x),
    right = Math.max(start.x, end.x);
  const top = Math.min(start.y, end.y),
    bottom = Math.max(start.y, end.y);
  const crossing = end.x < start.x;
  return Object.keys(c.components).filter((key) => {
    const placement = c.geometry.components[key];
    const corners = [
      { x: -40, y: -20 },
      { x: 40, y: -20 },
      { x: 40, y: 20 },
      { x: -40, y: 20 },
    ].map((p) => {
      const r = rotatePoint(p, placement.rotation);
      return { x: r.x + placement.position.x, y: r.y + placement.position.y };
    });
    const x1 = Math.min(...corners.map((p) => p.x)),
      x2 = Math.max(...corners.map((p) => p.x));
    const y1 = Math.min(...corners.map((p) => p.y)),
      y2 = Math.max(...corners.map((p) => p.y));
    return crossing
      ? x1 <= right && x2 >= left && y1 <= bottom && y2 >= top
      : x1 >= left && x2 <= right && y1 >= top && y2 <= bottom;
  });
}
export function boxWires(c: Circuit, start: Point, end: Point): string[] {
  const left = Math.min(start.x, end.x), right = Math.max(start.x, end.x);
  const top = Math.min(start.y, end.y), bottom = Math.max(start.y, end.y);
  const inside = (p: Point) =>
    p.x >= left && p.x <= right && p.y >= top && p.y <= bottom;
  const intersects = (a: Point, b: Point) => {
    let enter = 0, exit = 1;
    for (const [origin, delta, min, max] of [
      [a.x, b.x - a.x, left, right],
      [a.y, b.y - a.y, top, bottom],
    ]) {
      if (delta === 0) {
        if (origin < min || origin > max) return false;
      } else {
        const t1 = (min - origin) / delta, t2 = (max - origin) / delta;
        enter = Math.max(enter, Math.min(t1, t2));
        exit = Math.min(exit, Math.max(t1, t2));
        if (enter > exit) return false;
      }
    }
    return true;
  };
  return Object.values(c.geometry.wires)
    .filter((wire) => wire.points.length > 1 && (end.x >= start.x
      ? wire.points.every(inside)
      : wire.points.some((p, i) => i > 0 && intersects(wire.points[i - 1], p))))
    .map((wire) => wire.id);
}
// Only the span adjacent to a moving endpoint is rebuilt. Shared junctions remain fixed.
export function transform(
  c: Circuit,
  selection: string[],
  delta: Point,
  rotation = 0,
): Circuit {
  const next = clone(c);
  const chosen = new Set(selection.filter((k) => c.components[k]));
  if (!chosen.size) return next;
  const positions = [...chosen].map((k) => c.geometry.components[k].position);
  const center = {
    x:
      (Math.min(...positions.map((p) => p.x - 40)) +
        Math.max(...positions.map((p) => p.x + 40))) /
      2,
    y:
      (Math.min(...positions.map((p) => p.y - 20)) +
        Math.max(...positions.map((p) => p.y + 20))) /
      2,
  };
  const map = (p: Point) => {
    const r = rotatePoint({ x: p.x - center.x, y: p.y - center.y }, rotation);
    return { x: center.x + r.x + delta.x, y: center.y + r.y + delta.y };
  };
  for (const key of chosen) {
    const p = next.geometry.components[key];
    p.position = map(p.position);
    p.rotation = (p.rotation + rotation + 360) % 360;
  }
  const moving = (e: Endpoint) =>
    e.type === "pin" && chosen.has(c.pins[e.id].component);
  for (const w of Object.values(next.geometry.wires)) {
    const a = moving(w.from),
      b = moving(w.to);
    if (a && b) {
      w.points = simplifyPath(w.points.map(map));
      continue;
    }
    const stretch = (points: Point[], e: Endpoint) => {
      const start = endpointPosition(next, e),
        fixed = points[1] ?? points[0];
      const horizontal = points[0].y === fixed.y;
      return simplifyPath([
        ...route(start, fixed, rotation ? !horizontal : horizontal),
        ...points.slice(2),
      ]);
    };
    if (a) w.points = stretch(simplifyPath(w.points), w.from);
    if (b) w.points = stretch(simplifyPath(w.points).reverse(), w.to).reverse();
  }
  return next;
}
