import type { Circuit, Point } from "../model/circuit";
import { projectSegment } from "./path";

// Selection measures actual distance; crossing magnetism belongs to connection intent only.
export function nearestWires(c: Circuit, p: Point, zoom: number): string[] {
  const hits = Object.values(c.geometry.wires).map(w => ({
    id: w.id,
    distance: w.points.slice(1).reduce((best, b, i) => {
      const q = projectSegment(w.points[i], b, p);
      return Math.min(best, Math.hypot(q.x - p.x, q.y - p.y) * zoom);
    }, Infinity),
  })).filter(h => h.distance <= 6).sort((a,b) => a.distance-b.distance || a.id.localeCompare(b.id));
  return hits.filter(h => h.distance <= (hits[0]?.distance ?? 0) + .5).map(h => h.id);
}
