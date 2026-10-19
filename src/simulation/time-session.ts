import { isMemory, isFlipFlop, clockPinIndex, isSequential, type Circuit, type Component } from '../model/circuit';
import { clockProperties, memoryProperties } from '../model/temporal-properties';
import { compileCircuit, simulate, type SimulationResult } from './simulator';
import type { LogicValue } from './logic';
import { nextMemory, conflictingSetReset } from './memory';

export type TimeStep = 'event' | 'rising' | 'period';
export type TraceSample = { time: number; values: Record<string, LogicValue> };
type Clock = { part: Component; next: number; level: '0' | '1' };
const TICKS = 100; // Integer centimicroseconds: period(µs) × duty(%) has no rounding.
export const TRACE_LIMIT = 512, WATCH_LIMIT = 32, STEP_EVENT_LIMIT = 2048;

/** A session owns time and state, never the editor history or the circuit. */
export class TimeSession {
  private plan;
  private ticks = 0;
  private clocks: Clock[] = [];
  private state: Record<string, LogicValue> = {};
  private previousClocks: Record<string, LogicValue> = {};
  private inputs: Record<string, LogicValue>;
  result!: SimulationResult;
  samples: TraceSample[] = [];
  watch: string[] = [];
  dropped = 0;
  error: string | null = null;
  get time() { return this.ticks / TICKS; }
  get inputValues(): Readonly<Record<string, LogicValue>> { return this.inputs; }
  get hasEvents() { return !this.error && this.clocks.length > 0 && !this.invalid; }
  get invalid() { return this.result.diagnostics.some(d => d.code === 'INVALID_CIRCUIT'); }
  get clockIds() { return this.clocks.map(c => c.part.id); }

  constructor(readonly circuit: Circuit, inputs: Readonly<Record<string, LogicValue>> = {}) {
    this.plan = compileCircuit(circuit);
    this.inputs = Object.fromEntries(Object.entries(inputs).filter(([id]) => circuit.components[id]?.kind === 'Input'));
    this.watch = Object.values(circuit.components).filter(p => isSequential(p.kind) || p.kind === 'Input' || p.kind === 'Output')
      .slice(0, WATCH_LIMIT).map(p => 'pin:' + (p.kind === 'Output' ? p.pins[0] : p.pins.at(-1)!));
    this.reset();
  }

  reset() {
    this.ticks = 0; this.state = {}; this.previousClocks = {}; this.clocks = [];
    this.error = null; this.dropped = 0; this.samples = [];
    // Invalid circuits are displayed as errors and never scheduled.
    const initial = simulate(this.plan, this.inputs);
    if (initial.diagnostics.some(d => d.code === 'INVALID_CIRCUIT')) { this.result = initial; this.record(); return; }
    for (const part of Object.values(this.circuit.components)) {
      if (part.kind === 'Clock') {
        const p = clockProperties(part);
        this.state[part.id] = p.initial;
        this.clocks.push({ part, level: p.initial, next: p.period * (p.initial === '1' ? p.duty : 100 - p.duty) });
      } else if (isMemory(part.kind)) this.state[part.id] = memoryProperties(part).initial;
    }
    this.result = this.evaluate();
    const saved = this.checkpoint();
    try { this.settle(true); }
    catch (reason) { this.fail(saved, reason); }
    this.record();
  }

  private memories() { return Object.values(this.circuit.components).filter(p => isMemory(p.kind)); }
  private evaluate() {
    const result = simulate(this.plan, this.inputs, this.state, true);
    for (const gate of this.plan.feedbackGates) this.state[gate.id] = result.pins[gate.pins.at(-1)!] ?? 'X';
    return result;
  }
  private readSignal(key: string): LogicValue | undefined {
    return key.startsWith('pin:') ? this.result.pins[key.slice(4)] : key.startsWith('net:') ? this.result.nets[key.slice(4)] : undefined;
  }
  private record() {
    const values = Object.fromEntries(this.watch.flatMap(key => {
      const value = this.readSignal(key); return value === undefined ? [] : [[key, value]];
    }));
    const sample = { time: this.time, values };
    if (this.samples.at(-1)?.time === this.time) this.samples[this.samples.length - 1] = sample;
    else this.samples.push(sample);
    if (this.samples.length > TRACE_LIMIT) { this.samples.shift(); this.dropped++; }
  }
  setWatch(keys: string[]) {
    const unique = [...new Set(keys)];
    if (unique.length > WATCH_LIMIT || unique.some(key => key.startsWith('pin:') ? !this.circuit.pins[key.slice(4)] : key.startsWith('net:') ? !this.circuit.nets[key.slice(4)] : true))
      throw new Error('관측 신호는 유효한 핀·연결망 최대 32개입니다.');
    this.watch = unique;
    this.record(); // New signals have no fabricated history.
  }

