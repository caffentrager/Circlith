import type { Circuit, Point } from '../model/circuit';

export type WireOverlap = { wires: [string, string]; nets: [string, string]; from: Point; to: Point };
type Segment = { wire: string; net: string; low: number; high: number };

/** Drawing warnings only: point crossings and wires of the same net are intentionally excluded. */
export function wireOverlaps(circuit: Circuit): WireOverlap[] {
  const lines = new Map<string, { horizontal: boolean; coordinate: number; segments: Segment[] }>();
  for (const wire of Object.values(circuit.geometry.wires)) for (let i = 1; i < wire.points.length; i++) {
    const a = wire.points[i - 1], b = wire.points[i];
    if (![a.x, a.y, b.x, b.y].every(Number.isFinite)) continue;
    const horizontal = a.y === b.y;
    if ((!horizontal && a.x !== b.x) || (a.x === b.x && a.y === b.y)) continue;
    const coordinate = horizontal ? a.y : a.x, key = `${horizontal ? 'h' : 'v'}:${coordinate}`;
    const group = lines.get(key) ?? { horizontal, coordinate, segments: [] };
    group.segments.push({ wire: wire.id, net: wire.net, low: Math.min(horizontal ? a.x : a.y, horizontal ? b.x : b.y), high: Math.max(horizontal ? a.x : a.y, horizontal ? b.x : b.y) });
    lines.set(key, group);
  }
  const result: WireOverlap[] = [];
  for (const { horizontal, coordinate, segments } of lines.values()) {
    segments.sort((a, b) => a.low - b.low || a.high - b.high);
    let active: Segment[] = [];
    for (const segment of segments) {
      active = active.filter(other => other.high > segment.low);
      for (const other of active) {
        if (other.net === segment.net) continue;
        const high = Math.min(other.high, segment.high);
        result.push({ wires: [other.wire, segment.wire], nets: [other.net, segment.net],
          from: horizontal ? { x: segment.low, y: coordinate } : { x: coordinate, y: segment.low },
          to: horizontal ? { x: high, y: coordinate } : { x: coordinate, y: high } });
      }
      active.push(segment);
    }
  }
  return result;
}
