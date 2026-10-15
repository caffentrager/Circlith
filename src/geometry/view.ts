import { type Circuit, type Point } from "../model/circuit";
export function fitView(
  c: Circuit,
  width: number,
  height: number,
  selection?: string[],
) {
  const chosen = selection ? new Set(selection) : null;
  const points: Point[] = [];
  for (const [key, p] of Object.entries(c.geometry.components))
    if (!chosen || chosen.has(key))
      points.push(
        { x: p.position.x - 50, y: p.position.y - 50 },
        { x: p.position.x + 50, y: p.position.y + 50 },
      );
  for (const wire of Object.values(c.geometry.wires))
    if (!chosen || chosen.has(wire.id))
      points.push(...wire.points);
  if (!chosen) {
    points.push(...Object.values(c.geometry.junctions));
  }
  if (!points.length) return null;
  const x1 = Math.min(...points.map((p) => p.x)),
    x2 = Math.max(...points.map((p) => p.x)),
    y1 = Math.min(...points.map((p) => p.y)),
    y2 = Math.max(...points.map((p) => p.y));
  const zoom = Math.max(
    0.1,
    Math.min(
      2,
      (width - 80) / Math.max(1, x2 - x1),
      (height - 80) / Math.max(1, y2 - y1),
    ),
  );
  return {
    zoom,
    x: width / 2 - ((x1 + x2) * zoom) / 2,
    y: height / 2 - ((y1 + y2) * zoom) / 2,
  };
}
