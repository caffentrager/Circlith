import { useEffect, useRef, useState } from 'react';
import { gateInputCount, isGate, isBinaryGate, MAX_GATE_INPUTS, type Circuit } from '../model/circuit';
import { clockProperties, dffProperties } from '../model/temporal-properties';
import type { ComponentProperties as Values } from '../model/component-properties';

export function ComponentProperties({ circuit, componentId, onApply, onClose }: {
  circuit: Circuit; componentId: string; onApply: (values: Values) => void; onClose: () => void;
}) {
  const component = circuit.components[componentId];
  const [name, setName] = useState(component.name);
  const [clock, setClock] = useState(clockProperties(component));
  const [dff, setDff] = useState(dffProperties(component));
  const [inputCount, setInputCount] = useState(String(gateInputCount(component)));
  const [invertedInputs, setInvertedInputs] = useState(component.pins
    .filter(id => circuit.pins[id].direction === 'in').map(id => !!circuit.pins[id].inverted));
  const [error, setError] = useState('');
  const form = useRef<HTMLFormElement>(null);
  const nameInput = useRef<HTMLInputElement>(null);
  useEffect(() => { nameInput.current?.focus(); nameInput.current?.select(); }, []);
  const count = Number(inputCount), variable = isBinaryGate(component.kind);
  const validCount = Number.isInteger(count) && count >= (variable ? 2 : 1) && count <= MAX_GATE_INPUTS;
  const gate = isGate(component.kind);
  return <div className="overlay" onMouseDown={event => { if (event.target === event.currentTarget) event.preventDefault(); }} onKeyDown={event => {
    event.stopPropagation();
    if (event.key === 'Escape' && !event.nativeEvent.isComposing) { event.preventDefault(); onClose(); }
    if (event.key === 'Tab') {
      const controls = [...form.current!.querySelectorAll<HTMLElement>('input,select,button:not(:disabled)')];
      const first = controls[0], last = controls.at(-1)!;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  }}>
    <section role="dialog" aria-modal="true" aria-labelledby="component-properties-title" className="component-properties">
      <form ref={form} onSubmit={event => {
        event.preventDefault();
        try { onApply({ name, inputCount: count, invertedInputs: invertedInputs.slice(0, count),
          ...(component.kind === 'Clock' ? { clock } : {}), ...(component.kind === 'DFF' ? { dff } : {}) }); }
        catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
      }}>
        <h2 id="component-properties-title">Properties · 부품 속성</h2>
        <p>{component.kind}</p>
        <label>이름<input ref={nameInput} value={name} maxLength={80} required onChange={event => setName(event.target.value)}/></label>
        {component.kind === 'Clock' && <fieldset><legend>Clock 설정</legend>
          <label>주기 (µs)<input type="number" min="2" max="1000000" step="1" required value={clock.period} onChange={e => setClock({ ...clock, period: Number(e.target.value) })}/></label>
          <label>듀티 (%)<input type="number" min="1" max="99" step="1" required value={clock.duty} onChange={e => setClock({ ...clock, duty: Number(e.target.value) })}/></label>
          <label>초기 레벨<select aria-label="초기 레벨" value={clock.initial} onChange={e => setClock({ ...clock, initial: e.target.value as '0' | '1' })}><option>0</option><option>1</option></select></label>
        </fieldset>}
        {component.kind === 'DFF' && <fieldset><legend>DFF 설정</legend>
          <label>동작 엣지<select aria-label="동작 엣지" value={dff.edge} onChange={e => setDff({ ...dff, edge: e.target.value as 'rising' | 'falling' })}><option value="rising">상승엣지</option><option value="falling">하강엣지</option></select></label>
          <label>초기 Q<select aria-label="초기 Q" value={dff.initial} onChange={e => setDff({ ...dff, initial: e.target.value as '0' | '1' | 'X' })}><option>0</option><option>1</option><option>X</option></select></label>
        </fieldset>}
        {variable && <label>입력 수<input type="number" min="2" max={MAX_GATE_INPUTS} step="1" required value={inputCount}
          onChange={event => setInputCount(event.target.value)}/></label>}
        {gate && <fieldset><legend>입력 반전 버블</legend>
          <p>체크한 입력은 게이트에 들어가기 전에 반전됩니다.</p>
          {validCount && Array.from({ length: count }, (_, index) => <label key={index}>
            <input type="checkbox" checked={!!invertedInputs[index]} onChange={event => {
              const next = [...invertedInputs]; next[index] = event.target.checked; setInvertedInputs(next);
            }}/>입력 {index + 1} 반전
          </label>)}
        </fieldset>}
        {variable && <p>입력 2~{MAX_GATE_INPUTS}개 · 연결된 입력을 줄이려면 해당 배선을 먼저 해제하세요.</p>}
        {error && <p role="alert">{error}</p>}
        <div className="property-actions"><button type="button" onClick={onClose}>취소</button><button type="submit">적용</button></div>
      </form>
    </section>
  </div>;
}
