import { gateHalfHeight, inputY, type Kind } from "../model/circuit";
export function GateBody({
  kind,
  selected = false,
  value,
  inputCount = 2,
  invertedInputs = [],
}: {
  kind: Kind;
  selected?: boolean;
  value?: string;
  inputCount?: number;
  invertedInputs?: boolean[];
}) {
  const className = selected ? "symbol selected" : "symbol";
  const inverted = kind === "NAND" || kind === "NOR" || kind === "XNOR";
  const bubble = inverted ? <circle data-inversion-bubble="true" cx="34" cy="0" r="4" className="gate-bubble"/> : null;
  const height = gateHalfHeight(inputCount);
  const inputLeads = (curved: boolean) => Array.from({ length: inputCount }, (_, index) => {
    const y = inputY(index, inputCount);
    const edge = curved ? -17.5 - 12.5 * (y / height) ** 2 - (kind === 'XOR' || kind === 'XNOR' ? 5 : 0) : -30;
    return <g key={index}>
      <path d={`M -40 ${y} H ${invertedInputs[index] ? edge - 8 : edge}`} className="pin-lead"/>
      {invertedInputs[index] && <circle data-input-bubble={index} cx={edge - 4} cy={y} r="4" className="gate-bubble"/>}
    </g>;
  });
  if (kind === "AND" || kind === "NAND")
    return (
      <>
        <path
          data-gate-shape={kind}
          d={`M -30 ${-height} H 10 A 20 ${height} 0 0 1 10 ${height} H -30 Z`}
          className={className}
        />
        {bubble}
        {kind === 'NAND' && <text textAnchor="middle" y="5" className="gate-caption">NAND</text>}
        {inputLeads(false)}
        <path
          d={`M ${inverted ? 38 : 30} 0 H 40`}
          className="pin-lead"
        />
      </>
    );
  if (kind === "OR" || kind === "NOR" || kind === "XOR" || kind === "XNOR")
    return (
      <>
        <path
          data-gate-shape={kind}
          d={`M -30 ${-height} Q -5 0 -30 ${height} Q 7 ${height} 30 0 Q 7 ${-height} -30 ${-height} Z`}
          className={className}
        />
        {(kind === 'XOR' || kind === 'XNOR') && <path d={`M -35 ${-height} Q -10 0 -35 ${height}`} className="pin-lead"/>}
        {bubble}
        {kind !== 'OR' && <text textAnchor="middle" y="5" className="gate-caption">{kind}</text>}
        {inputLeads(true)}
        <path
          d={`M ${inverted ? 38 : 30} 0 H 40`}
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
        <path d={`M -40 0 H ${invertedInputs[0] ? -38 : -30} M 30 0 H 40`} className="pin-lead" />
        {invertedInputs[0] && <circle data-input-bubble="0" cx="-34" cy="0" r="4" className="gate-bubble"/>}
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
