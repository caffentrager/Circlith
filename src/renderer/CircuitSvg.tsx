import type { Circuit, Point } from "../model/circuit";
import { pinPosition } from "../geometry/geometry";
export const path = (points: Point[]) =>
  points.map((p) => `${p.x},${p.y}`).join(" ");
export function Symbols({
  circuit,
  selection,
  zoom = 1,
}: {
  circuit: Circuit;
  selection: string[];
  zoom?: number;
}) {
  return (
    <>
      <g data-layer="wires">
        {Object.values(circuit.geometry.wires).map((w) => (
          <g key={w.id}>
            <polyline
              data-wire-hit={w.id}
              points={path(w.points)}
              className="wire-hit"
            />
            <polyline
              data-wire={w.id}
              points={path(w.points)}
              className={selection.includes(w.id) ? "wire selected" : "wire"}
              pointerEvents="none"
            />
          </g>
        ))}
      </g>
      <g data-layer="junctions">
        {Object.entries(circuit.geometry.junctions).map(([id, p]) => (
          <circle key={id} data-junction={id} cx={p.x} cy={p.y} r={4 / zoom} className="junction"><title>접속점 · 클릭하여 분기</title></circle>
        ))}
      </g>
      <g data-layer="symbols">
        {Object.values(circuit.components).map((c) => {
          const p = circuit.geometry.components[c.id];
          return (
            <g
              key={c.id}
              data-component={c.id}
              transform={`translate(${p.position.x} ${p.position.y}) rotate(${p.rotation})`}
            >
              <rect
                x="-30"
                y="-20"
                width="60"
                height="40"
                rx={c.kind === "AND" ? 14 : 4}
                className={
                  selection.includes(c.id) ? "symbol selected" : "symbol"
                }
              />
              <text textAnchor="middle" y="5">
                {c.kind}
              </text>
              <text textAnchor="middle" y="-29" className="label">
                {c.name}
              </text>
            </g>
          );
        })}
      </g>
      <g data-layer="pins">
        {Object.values(circuit.pins).map((pin) => {
          const p = pinPosition(circuit, pin.id);
          return (
            <circle
              key={pin.id}
              data-pin={pin.id}
              cx={p.x}
              cy={p.y}
              r="5"
              className={Object.values(circuit.nets).some((n) => n.pins.includes(pin.id)) ? "pin connected" : "pin"}
            >
              <title>
                {pin.direction} {pin.index + 1}
              </title>
            </circle>
          );
        })}
      </g>
    </>
  );
}
