import { gateHalfHeight, gateInputCount, type Circuit, type Point } from "../model/circuit";
export const MIN_ZOOM = 0.1, MAX_ZOOM = 8, ZOOM_STEP = 1.1;
const stable = (value: number) => Number(value.toFixed(12));
const clampZoom = (zoom: number) => stable(Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom)));
export function wheelZoomFactor(delta: number, mode: number, height: number, reverse = false): number {
  if (!Number.isFinite(delta) || delta === 0) return 1;
  const pixels = delta * (mode === 1 ? 16 : mode === 2 ? Math.max(1, height) : 1);
  return Math.exp(-Math.max(-240, Math.min(240, pixels)) * (reverse ? -1 : 1) * Math.log(ZOOM_STEP) / 100);
}
export function zoomView(view: { x: number; y: number; zoom: number }, factor: number, anchor: Point) {
  if (!Number.isFinite(factor) || factor <= 0 || factor === 1) return view;
  const zoom = clampZoom(view.zoom * factor);
  return { zoom, x: stable(anchor.x - (anchor.x - view.x) * zoom / view.zoom),
    y: stable(anchor.y - (anchor.y - view.y) * zoom / view.zoom) };
}
export function fitView(
  c: Circuit,
  width: number,
  height: number,
  selection?: string[],
  padding = 40,
) {
  const chosen = selection ? new Set(selection) : null;
  const points: Point[] = [];
  for (const [key, p] of Object.entries(c.geometry.components))
    if (!chosen || chosen.has(key)) {
      const extent = gateHalfHeight(gateInputCount(c.components[key])) + 30;
      const x = p.rotation % 180 ? extent : 50, y = p.rotation % 180 ? 50 : extent;
      points.push(
        { x: p.position.x - x, y: p.position.y - y },
        { x: p.position.x + x, y: p.position.y + y },
      );
    }
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
  const zoom = clampZoom(Math.min(
    (width - 2 * padding) / Math.max(1, x2 - x1),
    (height - 2 * padding) / Math.max(1, y2 - y1),
  ));
  return {
    zoom,
    x: width / 2 - ((x1 + x2) * zoom) / 2,
    y: height / 2 - ((y1 + y2) * zoom) / 2,
  };
}
