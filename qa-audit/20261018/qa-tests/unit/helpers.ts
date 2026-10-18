import { writeFileSync, appendFileSync, mkdirSync } from 'node:fs';
import { addComponent, clone, connect, emptyCircuit, type Circuit, type Kind } from '../src/model/circuit';
import { pinPosition, route } from '../src/geometry/geometry';
import { compileCircuit, simulate } from '../src/simulation/simulator';
import type { LogicValue } from '../src/simulation/logic';

export const EVIDENCE = 'D:/Circlith/build/qa-audit-20261018/evidence';
export const record = (name: string, data: unknown) => {
  mkdirSync(EVIDENCE, { recursive: true });
  writeFileSync(`${EVIDENCE}/${name}.json`, JSON.stringify(data, null, 2));
};
export const log = (name: string, line: string) => appendFileSync(`${EVIDENCE}/${name}.log`, line + '\n');

export const wirePins = (c: Circuit, a: string, b: string) =>
  connect(c, { type: 'pin', id: a }, { type: 'pin', id: b }, route(pinPosition(c, a), pinPosition(c, b)));
export const run = (c: Circuit, inputs: Record<string, LogicValue> = {}) => simulate(compileCircuit(c), inputs);

/** Fresh builder; components laid out on a loose grid, wiring by (component, input-index). */
export function builder() {
  const c = emptyCircuit();
  let n = 0;
  const add = (kind: Kind, rotation = 0) => addComponent(c, kind, { x: 100 + (n % 8) * 200, y: 100 + Math.floor(n++ / 8) * 200 }, rotation);
  const out = (comp: string) => c.components[comp].pins.at(-1)!;
  const inp = (comp: string, i = 0) => c.components[comp].pins[i];
  const wire = (from: string, to: string, i = 0) => wirePins(c, out(from), inp(to, i));
  return { c, add, out, inp, wire };
}

/** Replace every occurrence of an ID (keys and values) – used for ID-renaming metamorphic tests. */
export function renameIds(c: Circuit, map: Record<string, string>): Circuit {
  let text = JSON.stringify(c);
  for (const [from, to] of Object.entries(map)) text = text.split(JSON.stringify(from)).join(JSON.stringify(to));
  return JSON.parse(text);
}

/** mulberry32 – fixed-seed PRNG */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
export const V: LogicValue[] = ['0', '1', 'X', 'Z'];
export { clone };
