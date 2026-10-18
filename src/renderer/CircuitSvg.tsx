import { gateHalfHeight, gateInputCount, type Circuit, type Point } from "../model/circuit";
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
  wireDisplay = defaultWireDisplay,
}: {
  circuit: Circuit;
  selection: string[];
  zoom?: number;
  simulation?: SimulationResult;
  inputs?: Readonly<Record<string, LogicValue>>;
  onToggleInput?: (id: string) => void;
  wireDisplay?: WireDisplaySettings;
}) {
  const maskPrefix = useId().replace(/:/g, '');
  const bridges = useMemo(() => wireBridges(circuit, wireDisplay, zoom), [circuit, wireDisplay, zoom]);
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
              className={`wire${selection.includes(w.id) ? ' selected' : ''}${simulation ? ` signal-${simulation.nets[w.net] ?? 'X'}` : ''}`}
              pointerEvents="none"
            />
            {simulation && <text data-wire-value={w.id} x={(w.points[0].x + (w.points[1]?.x ?? w.points[0].x)) / 2 + 6 / zoom}
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
              className={`wire-bridge${simulation ? ` signal-${simulation.nets[wire.net] ?? 'X'}` : ''}`}/>
            <path d={bridge.arc} data-bridge-hit={bridge.wire} fill="none" stroke="transparent"
              strokeWidth={Math.max(4 / zoom, 2)} pointerEvents="stroke"/>
          </g>;
        })}
      </g>
      <g data-layer="junctions">
        {Object.entries(circuit.geometry.junctions).map(([id, p]) => {
          const dangling=Object.values(circuit.geometry.wires).filter(w=>[w.from,w.to].some(e=>e.type==='junction'&&e.id===id)).length===1;
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
              data-value={simulation ? (c.kind === 'Input' ? inputs[c.id] ?? '0' : c.kind === 'Output' ? simulation.outputs[c.id] ?? 'X' : undefined) : undefined}
              transform={`translate(${p.position.x} ${p.position.y}) rotate(${p.rotation})`}
            >
              <GateBody kind={c.kind} selected={selection.includes(c.id)} inputCount={gateInputCount(c)}
                invertedInputs={c.pins.filter(id => circuit.pins[id].direction === 'in').map(id => !!circuit.pins[id].inverted)}
                value={simulation ? (c.kind === 'Input' ? inputs[c.id] ?? '0' : c.kind === 'Output' ? simulation.outputs[c.id] ?? 'X' : undefined) : undefined}/>
              {simulation && c.kind === 'Input' && onToggleInput && <g role="button" tabIndex={0}
                aria-label={`입력 토글 ${Object.values(circuit.components).filter(part => part.kind === 'Input').findIndex(part => part.id === c.id) + 1}: ${inputs[c.id] ?? '0'}`}
                data-input-toggle={c.id} className="input-toggle"
                onPointerDown={e => { e.stopPropagation(); e.preventDefault(); e.currentTarget.focus(); }}
                onClick={e => { e.stopPropagation(); onToggleInput(c.id); }}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); if (e.key === 'Enter' && !e.repeat) onToggleInput(c.id); }
                }} onKeyUp={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); } }}>
                <rect x="-25" y="-16" width="50" height="32" rx="3" fill="transparent"/>
                <title>클릭 또는 Enter: 입력 0/1 전환 · 오른쪽 패널에서 X/Z 지정</title>
              </g>}
              <text textAnchor="middle" y={-gateHalfHeight(gateInputCount(c)) - 9} className="label">
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
              data-value={simulation?.pins[pin.id]}
              cx={p.x}
              cy={p.y}
              r="5"
              className={Object.values(circuit.nets).some((n) => n.pins.includes(pin.id)) ? "pin connected" : "pin"}
            >
              <title>
                {pin.direction} {pin.index + 1}{simulation ? ` · ${simulation.pins[pin.id] ?? 'X'}` : ''}
              </title>
            </circle>
          );
        })}
      </g>
    </>
  );
}
