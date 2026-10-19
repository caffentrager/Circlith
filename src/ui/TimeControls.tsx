import { useLayoutEffect, useRef, useState } from 'react';
import type { CircuitLabels } from './circuit-labels';
import type { TimeController } from './useTimeSession';
import type { TimeStep } from '../simulation/time-session';

export function TimeControls({ controller, labels, busy, onRun, onHeight }: {
  controller: TimeController; labels: CircuitLabels; busy: boolean; onRun: () => void; onHeight: (height: number) => void;
}) {
  const [mode, setMode] = useState<TimeStep>('event');
  const [clock, setClock] = useState('');
  const element = useRef<HTMLElement>(null);
  const { session, running } = controller;
  useLayoutEffect(() => {
    const observer = new ResizeObserver(() => onHeight(element.current?.getBoundingClientRect().height ?? 0));
    observer.observe(element.current!);
    return () => { observer.disconnect(); onHeight(0); };
  }, [onHeight]);
  if (!session) return null;
  const clockId = session.clockIds.includes(clock) ? clock : session.clockIds[0];
  const blocked = busy || !session.hasEvents;
  return <section ref={element} className="execution-toolbar" aria-label="시간 실행 제어">
    <div className="execution-buttons">
      <button className="time-run" aria-pressed={running} disabled={!running && blocked} onClick={() => running ? controller.pause() : onRun()}>{running ? '일시정지' : '실행'}</button>
      <button disabled={running || blocked} onClick={() => controller.step(mode, clockId)}>{mode === 'event' ? '다음 이벤트' : mode === 'rising' ? '다음 상승엣지' : '한 주기 진행'}</button>
      <select aria-label="Step 진행 기준" disabled={running || busy} value={mode} onChange={e => setMode(e.target.value as TimeStep)}>
        <option value="event">다음 이벤트</option><option value="rising">클럭 상승엣지</option><option value="period">클럭 한 주기</option>
      </select>
      {mode !== 'event' && <select aria-label="Step 기준 클럭" disabled={running || busy || !clockId} value={clockId ?? ''} onChange={e => setClock(e.target.value)}>
        {!clockId && <option value="">Clock 없음</option>}
        {session.clockIds.map(id => <option key={id} value={id}>{labels.components.get(id)}</option>)}
      </select>}
      <button disabled={busy} title="시간·내부 상태·파형 초기화. 외부 Input 값 유지. 부품 Reset 핀과 별개입니다." onClick={controller.reset}>초기화</button>
    </div>
    <label className="time-rate">화면 재생<select aria-label="화면 재생 속도" value={controller.rate} onChange={e => controller.setRate(Number(e.target.value))}>
      {[1, 2, 5, 10].map(rate => <option key={rate} value={rate}>{rate} 시각/초</option>)}
    </select></label>
    <output className="time-current" aria-label="시뮬레이션 시각" data-time={session.time}>t = {session.time.toLocaleString('en-US', { maximumFractionDigits: 2 })} µs · {session.error || session.invalid ? '오류로 정지' : running ? '실행 중' : '일시정지'}</output>
    {!session.hasEvents && !session.error && !session.invalid && <span className="time-no-events">예약 이벤트 없음 · 입력 변경은 즉시 계산됩니다. 시간 진행은 Clock이 필요합니다.</span>}
    {session.error && <span role="alert" className="time-error">{session.error}</span>}
  </section>;
}
