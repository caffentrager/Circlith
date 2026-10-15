import type { Circuit, ConnectionTarget, Point } from "../model/circuit";
import { endpointPosition, pinPosition, snap } from "./geometry";
import { projectSegment, same } from "./path";

export type ConnectionHit = { target: ConnectionTarget; position: Point; distance: number };
export function connectionHits(c: Circuit, p: Point, zoom: number): ConnectionHit[] {
  const endpoints: ConnectionHit[] = [
    ...Object.keys(c.pins).map((id) => ({ target: { type: "pin", id } as ConnectionTarget, position: pinPosition(c, id) })),
    ...Object.entries(c.geometry.junctions).map(([id, position]) => ({ target: { type: "junction", id } as ConnectionTarget, position })),
  ].map((candidate) => ({ ...candidate, distance: Math.hypot(candidate.position.x - p.x, candidate.position.y - p.y) * zoom }))
    .filter((candidate) => candidate.distance <= 9);
  const nearest = (hits: ConnectionHit[]) => {
    hits.sort((a, b) => a.distance - b.distance || a.target.id.localeCompare(b.target.id));
    return hits.filter((hit) => hit.distance <= (hits[0]?.distance ?? 0) + .5);
  };
  if (endpoints.length) return nearest(endpoints);
  const wires: ConnectionHit[] = [];
  for (const w of Object.values(c.geometry.wires)) {
    let best: ConnectionHit | undefined;
    for (let i = 1; i < w.points.length; i++) {
      const a = w.points[i - 1], b = w.points[i];
      const projection = projectSegment(a, b, p);
      if (Math.hypot(projection.x - p.x, projection.y - p.y) * zoom > 6) continue;
      const gridPoint = projectSegment(a, b, snap(projection));
      const position = gridPoint;
      const distance = Math.hypot(projection.x - p.x, projection.y - p.y) * zoom;
      const endpoint = [w.from, w.to].find((e) => same(endpointPosition(c, e), position));
      const target: ConnectionTarget = endpoint ?? { type: "wire", id: w.id, position };
      if (!best || distance < best.distance) best = { target, position, distance };
    }
    if (best) wires.push(best);
  }
  // Shared endpoints reported by several fragments are one candidate.
  const unique = wires.filter((hit, i) => wires.findIndex((other) => other.target.type === hit.target.type && other.target.id === hit.target.id) === i);
  return nearest(unique);
}
