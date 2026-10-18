import type { GateKind } from '../model/circuit';

export const logicValues = ['0', '1', 'X', 'Z'] as const;
export type LogicValue = typeof logicValues[number];
export const invert = (value: LogicValue): LogicValue => value === '0' ? '1' : value === '1' ? '0' : 'X';

/** Z is a released driver on nets and an unknown value at ordinary gate inputs. */
export function resolveDrivers(values: readonly LogicValue[]): LogicValue {
  let result: LogicValue = 'Z';
  for (const value of values) {
    if (value === 'Z') continue;
    if (result === 'Z') result = value;
    else if (result !== value) return 'X';
  }
  return result;
}

export function evaluateGate(kind: GateKind, inputs: readonly LogicValue[]): LogicValue {
  if (kind === 'NOT') return invert(inputs[0] ?? 'X');
  if (inputs.length !== 2) return 'X';
  let result: LogicValue;
  if (kind === 'AND' || kind === 'NAND') {
    result = inputs.includes('0') ? '0' : inputs.every(v => v === '1') ? '1' : 'X';
  } else if (kind === 'OR' || kind === 'NOR') {
    result = inputs.includes('1') ? '1' : inputs.every(v => v === '0') ? '0' : 'X';
  } else {
    result = inputs.every(v => v === '0' || v === '1') ? (inputs[0] === inputs[1] ? '0' : '1') : 'X';
  }
  return kind === 'NAND' || kind === 'NOR' || kind === 'XNOR' ? invert(result) : result;
}
