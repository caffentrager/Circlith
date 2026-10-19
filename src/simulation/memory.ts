import { clockPinIndex, type Component } from '../model/circuit';
import { memoryProperties } from '../model/temporal-properties';
import type { LogicValue } from './logic';

type Bit = '0' | '1';
const choices = (value: LogicValue): Bit[] => value === '0' || value === '1' ? [value] : ['0', '1'];
const merge = (values: LogicValue[]): LogicValue => values.every(v => v === values[0]) ? values[0] : 'X';
const bit = (value: LogicValue): LogicValue => value === '0' || value === '1' ? value : 'X';

// Enumerate unknown controls, preserving a definite result only if every possibility agrees.
function controls(values: LogicValue[], evaluate: (bits: Bit[]) => LogicValue): LogicValue {
  const visit = (index: number, bits: Bit[]): LogicValue[] => index === values.length ? [evaluate(bits)]
    : choices(values[index]).flatMap(value => visit(index + 1, [...bits, value]));
  return merge(visit(0, []));
}
const sr = (s: Bit, r: Bit, q: LogicValue): LogicValue => s === '1' && r === '1' ? 'X' : s === '1' ? '1' : r === '1' ? '0' : q;

export function nextMemory(part: Component, inputs: LogicValue[], q: LogicValue, previousClock: LogicValue, initializing = false): LogicValue {
  const p = memoryProperties(part);
  const sample = () => {
    switch (part.kind) {
      case 'JKFF': return controls([inputs[0], inputs[1], q], ([j, k, old]) => j === '0' ? k === '0' ? old : '0' : k === '0' ? '1' : old === '0' ? '1' : '0');
      case 'TFF': return controls([inputs[0], q], ([t, old]) => t === '0' ? old : old === '0' ? '1' : '0');
      case 'SRFF': return controls([inputs[0], inputs[1]], ([s, r]) => sr(s, r, q));
      case 'DFFE': return controls([inputs[1]], ([en]) => en === '1' ? bit(inputs[0]) : q);
      default: return bit(inputs[0]);
    }
  };
  if (part.kind === 'SRLatch') return controls([inputs[0], inputs[1]], ([s, r]) => sr(s, r, q));
  if (part.kind === 'DLatch') return controls([inputs[1]], ([en]) => en === (p.activeLevel === 'high' ? '1' : '0') ? bit(inputs[0]) : q);
  const clock = inputs[clockPinIndex(part.kind)], from = p.edge === 'rising' ? '0' : '1', to = p.edge === 'rising' ? '1' : '0';
  const definite = previousClock === from && clock === to;
  const uncertain = previousClock !== clock && (previousClock === from || previousClock === 'X' || previousClock === 'Z') &&
    (clock === to || clock === 'X' || clock === 'Z');
  // Preserve the existing DFF's conservative uncertain-edge policy.
  const sampled = initializing ? q : definite ? sample() : uncertain ? 'X' : q;
  if (part.kind === 'DFFSR') return controls([inputs[2], inputs[3]], ([s, r]) => sr(s, r, sampled));
  return sampled;
}

export const conflictingSetReset = (part: Component, inputs: LogicValue[]) => {
  const index = part.kind === 'DFFSR' ? 2 : part.kind === 'SRLatch' || part.kind === 'SRFF' ? 0 : -1;
  return index >= 0 && inputs[index] === '1' && inputs[index + 1] === '1';
};