  private checkpoint() {
    return { ticks: this.ticks, state: { ...this.state }, previousClocks: { ...this.previousClocks },
      clocks: this.clocks.map(c => ({ ...c })), inputs: { ...this.inputs }, result: this.result,
      samples: [...this.samples], dropped: this.dropped };
  }
  private fail(saved: ReturnType<TimeSession['checkpoint']>, reason: unknown) {
    Object.assign(this, saved);
    this.error = reason instanceof Error ? reason.message : String(reason);
    this.result = { ...this.result, diagnostics: [...this.result.diagnostics,
      { code: 'SEQUENTIAL_LIMIT', severity: 'error', message: this.error, objects: [] }] };
    return false;
  }
  private settle(initializing = false) {
    this.result = this.evaluate();
    const parts = this.memories();
    for (let delta = 0; delta < 64; delta++) {
      const next = { ...this.state };
      let changed = false;
      // Every FF samples the same settled pre-update result. Commit all Qs together.
      for (const part of parts) {
        const inputs = part.pins.slice(0, -1).map(id => this.result.pins[id]);
        const value = nextMemory(part, inputs, this.state[part.id], this.previousClocks[part.id], initializing);
        if (isFlipFlop(part.kind)) this.previousClocks[part.id] = inputs[clockPinIndex(part.kind)];
        changed ||= value !== next[part.id];
        next[part.id] = value;
      }
      if (!changed) {
        for (const part of parts) if (conflictingSetReset(part, part.pins.slice(0, -1).map(id => this.result.pins[id])))
          this.result.diagnostics.push({ code: 'INVALID_SEQUENTIAL_INPUT', severity: 'warning', objects: [part.id],
            message: `${part.name}: S와 R이 동시에 1입니다. SR 래치·비동기 S/R은 즉시, SR 플립플롭은 동작 엣지에서 Q=X가 됩니다.` });
        return;
      }
      this.state = next;
      this.result = this.evaluate();
    }
    throw new Error('동일 시각의 순차 상태가 64회 안에 안정되지 않았습니다. 마지막 확정 상태로 돌아갑니다.');
  }
  setInputs(inputs: Readonly<Record<string, LogicValue>>) {
    const next = Object.fromEntries(Object.entries(inputs).filter(([id]) => this.circuit.components[id]?.kind === 'Input'));
    if (JSON.stringify(next) === JSON.stringify(this.inputs) || this.error || this.invalid) return false;
    const saved = this.checkpoint();
    try { this.inputs = next; this.settle(); this.record(); return true; }
    catch (reason) { return this.fail(saved, reason); }
  }
  private event() {
    const at = Math.min(...this.clocks.map(c => c.next));
    if (!Number.isSafeInteger(at)) throw new Error('시간 정밀도 한도에 도달했습니다. 초기화 후 다시 실행하세요.');
    this.ticks = at;
    // All simultaneous source edges are applied before any FF samples.
    for (const c of this.clocks) if (c.next === at) {
      c.level = c.level === '0' ? '1' : '0';
      this.state[c.part.id] = c.level;
      const p = clockProperties(c.part);
      c.next += p.period * (c.level === '1' ? p.duty : 100 - p.duty);
    }
    this.settle(); this.record();
  }
  step(kind: TimeStep = 'event', clockId = this.clocks[0]?.part.id) {
    if (!this.hasEvents) return false;
    const selected = this.clocks.find(c => c.part.id === clockId);
    if (kind !== 'event' && !selected) return false;
    const saved = this.checkpoint();
    try {
      if (kind === 'event') this.event();
      else {
        const p = clockProperties(selected!.part);
        const target = kind === 'period' ? this.ticks + p.period * TICKS
          : selected!.next + (selected!.level === '1' ? p.period * (100 - p.duty) : 0);
        if (!Number.isSafeInteger(target)) throw new Error('시간 정밀도 한도에 도달했습니다.');
        let count = 0;
        while (Math.min(...this.clocks.map(c => c.next)) <= target) {
          if (++count > STEP_EVENT_LIMIT) throw new Error('Step당 2048개 시각 한도를 넘었습니다. 다음 이벤트로 나누어 진행하세요.');
          this.event();
        }
        this.ticks = target; this.record();
      }
      return true;
    } catch (reason) { return this.fail(saved, reason); }
  }
}
