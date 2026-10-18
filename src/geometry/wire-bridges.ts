import type { Circuit, Point } from '../model/circuit';
import { simplifyPath } from './path';
import { settingsKey } from '../config/app-mode';

export type WireDisplaySettings = { version: 1; enabled: boolean; axis: 'horizontal' | 'vertical' };
export const defaultWireDisplay: WireDisplaySettings = { version: 1, enabled: true, axis: 'horizontal' };
export const wireDisplayStorageKey = settingsKey('wire-display.v1');
export function validateWireDisplay(value: unknown): WireDisplaySettings {
  const settings = value as WireDisplaySettings | null;
  if (!settings || settings.version !== 1 || typeof settings.enabled !== 'boolean' ||
    !['horizontal', 'vertical'].includes(settings.axis)) throw new Error('지원하지 않는 배선 표시 설정입니다.');
  return { version: 1, enabled: settings.enabled, axis: settings.axis };
}

export type WireBridge = { wire: string; point: Point; radius: number; axis: WireDisplaySettings['axis']; arc: string; gap: string };
type Segment = { wire: string; a: Point; b: Point; min: number; max: number; horizontal: boolean };
type Candidate = { segment: Segment; point: Point; room: number };

/** Derived visual geometry only. Never split wires, add junctions, or alter nets. */
export function wireBridges(circuit: Circuit, settings: WireDisplaySettings, zoom: number): WireBridge[] {
  if (!settings.enabled || !Number.isFinite(zoom) || zoom <= 0) return [];
  const horizontal: Segment[] = [], vertical: Segment[] = [];
  for (const wire of Object.values(circuit.geometry.wires)) {
    // Redundant collinear waypoints are not corners or electrical junctions.
    const points = simplifyPath(wire.points);
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1], b = points[i], h = a.y === b.y;
      if ((!h && a.x !== b.x) || (a.x === b.x && a.y === b.y)) continue;
      const segment = { wire: wire.id, a, b, min: h ? Math.min(a.x, b.x) : Math.min(a.y, b.y),
        max: h ? Math.max(a.x, b.x) : Math.max(a.y, b.y), horizontal: h };
      (h ? horizontal : vertical).push(segment);
    }
  }
  const maxRadius = 5 / zoom, minRadius = 2 / zoom;
  const junctions = Object.values(circuit.geometry.junctions);
  const candidates = new Map<Segment, Map<string, Candidate>>();
  for (const h of horizontal) for (const v of vertical) {
    if (h.wire === v.wire || !(h.min < v.a.x && v.a.x < h.max && v.min < h.a.y && h.a.y < v.max)) continue;
    const point = { x: v.a.x, y: h.a.y };
    // Junction dots take precedence, including a nearby dot belonging to another route.
    if (junctions.some(p => Math.hypot(p.x - point.x, p.y - point.y) < maxRadius + 6 / zoom)) continue;
    const segment = settings.axis === 'horizontal' ? h : v;
    const room = Math.min(point.x - h.min, h.max - point.x, point.y - v.min, v.max - point.y) / 3;
    const key = `${point.x},${point.y}`, group = candidates.get(segment) ?? new Map<string, Candidate>();
    const existing = group.get(key);
    group.set(key, { segment, point, room: Math.min(room, existing?.room ?? room) });
    candidates.set(segment, group);
  }
  const bridges: WireBridge[] = [];
  for (const [segment, group] of candidates) {
    const coordinate = (c: Candidate) => segment.horizontal ? c.point.x : c.point.y;
    const sorted = [...group.values()].sort((a, b) => coordinate(a) - coordinate(b));
    for (let i = 0; i < sorted.length; i++) {
      const candidate = sorted[i], position = coordinate(candidate);
      const spacing = Math.min(i ? position - coordinate(sorted[i - 1]) : Infinity,
        i + 1 < sorted.length ? coordinate(sorted[i + 1]) - position : Infinity) / 3;
      const radius = Math.min(maxRadius, candidate.room, spacing);
      if (radius < minRadius) continue;
      const { x, y } = candidate.point;
      const from = segment.horizontal ? `${x - radius} ${y}` : `${x} ${y - radius}`;
      const to = segment.horizontal ? `${x + radius} ${y}` : `${x} ${y + radius}`;
      bridges.push({ wire: segment.wire, point: candidate.point, radius, axis: settings.axis,
        arc: `M ${from} A ${radius} ${radius} 0 0 1 ${to}`, gap: `M ${from} L ${to}` });
    }
  }
  return bridges;
}
