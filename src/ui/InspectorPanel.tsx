import { useMemo } from 'react';
import { gateInputCount, type Circuit, type Endpoint } from '../model/circuit';
import type { SimulationResult } from '../simulation/simulator';
import type { CircuitLabels } from './circuit-labels';

export function InspectorPanel({ circuit, labels, selection, simulation, busy, onProperties, onFit, onSearch }: {
  circuit: Circuit; selection: string[]; simulation?: SimulationResult; busy: boolean;
  labels: CircuitLabels;
  onProperties: (id: string) => void; onFit: () => void; onSearch: () => void;
}) {
  const netByPin = useMemo(() => new Map(Object.values(circuit.nets).flatMap(net => net.pins.map(pin => [pin, net.id] as const))), [circuit.nets]);
  const component = selection.length === 1 ? circuit.components[selection[0]] : undefined;
  const wire = selection.length === 1 ? circuit.geometry.wires[selection[0]] : undefined;
  const invalid = simulation?.diagnostics.some(d => d.code === 'INVALID_CIRCUIT');
  const signal = (value?: string) => simulation ? <span className={`signal-badge signal-${invalid ? 'invalid' : value ?? 'X'}`}>{invalid ? '계산 오류' : value ?? 'X'}</span> : <em>계산 꺼짐</em>;
  const endpoint = (end: Endpoint) => end.type === 'junction' ? '접속점' : `${labels.components.get(circuit.pins[end.id].component)} · ${labels.pins.get(end.id)}`;
  return <section className="inspector-context" aria-label="선택 속성">
    <div className="section-eyebrow">{!selection.length ? '현재 도면' : wire ? '배선 / 연결망' : component ? '부품 속성' : '다중 선택'}</div>
    <h2>{component ? labels.components.get(component.id) : wire ? '배선과 연결망' : selection.length ? `${selection.length}개 객체 선택` : '회로 개요'}</h2>
    {!selection.length ? <>
      <p className="inspector-intro">부품이나 배선을 선택하면<br/>속성과 연결 상태를 확인할 수 있습니다.</p>
      <div className="circuit-stats">
        <div><strong>{Object.keys(circuit.components).length}</strong><small>부품</small></div>
        <div><strong>{Object.keys(circuit.nets).length}</strong><small>연결망</small></div>
        <div><strong>{Object.keys(circuit.geometry.wires).length}</strong><small>배선</small></div>
      </div>
      <button className="primary-action" onClick={onSearch}>+ 부품 찾아 배치</button>
      <p className="note">라이브러리에서 드래그하거나 검색으로 시작하세요.</p>
    </> : component ? <>
      <dl className="property-list">
        <dt>종류</dt><dd>{component.kind}</dd>
        {component.kind !== 'Input' && component.kind !== 'Output' && <><dt>입력 수</dt><dd>{gateInputCount(component)}</dd></>}
        <dt>회전</dt><dd>{circuit.geometry.components[component.id].rotation}°</dd>
        {component.kind !== 'Input' && component.kind !== 'Output' && <><dt>입력 반전</dt><dd>{component.pins.filter(id => circuit.pins[id].direction === 'in' && circuit.pins[id].inverted).map(id => labels.pins.get(id)).join(', ') || '없음'}</dd></>}
      </dl>
      <button className="primary-action" disabled={busy} onClick={() => onProperties(component.id)}>속성 편집…</button>
      <h3>핀과 연결</h3>
      <ul className="inspector-pins">{component.pins.map(id => {
        const pin = circuit.pins[id], net = netByPin.get(id);
        return <li key={id}><div><strong>{labels.pins.get(id)}{pin.inverted ? ' · 반전' : ''}</strong><small>{net ? labels.nets.get(net) : '미연결'}</small></div>{signal(simulation?.pins[id])}</li>;
      })}</ul>
    </> : wire ? <>
      <dl className="property-list">
        <dt>연결망</dt><dd>{labels.nets.get(wire.net)}</dd>
        <dt>시작</dt><dd>{endpoint(wire.from)}</dd>
        <dt>끝</dt><dd>{endpoint(wire.to)}</dd>
        <dt>고정 경유점</dt><dd>{wire.anchors?.length ?? 0}개</dd>
        <dt>현재 값</dt><dd>{signal(simulation?.nets[wire.net])}</dd>
      </dl>
      <p className="note">점 없는 교차는 미접속입니다.</p>
    </> : <>
      <p>부품 {selection.filter(id => circuit.components[id]).length} · 배선 {selection.filter(id => circuit.geometry.wires[id]).length}</p>
      <p className="note">함께 이동·회전하거나 선택을 좁혀 개별 속성을 확인하세요.</p>
    </>}
    {!!selection.length && <button disabled={busy} onClick={onFit}>선택 항목 화면 맞춤</button>}
    {busy && <p className="inspector-busy">진행 중 작업을 확정하거나 취소하면 속성을 편집할 수 있습니다.</p>}
  </section>;
}
