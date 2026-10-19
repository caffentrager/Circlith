import type { WireOverlap } from '../geometry/wire-overlaps';
import type { CircuitLabels } from './circuit-labels';

export function DrawingWarnings({ overlaps, labels, busy, onLocate }: {
  overlaps: WireOverlap[]; labels: CircuitLabels; busy: boolean; onLocate: (wires: string[]) => void;
}) {
  if (!overlaps.length) return null;
  return <details className="drawing-warnings" aria-label="도면 표시 경고">
    <summary>⚠ 서로 다른 연결망의 배선 겹침 {overlaps.length}곳</summary>
    <p>주황 구간은 다른 연결망이 같은 위치에 그려진 곳입니다. 전기적으로 연결된 것은 아닙니다.</p>
    <ul>{overlaps.map((item, i) => <li key={i}>
      <button disabled={busy} data-warning-code="WIRE_OVERLAP" onClick={() => onLocate(item.wires)}>
        {labels.nets.get(item.nets[0])} ↔ {labels.nets.get(item.nets[1])} · 겹친 위치 보기
      </button>
    </li>)}</ul>
  </details>;
}
