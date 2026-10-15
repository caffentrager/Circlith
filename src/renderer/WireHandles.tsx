import type { Circuit } from "../model/circuit";
import { simplifyPath } from "../geometry/wire-edit";

export function WireHandles({ circuit, selection, zoom }: { circuit: Circuit; selection: string[]; zoom: number }) {
  return <g data-layer="wire-handles">
    {selection.flatMap((key) => {
      const wire = circuit.geometry.wires[key];
      if (!wire) return [];
      const points = simplifyPath(wire.points);
      return [
        ...points.slice(1, -1).map((p, n) =>
          <rect key={`${key}-corner-${n}`} data-wire-handle={key} data-kind="corner" data-index={n + 1}
            x={p.x - 5 / zoom} y={p.y - 5 / zoom} width={10 / zoom} height={10 / zoom} className="wire-handle corner">
            <title>모서리: 드래그해 이동 · Esc 취소</title>
          </rect>),
        ...points.slice(0, -1).flatMap((a, n) => {
          const b = points[n + 1], horizontal = a.y === b.y;
          const p = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
          const length = Math.hypot(b.x - a.x, b.y - a.y);
          return [
            <circle key={`${key}-segment-${n}`} data-wire-handle={key} data-kind="segment" data-index={n}
              cx={p.x} cy={p.y} r={5 / zoom} className={`wire-handle ${horizontal ? "horizontal" : "vertical"}`}>
              <title>선분: 드래그해 {horizontal ? "위아래" : "좌우"}로 이동</title>
            </circle>,
            ...(length >= 30 && length * zoom >= 65 ? [
              <path key={`${key}-jog-${n}`} data-wire-handle={key} data-kind="jog" data-index={n}
                transform={`translate(${p.x + (horizontal ? 20 / zoom : 0)} ${p.y + (horizontal ? 0 : 20 / zoom)}) scale(${1 / zoom})`}
                d="M 0 -5 L 5 0 L 0 5 L -5 0 Z" className={`wire-handle jog ${horizontal ? "horizontal" : "vertical"}`}>
                <title>우회 구간 추가: 바깥으로 드래그</title>
              </path>,
            ] : []),
          ];
        }),
      ];
    })}
  </g>;
}
