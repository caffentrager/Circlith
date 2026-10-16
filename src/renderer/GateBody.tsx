import type { Kind } from "../model/circuit";
export function GateBody({
  kind,
  selected = false,
}: {
  kind: Kind;
  selected?: boolean;
}) {
  const className = selected ? "symbol selected" : "symbol";
  if (kind === "AND")
    return (
      <>
        <path
          data-gate-shape="AND"
          d="M -30 -20 H 10 A 20 20 0 0 1 10 20 H -30 Z"
          className={className}
        />
        <path
          d="M -40 -10 H -30 M -40 10 H -30 M 30 0 H 40"
          className="pin-lead"
        />
      </>
    );
  if (kind === "OR")
    return (
      <>
        <path
          data-gate-shape="OR"
          d="M -30 -20 Q -5 0 -30 20 Q 7 20 30 0 Q 7 -20 -30 -20 Z"
          className={className}
        />
        <path
          d="M -40 -10 H -20.625 M -40 10 H -20.625 M 30 0 H 40"
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
        {kind}
      </text>
    </>
  );
}
