import { clone, gateInputCount, id, isBinaryGate, MAX_GATE_INPUTS, type Circuit } from './circuit';
import { endpointPosition, pinPosition, route } from '../geometry/geometry';
import { same, simplifyPath } from '../geometry/path';
import { assertCircuit } from './connections';

export type ComponentProperties = { name: string; inputCount: number; invertedInputs: boolean[] };

/** Preserve retained pin IDs (including the output), nets and manually fixed wire anchors. */
export function updateComponentProperties(circuit: Circuit, key: string, properties: ComponentProperties): Circuit {
  const original = circuit.components[key];
  if (!original) throw new Error('부품을 찾을 수 없습니다.');
  const name = properties.name.trim(), variable = isBinaryGate(original.kind);
  const count = properties.inputCount;
  if (!name || name.length > 80) throw new Error('이름은 1~80자로 입력하세요.');
  if (!Number.isInteger(count) || (variable ? count < 2 || count > MAX_GATE_INPUTS : count !== 1))
    throw new Error(`입력 수는 2~${MAX_GATE_INPUTS}개로 지정하세요.`);
  const next = clone(circuit), component = next.components[key];
  if (variable) {
    const oldInputs = original.pins.slice(0, -1), removed = new Set(oldInputs.slice(count));
    if (Object.values(circuit.nets).some(net => net.pins.some(pin => removed.has(pin))))
      throw new Error('줄어드는 입력에 배선이 연결되어 있습니다. 해당 배선을 먼저 해제하세요.');
    const inputs = oldInputs.slice(0, count);
    while (inputs.length < count) {
      const pin = id();
      next.pins[pin] = { id: pin, component: key, index: inputs.length, direction: 'in' };
      inputs.push(pin);
    }
    for (const pin of removed) delete next.pins[pin];
    component.pins = [...inputs, original.pins.at(-1)!];
    component.pins.forEach((pin, index) => { next.pins[pin].index = index; });
  }
  component.name = name;
  const gate = component.kind !== 'Input' && component.kind !== 'Output';
  component.pins.filter(pin => next.pins[pin].direction === 'in').forEach((pin, index) => {
    if (gate && properties.invertedInputs[index]) next.pins[pin].inverted = true;
    else delete next.pins[pin].inverted;
  });
  if (variable && count !== gateInputCount(original)) {
    for (const wire of Object.values(next.geometry.wires)) {
      for (const side of ['from', 'to'] as const) {
        const endpoint = wire[side];
        if (endpoint.type !== 'pin' || next.pins[endpoint.id].component !== key ||
          same(pinPosition(circuit, endpoint.id), pinPosition(next, endpoint.id))) continue;
        const points = side === 'from' ? wire.points : [...wire.points].reverse();
        const start = endpointPosition(next, endpoint), fixed = points[1] ?? points[0];
        // Keep the original first point as a route stop when it is a pinned waypoint.
        const keep = wire.anchors?.some(anchor => same(anchor, points[0]));
        const stop = keep ? points[0] : fixed;
        const stretched = simplifyPath([...route(start, stop, points[0].y === fixed.y), ...points.slice(keep ? 1 : 2)]);
        wire.points = side === 'from' ? stretched : stretched.reverse();
      }
    }
  }
  assertCircuit(next);
  return next;
}
