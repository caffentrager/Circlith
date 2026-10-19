import type { Circuit } from '../model/circuit';
import { logicValues, type LogicValue } from '../simulation/logic';
import type { Diagnostic, SimulationResult } from '../simulation/simulator';
import type { CircuitLabels } from './circuit-labels';

export function SimulationPanel({ circuit, labels, result, inputs, busy, onInput, onReset, onLocate, sequential = false }: {
  sequential?: boolean;
  circuit: Circuit;
  labels: CircuitLabels;
  result: SimulationResult;
  inputs: Readonly<Record<string, LogicValue>>;
  busy: boolean;
  onInput: (id: string, value: LogicValue) => void;
  onReset: () => void;
  onLocate: (diagnostic: Diagnostic) => void;
}) {
  const sources = Object.values(circuit.components).filter(c => c.kind === 'Input');
  const sinks = Object.values(circuit.components).filter(c => c.kind === 'Output');
  const circuitInvalid = result.diagnostics.some(d => d.code === 'INVALID_CIRCUIT');
  return <section className="simulation-panel" aria-label={sequential ? '시간 시뮬레이션' : '조합논리 시뮬레이션'}>
    <h2>{sequential ? '시간 시뮬레이션' : '조합논리 시뮬레이션'}</h2>
    {busy && <p className="note">초안은 계산하지 않습니다. 확정하거나 취소하면 입력을 바꿀 수 있습니다.</p>}
    <p className="signal-legend">0 낮음 · 1 높음 · X 불명확 · Z 구동 없음</p>
    <div className="simulation-body">
    <div className="simulation-inputs">
    <h3>입력</h3>
    {!sources.length && <p>라이브러리에서 Input을 배치하세요.</p>}
    {sources.map((source, index) => {
      const label = labels.components.get(source.id)!, value = inputs[source.id] ?? '0';
      return <div className="simulation-input" key={source.id}>
        <button disabled={busy} onClick={() => onInput(source.id, value === '1' ? '0' : '1')}
          aria-label={`${label}: ${value} → ${value === '1' ? '0' : '1'}`}>
          {label} <strong>{value}</strong> ↔
        </button>
        <select aria-label={`${label} 값`} disabled={busy} value={value}
          onChange={e => onInput(source.id, e.target.value as LogicValue)}>
          {logicValues.map(v => <option key={v} value={v}>{v}</option>)}
        </select>
      </div>;
    })}
    <button disabled={busy || !sources.length} onClick={onReset}>입력 모두 0</button>
    </div>
    <div className="simulation-outputs">
    <h3>출력</h3>
    {!sinks.length && <p>확인할 위치에 Output을 연결하세요.</p>}
    {sinks.map((sink, index) => <div className="simulation-output" key={sink.id}>
      <span>{labels.components.get(sink.id)}</span>
      <output data-output={sink.id} className={`signal-badge signal-${circuitInvalid ? 'invalid' : result.outputs[sink.id] ?? 'X'}`}
        aria-label={`${labels.components.get(sink.id)} 값`}>{circuitInvalid ? '오류' : result.outputs[sink.id] ?? 'X'}</output>
    </div>)}
    </div>
    <div className="simulation-diagnostics-group">
    <h3>회로 진단 {result.diagnostics.length}개</h3>
    {!result.diagnostics.length && <p>감지된 연결 오류가 없습니다.</p>}
    <ul className="simulation-diagnostics">
      {result.diagnostics.map((diagnostic, index) => <li key={`${diagnostic.code}-${index}`} data-diagnostic-code={diagnostic.code}>
        <span className={`diagnostic-severity ${diagnostic.severity}`}>{diagnostic.severity === 'error' ? '오류' : '주의'}</span>
        <p>{diagnostic.message}</p>
        {!!diagnostic.objects.length && <button disabled={busy} onClick={() => onLocate(diagnostic)}>관련 위치 보기</button>}
      </li>)}
    </ul>
    </div>
    </div>
  </section>;
}
