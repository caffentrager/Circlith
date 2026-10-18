import { gateHalfHeight, gateInputCount, isBinaryGate, type Circuit, type Point } from "../model/circuit";
import { pinPosition } from "../geometry/geometry";
import {GateBody} from './GateBody';
import type { SimulationResult } from '../simulation/simulator';
import type { LogicValue } from '../simulation/logic';
import { useId, useMemo } from 'react';
import { defaultWireDisplay, wireBridges, type WireDisplaySettings } from '../geometry/wire-bridges';
export const path = (points: Point[]) =>
  points.map((p) => `${p.x},${p.y}`).join(" ");
export function Symbols({
  circuit,
  selection,
  zoom = 1,
  simulation,
  inputs = {},
  onToggleInput,
  toggleDisabled = false,
  wireDisplay = defaultWireDisplay,
}: {
  circuit: Circuit;
  selection: string[];
  zoom?: number;
  simulation?: SimulationResult;
  inputs?: Readonly<Record<string, LogicValue>>;
  onToggleInput?: (id: string) => void;
  toggleDisabled?: boolean;
  wireDisplay?: WireDisplaySettings;
}) {
  const maskPrefix = useId().replace(/:/g, '');
  const circuitInvalid = !!simulation?.diagnostics.some(d => d.code === 'INVALID_CIRCUIT');
  const bridges = useMemo(() => wireBridges(circuit, wireDisplay, zoom), [circuit, wireDisplay, zoom]);
  // Computed once per circuit: the pin layer previously rescanned every net for every pin (O(P*N)).
  const connectedPins = useMemo(() => new Set(Object.values(circuit.nets).flatMap(n => n.pins)), [circuit.nets]);
  const inputIndex = useMemo(() => new Map(Object.values(circuit.components).filter(part => part.kind === 'Input').map((part, i) => [part.id, i + 1])), [circuit.components]);
  const junctionDegree = useMemo(() => {
    const degree = new Map<string, number>();
    for (const w of Object.values(circuit.geometry.wires)) for (const e of [w.from, w.to]) if (e.type === 'junction') degree.set(e.id, (degree.get(e.id) ?? 0) + 1);
    return degree;
  }, [circuit.geometry.wires]);
  const byWire = new Map<string, typeof bridges>();
  for (const bridge of bridges) {
    const group = byWire.get(bridge.wire) ?? [];
    group.push(bridge); byWire.set(bridge.wire, group);
  }
  return (
    <>
      <defs>
        {[...byWire].map(([id, group]) => {
          const points = circuit.geometry.wires[id].points, padding = 10 / zoom + 4;
          const x = Math.min(...points.map(p => p.x)) - padding, y = Math.min(...points.map(p => p.y)) - padding;
          const width = Math.max(...points.map(p => p.x)) - x + padding, height = Math.max(...points.map(p => p.y)) - y + padding;
          return <mask key={id} id={`${maskPrefix}-wire-${id}`} maskUnits="userSpaceOnUse" x={x} y={y} width={width} height={height}>
            <rect x={x} y={y} width={width} height={height} fill="white"/>
            {group.map((bridge, i) => <path key={i} d={bridge.gap} stroke="black" strokeWidth={selection.includes(id) ? 6 / zoom : 4} fill="none"/>)}
          </mask>;
        })}
      </defs>
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
              data-value={simulation?.nets[w.net]}
              mask={byWire.has(w.id) ? `url(#${maskPrefix}-wire-${w.id})` : undefined}
              points={path(w.points)}
              className={`wire${selection.includes(w.id) ? ' selected' : ''}${simulation ? ` signal-${circuitInvalid ? 'invalid' : simulation.nets[w.net] ?? 'X'}` : ''}`}
              pointerEvents="none"
            />
            {simulation && !circuitInvalid && <text data-wire-value={w.id} x={(w.points[0].x + (w.points[1]?.x ?? w.points[0].x)) / 2 + 6 / zoom}
              y={(w.points[0].y + (w.points[1]?.y ?? w.points[0].y)) / 2 - 6 / zoom}
              style={{ fontSize: 12 / zoom }} className="signal-label">{simulation.nets[w.net] ?? 'X'}</text>}
          </g>
        ))}
      </g>
      <g data-layer="wire-bridges" pointerEvents="none" aria-hidden="true">
        {bridges.map((bridge, index) => {
          const wire = circuit.geometry.wires[bridge.wire], selected = selection.includes(wire.id);
          return <g key={`${bridge.wire}-${index}`}>
            <path d={bridge.arc} className="wire-bridge-halo" strokeWidth={(selected ? 4 / zoom : 2) + 3 / zoom}/>
            <path d={bridge.arc} data-wire-bridge={bridge.wire} data-bridge-axis={bridge.axis}
              data-bridge-x={bridge.point.x} data-bridge-y={bridge.point.y} data-bridge-radius={bridge.radius}
              data-selected={selected || undefined} data-value={simulation?.nets[wire.net]}
              className={`wire-bridge${simulation ? ` signal-${circuitInvalid ? 'invalid' : simulation.nets[wire.net] ?? 'X'}` : ''}`}/>
            <path d={bridge.arc} data-bridge-hit={bridge.wire} fill="none" stroke="transparent"
              strokeWidth={Math.max(4 / zoom, 2)} pointerEvents="stroke"/>
          </g>;
        })}
      </g>
      <g data-layer="junctions">
        {Object.entries(circuit.geometry.junctions).map(([id, p]) => {
          const dangling=junctionDegree.get(id)===1;
          return <circle key={id} data-junction={id} data-dangling={dangling||undefined} cx={p.x} cy={p.y} r={4 / zoom} className={dangling?'junction dangling':'junction'}><title>{dangling?'미연결 끝점 · 클릭하여 다시 연결':'접속점 · 클릭하여 분기'}</title></circle>;
        })}
      </g>
      <g data-layer="symbols">
        {Object.values(circuit.components).map((c) => {
          const p = circuit.geometry.components[c.id];
          return (
            <g
              key={c.id}
              data-component={c.id}
              data-value={simulation ? (c.kind === 'Input' ? inputs[c.id] ?? '0' : c.kind === 'Output' ? circuitInvalid ? undefined : simulation.outputs[c.id] ?? 'X' : undefined) : undefined}
              transform={`translate(${p.position.x} ${p.position.y}) rotate(${p.rotation})`}
            >
              <GateBody kind={c.kind} selected={selection.includes(c.id)} inputCount={gateInputCount(c)}
                showPinLabels
                invertedInputs={c.pins.filter(id => circuit.pins[id].direction === 'in').map(id => !!circuit.pins[id].inverted)}
                value={c.kind === 'Input' ? inputs[c.id] ?? '0' : c.kind === 'Output' ? circuitInvalid ? '오류' : simulation ? simulation.outputs[c.id] ?? 'X' : '—' : undefined}/>
              {simulation && c.kind === 'Input' && onToggleInput && <g role="button" tabIndex={0} aria-disabled={toggleDisabled || undefined}
                aria-label={`입력 토글 ${inputIndex.get(c.id)}: ${inputs[c.id] ?? '0'}`}
                data-input-toggle={c.id} className="input-toggle"
                // Keep the canvas as the focus owner; the press itself still bubbles to the canvas gesture logic.
                onPointerDown={e => { if (e.button === 0) e.preventDefault(); }}
                // Pointer input is resolved by the canvas (a click without movement toggles). Only the keyboard path lives here,
                // and only Enter is consumed so Space keeps driving temporary panning.
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); if (!e.repeat && !toggleDisabled) onToggleInput(c.id); } }}>
                <path d="M -24 -10 H 11 L 24 0 L 11 10 H -24 Z" fill="transparent"/>
                <title>클릭 또는 Enter: 입력 0/1 전환 · 오른쪽 패널에서 X/Z 지정</title>
              </g>}
              {selection.includes(c.id) && <rect data-symbol-selection={c.id} x="-45" y={-gateHalfHeight(gateInputCount(c)) - 5}
                width="90" height={gateHalfHeight(gateInputCount(c)) * 2 + 10} className="symbol-selection" pointerEvents="none"/>}
              <text textAnchor={c.kind === 'Input' ? 'end' : c.kind === 'Output' ? 'start' : 'middle'}
                x={c.kind === 'Input' ? -34 : c.kind === 'Output' ? 34 : 0}
                y={c.kind === 'Input' || c.kind === 'Output' ? 4 : -gateHalfHeight(gateInputCount(c)) - 11}
                className={`label${c.kind === 'Input' || c.kind === 'Output' ? ' port-label' : ''}`}>
                {c.name === c.kind && isBinaryGate(c.kind) ? `${c.kind}${gateInputCount(c)}` : c.name}
              </text>
            </g>
          );
        })}
      </g>
      <g data-layer="pins">
        {Object.values(circuit.pins).map((pin) => {
          const p = pinPosition(circuit, pin.id);
          return <g key={pin.id}>
            <circle data-pin-marker={pin.id} cx={p.x} cy={p.y} r="1.8"
              className={connectedPins.has(pin.id) ? 'pin-marker connected' : 'pin-marker'} pointerEvents="none"/>
            <circle
              data-pin={pin.id}
              data-value={simulation?.pins[pin.id]}
              cx={p.x}
              cy={p.y}
              r="5"
              className={connectedPins.has(pin.id) ? "pin connected" : "pin"}
            >
              <title>
                {`${pin.direction} ${pin.index + 1}${simulation ? circuitInvalid ? ' · 계산 중단' : ` · ${simulation.pins[pin.id] ?? 'X'}` : ''}`}
              </title>
            </circle>
          </g>;
        })}
      </g>
    </>
  );
}
