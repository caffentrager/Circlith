import type { Kind } from "../model/circuit";
export function GateBody({
  kind,
  selected = false,
  value,
}: {
  kind: Kind;
  selected?: boolean;
  value?: string;
}) {
  const className = selected ? "symbol selected" : "symbol";
  const inverted = kind === "NAND" || kind === "NOR" || kind === "XNOR";
  const bubble = inverted ? <circle data-inversion-bubble="true" cx="34" cy="0" r="4" className="gate-bubble"/> : null;
  if (kind === "AND" || kind === "NAND")
    return (
      <>
        <path
          data-gate-shape={kind}
          d="M -30 -20 H 10 A 20 20 0 0 1 10 20 H -30 Z"
          className={className}
        />
        {bubble}
        {kind === 'NAND' && <text textAnchor="middle" y="5" className="gate-caption">NAND</text>}
        <path
          d={`M -40 -10 H -30 M -40 10 H -30 M ${inverted ? 38 : 30} 0 H 40`}
          className="pin-lead"
        />
      </>
    );
  if (kind === "OR" || kind === "NOR" || kind === "XOR" || kind === "XNOR")
    return (
      <>
        <path
          data-gate-shape={kind}
          d="M -30 -20 Q -5 0 -30 20 Q 7 20 30 0 Q 7 -20 -30 -20 Z"
          className={className}
        />
        {(kind === 'XOR' || kind === 'XNOR') && <path d="M -35 -20 Q -10 0 -35 20" className="pin-lead"/>}
        {bubble}
        {kind !== 'OR' && <text textAnchor="middle" y="5" className="gate-caption">{kind}</text>}
        <path
          d={`M -40 -10 H -20.625 M -40 10 H -20.625 M ${inverted ? 38 : 30} 0 H 40`}
          className="pin-lead"
        />
      </>
    );
  if (kind === "NOT")
    return (
      <>
        <path
          data-gate-shape="NOT"
          d="M -30 -20 L 20 0 L -30 20 Z"
          className={className}
        />
        <circle
          data-inversion-bubble="true"
          cx="25"
          cy="0"
          r="5"
          className="gate-bubble"
        />
        <path d="M -40 0 H -30 M 30 0 H 40" className="pin-lead" />
      </>
    );
  return (
    <>
      <rect
        x="-30"
        y="-20"
        width="60"
        height="40"
        rx="4"
        className={className}
      />
      <path
        d={kind === "Input" ? "M 30 0 H 40" : "M -40 0 H -30"}
        className="pin-lead"
      />
      <text textAnchor="middle" y="5">
        {value ?? kind}
      </text>
    </>
  );
}
