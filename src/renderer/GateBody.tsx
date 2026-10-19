import { gateHalfHeight, inputY, type Kind } from "../model/circuit";
export function GateBody({
  kind,
  selected = false,
  value,
  inputCount = 2,
  invertedInputs = [],
  showPinLabels = false,
  zoom = 1,
}: {
  kind: Kind;
  selected?: boolean;
  value?: string;
  inputCount?: number;
  invertedInputs?: boolean[];
  showPinLabels?: boolean;
  zoom?: number;
}) {
  const className = selected ? "symbol selected" : "symbol";
  const inverted = kind === "NAND" || kind === "NOR" || kind === "XNOR";
  const bubble = inverted ? <circle data-inversion-bubble="true" cx="32" cy="0" r="3" className="gate-bubble"/> : null;
  const height = gateHalfHeight(inputCount);
  const inputLeads = (curved: boolean) => Array.from({ length: inputCount }, (_, index) => {
    const y = inputY(index, inputCount);
    // The auxiliary XOR curve stays far enough from x=-40 for an input bubble.
    const edge = curved ? -14 - 10 * (y / height) ** 2 - (kind === 'XOR' || kind === 'XNOR' ? 5 : 0) : -26;
    // Dense XOR/XNOR bodies leave less than 8 units between the pin and the curve; shrink the bubble so the lead
    // never runs backwards and the pin centre never ends up inside the bubble.
    const radius = Math.min(4, Math.max(2, (edge + 40) / 2 - 0.5));
    return <g key={index}>
      <path d={`M -40 ${y} H ${invertedInputs[index] ? edge - 2 * radius : edge}`} className="pin-lead"/>
      {invertedInputs[index] && <circle data-input-bubble={index} cx={edge - radius} cy={y} r={radius} className="gate-bubble"/>}
      {showPinLabels && <text data-pin-name={`I${index}`} x={curved ? edge + 9 : -21} y={y + 2.5} className="gate-pin-name">I{index}</text>}
    </g>;
  });
  const outputName = showPinLabels && <text data-pin-name="O" x="21" y="2.5" textAnchor="end" className="gate-pin-name">O</text>;
  if (kind === "AND" || kind === "NAND")
    return (
      <>
        <path
          data-gate-shape={kind}
          d={`M -26 ${-height} H 8 A 20 ${height} 0 0 1 8 ${height} H -26 Z`}
          className={className}
        />
        {bubble}
        {outputName}
        {inputLeads(false)}
        <path
          d={`M ${inverted ? 35 : 28} 0 H 40`}
          className="pin-lead"
        />
      </>
    );
  if (kind === "OR" || kind === "NOR" || kind === "XOR" || kind === "XNOR")
    return (
      <>
        <path
          data-gate-shape={kind}
          d={`M -24 ${-height} Q -4 0 -24 ${height} Q 8 ${height} 28 0 Q 8 ${-height} -24 ${-height} Z`}
          className={className}
        />
        {(kind === 'XOR' || kind === 'XNOR') && <path data-xor-curve="true" d={`M -29 ${-height} Q -9 0 -29 ${height}`} className="gate-outline"/>}
        {bubble}
        {outputName}
        {inputLeads(true)}
        <path
          d={`M ${inverted ? 35 : 28} 0 H 40`}
          className="pin-lead"
        />
      </>
    );
  if (kind === "NOT")
    return (
      <>
        <path
          data-gate-shape="NOT"
          d="M -26 -20 L 18 0 L -26 20 Z"
          className={className}
        />
        <circle
          data-inversion-bubble="true"
          cx="23"
          cy="0"
          r="4"
          className="gate-bubble"
        />
        <path d={`M -40 0 H ${invertedInputs[0] ? -34 : -26} M 27 0 H 40`} className="pin-lead" />
        {invertedInputs[0] && <circle data-input-bubble="0" cx="-30" cy="0" r="4" className="gate-bubble"/>}
      </>
    );
  return (
    <>
      <g data-port-body="true" transform="scale(0.5)">
        <path
          data-port-shape={kind}
          d="M -26 -11 H 12 L 26 0 L 12 11 H -26 Z"
          className={className}
        />
      </g>
      <text textAnchor="middle" x="-2" y={zoom < 1 ? 18 / zoom : 3.5}
        style={{ fontSize: Math.max(10, 9 / zoom) }}
        className={`port-value${value ? ` value-${value}` : ''}`}>
        {value ?? (kind === 'Input' ? 'I' : 'O')}
      </text>
      {/* Keep the established pin coordinates so existing wire endpoints stay aligned. */}
      <path
        d={kind === "Input" ? "M 13 0 H 40" : "M -40 0 H -13"}
        className="pin-lead"
      />
    </>
  );
}
