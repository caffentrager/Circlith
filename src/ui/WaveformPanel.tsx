import { useLayoutEffect, useRef, useState } from 'react';
import type { Circuit } from '../model/circuit';
import type { CircuitLabels } from './circuit-labels';
import type { LogicValue } from '../simulation/logic';
import { TimeSession } from '../simulation/time-session';

function signalName(circuit: Circuit, labels: CircuitLabels, key: string) {
  if (key.startsWith('net:')) return labels.nets.get(key.slice(4)) ?? '연결망';
  const pin = circuit.pins[key.slice(4)];
  return pin ? labels.components.get(pin.component) + ' · ' + labels.pins.get(pin.id) : '신호';
}
export function WaveformPanel({ session, labels, selection, onChange }: {
  session: TimeSession; labels: CircuitLabels; selection: string[]; onChange: () => void;
}) {
  const plot = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(400);
  const [cursor, setCursor] = useState<number | null>(null);
  const [error, setError] = useState('');
  useLayoutEffect(() => { setCursor(null); }, [session]);
  useLayoutEffect(() => {
    const observer = new ResizeObserver(() => setWidth(Math.max(100, plot.current?.clientWidth ?? 100)));
    observer.observe(plot.current!); return () => observer.disconnect();
  }, []);
  const samples = session.samples, start = samples[0]?.time ?? 0;
  const end = Math.max(start + 1, session.time);
  const at = cursor === null ? samples.length - 1 : samples.reduce((index, s, i) => s.time <= cursor ? i : index, 0);
  const sample = samples[at];
  const x = (time: number) => 8 + (time - start) / (end - start) * (width - 16);
  const selected = selection.flatMap(id => {
    const component = session.circuit.components[id], wire = session.circuit.geometry.wires[id];
    return component ? ['pin:' + (component.kind === 'Output' ? component.pins[0] : component.pins.at(-1)!)] : wire ? ['net:' + wire.net] : [];
  });
  const add = () => {
    try { session.setWatch([...session.watch, ...selected]); setError(''); onChange(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
  };
  return <section className="waveform-panel" aria-label="관측 파형">
    <div className="waveform-actions">
      <button disabled={!selected.length} onClick={add}>선택 신호 관측</button>
      <span>{session.watch.length}/32 신호 · 최근 512시각{session.dropped ? ' · 이전 기록 제거됨' : ''}</span>
      <label>파형 커서<input aria-label="파형 커서" type="range" min="0" max={Math.max(0, samples.length - 1)} step="1" value={at} onChange={e => setCursor(samples[Number(e.target.value)].time)}/></label>
      <button disabled={cursor === null} onClick={() => setCursor(null)}>현재로</button>
      <output aria-label="파형 관측 시각">{cursor === null ? '현재' : '과거 관측'} t={sample?.time ?? 0} µs</output>
    </div>
    {error && <p role="alert">{error}</p>}
    {!session.watch.length && <p>도면에서 부품이나 배선을 선택한 뒤 관측에 추가하세요.</p>}
    <div className="waveform-scroll">
      <div className="waveform-grid">
        <div className="waveform-names">
          <div className="waveform-scale">신호 · 관측값</div>
          {session.watch.map(key => <div className="waveform-name" key={key}>
            <span title={signalName(session.circuit, labels, key)}>{signalName(session.circuit, labels, key)}</span>
            <output data-watch-value={key} className={'signal-badge signal-' + (sample?.values[key] ?? 'unknown')}>{sample?.values[key] ?? '—'}</output>
            <button aria-label={signalName(session.circuit, labels, key) + ' 관측 제거'} onClick={() => { session.setWatch(session.watch.filter(k => k !== key)); onChange(); }}>×</button>
          </div>)}
        </div>
        <div ref={plot} className="waveform-plot">
          <svg width="100%" height={session.watch.length * 32 + 28} role="img" aria-label="논리 시간에 따른 관측 신호. 파형 커서는 실행 상태를 바꾸지 않습니다."
            onClick={e => {
              const bounds = e.currentTarget.getBoundingClientRect();
              const time = start + Math.max(0, Math.min(1, (e.clientX - bounds.left - 8) / (width - 16))) * (end - start);
              setCursor(time);
            }}>
            {[start, ...(width > 220 ? [(start + end) / 2] : []), end].map((time, index, ticks) => <g key={index}>
              <line x1={x(time)} x2={x(time)} y1="23" y2={session.watch.length * 32 + 28} className="waveform-gridline"/>
              <text x={x(time)} y="16" textAnchor={index === 0 ? 'start' : index === ticks.length - 1 ? 'end' : 'middle'}>{Number(time.toFixed(2))}</text>
            </g>)}
            {session.watch.map((key, row) => {
              const top = row * 32 + 34;
              const level = (value: LogicValue) => top + (value === '1' ? 0 : 15);
              return <g key={key}>{samples.map((s, i) => {
                const value = s.values[key], a = x(s.time), b = x(samples[i + 1]?.time ?? end);
                if (!value) return null; // Signal was not watched at this time.
                if (value === 'X' || value === 'Z') return <g key={i}>
                  <rect x={a} y={top - 2} width={Math.max(0, b - a)} height="20" className={'waveform-band signal-' + value}/>
                  {b - a > 18 && <text x={(a + b) / 2} y={top + 12} textAnchor="middle">{value}</text>}
                </g>;
                const next = samples[i + 1]?.values[key];
                return <path key={i} d={`M ${a} ${level(value)} H ${b}${next === '0' || next === '1' ? ' V ' + level(next) : ''}`} className="waveform-trace"/>;
              })}</g>;
            })}
            <line x1={x(Math.max(start, Math.min(end, sample?.time ?? start)))} x2={x(Math.max(start, Math.min(end, sample?.time ?? start)))} y1="23" y2={session.watch.length * 32 + 28} className="waveform-cursor"/>
          </svg>
        </div>
      </div>
    </div>
    <p className="waveform-note">단위 µs · 논리 시간 · 파형 커서는 과거 값만 관측하며 현재 회로 상태를 되돌리지 않습니다.</p>
  </section>;
}
