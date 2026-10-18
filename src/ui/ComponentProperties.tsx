import { useEffect, useRef, useState } from 'react';
import { gateInputCount, isBinaryGate, MAX_GATE_INPUTS, type Circuit } from '../model/circuit';
import type { ComponentProperties as Values } from '../model/component-properties';

export function ComponentProperties({ circuit, componentId, onApply, onClose }: {
  circuit: Circuit; componentId: string; onApply: (values: Values) => void; onClose: () => void;
}) {
  const component = circuit.components[componentId];
  const [name, setName] = useState(component.name);
  const [inputCount, setInputCount] = useState(String(gateInputCount(component)));
  const [invertedInputs, setInvertedInputs] = useState(component.pins
    .filter(id => circuit.pins[id].direction === 'in').map(id => !!circuit.pins[id].inverted));
  const [error, setError] = useState('');
  const form = useRef<HTMLFormElement>(null);
  const nameInput = useRef<HTMLInputElement>(null);
  useEffect(() => { nameInput.current?.focus(); nameInput.current?.select(); }, []);
  const count = Number(inputCount), variable = isBinaryGate(component.kind);
  const validCount = Number.isInteger(count) && count >= (variable ? 2 : 1) && count <= MAX_GATE_INPUTS;
  const gate = component.kind !== 'Input' && component.kind !== 'Output';
  return <div className="overlay" onKeyDown={event => {
    event.stopPropagation();
    if (event.key === 'Escape' && !event.nativeEvent.isComposing) { event.preventDefault(); onClose(); }
    if (event.key === 'Tab') {
      const controls = [...form.current!.querySelectorAll<HTMLElement>('input,button:not(:disabled)')];
      const first = controls[0], last = controls.at(-1)!;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  }}>
    <section role="dialog" aria-modal="true" aria-labelledby="component-properties-title" className="component-properties">
      <form ref={form} onSubmit={event => {
        event.preventDefault();
        try { onApply({ name, inputCount: count, invertedInputs: invertedInputs.slice(0, count) }); }
        catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
      }}>
        <h2 id="component-properties-title">Properties · 부품 속성</h2>
        <p>{component.kind}</p>
        <label>이름<input ref={nameInput} value={name} maxLength={80} required onChange={event => setName(event.target.value)}/></label>
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
