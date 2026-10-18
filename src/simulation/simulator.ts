import { gateKinds, type Circuit, type Component, type GateKind } from '../model/circuit';
import { validateCircuit } from '../model/connections';
import { evaluateGate, logicValues, resolveDrivers, type LogicValue } from './logic';

export type DiagnosticCode = 'FLOATING_INPUT' | 'MULTIPLE_DRIVERS' | 'DRIVE_CONFLICT' | 'COMBINATIONAL_FEEDBACK' | 'INVALID_CIRCUIT';
export type Diagnostic = {
  code: DiagnosticCode;
  message: string;
  severity: 'warning' | 'error';
  objects: string[];
};
export type SimulationResult = {
  pins: Record<string, LogicValue>;
  nets: Record<string, LogicValue>;
  outputs: Record<string, LogicValue>;
  diagnostics: Diagnostic[];
};
type Signal = { id: string; pins: string[]; drivers: string[]; objects: string[] };
type Plan = {
  circuit: Circuit;
  signals: Map<string, Signal>;
  pinSignals: Map<string, string>;
  order: Component[];
  cycles: string[][];
  errors: string[];
};

/** Iterative Kosaraju avoids recursion limits on deep combinational circuits. */
function feedbackGroups(edges: Map<string, Set<string>>): string[][] {
  const visited = new Set<string>(), finish: string[] = [];
  for (const root of edges.keys()) {
    if (visited.has(root)) continue;
    visited.add(root);
    const stack = [{ id: root, children: [...edges.get(root)!], index: 0 }];
    while (stack.length) {
      const frame = stack[stack.length - 1];
      if (frame.index === frame.children.length) { finish.push(frame.id); stack.pop(); continue; }
      const child = frame.children[frame.index++];
      if (!visited.has(child)) {
        visited.add(child);
        stack.push({ id: child, children: [...edges.get(child)!], index: 0 });
      }
    }
  }
  const reverse = new Map([...edges.keys()].map(id => [id, new Set<string>()]));
  for (const [from, children] of edges) for (const to of children) reverse.get(to)!.add(from);
  visited.clear();
  const cycles: string[][] = [];
  for (const root of finish.reverse()) {
    if (visited.has(root)) continue;
    const group: string[] = [], stack = [root];
    visited.add(root);
    while (stack.length) {
      const id = stack.pop()!;
      group.push(id);
      for (const child of reverse.get(id)!) if (!visited.has(child)) { visited.add(child); stack.push(child); }
    }
    if (group.length > 1 || edges.get(root)!.has(root)) cycles.push(group);
  }
  return cycles;
}

/** Compile only committed topology. The plan never writes to circuit or editor history. */
export function compileCircuit(circuit: Circuit): Plan {
  const signals = new Map<string, Signal>(), pinSignals = new Map<string, string>();
  const errors = validateCircuit(circuit);
  for (const component of Object.values(circuit.components)) {
    const expected = component.kind === 'Input' || component.kind === 'Output' ? 1 : component.kind === 'NOT' ? 2 : 3;
    if (!['Input', 'Output', ...gateKinds].includes(component.kind) || component.pins.length !== expected ||
      component.pins.some((id, i) => circuit.pins[id]?.index !== i || circuit.pins[id]?.direction !==
        (component.kind === 'Input' || (component.kind !== 'Output' && i === expected - 1) ? 'out' : 'in')))
      errors.push(`지원하지 않거나 잘못된 부품 핀: ${component.name}`);
  }
  if (errors.length) return { circuit, signals, pinSignals, order: [], cycles: [], errors };
  const netWires = new Map<string, string[]>();
  for (const wire of Object.values(circuit.geometry.wires)) {
    const members = netWires.get(wire.net) ?? [];
    members.push(wire.id);
    netWires.set(wire.net, members);
  }
  for (const net of Object.values(circuit.nets)) {
    const objects = netWires.get(net.id) ?? [];
    signals.set(net.id, { id: net.id, pins: net.pins, drivers: net.pins.filter(id => circuit.pins[id].direction === 'out'), objects });
    for (const pin of net.pins) pinSignals.set(pin, net.id);
  }
  for (const pin of Object.values(circuit.pins)) if (!pinSignals.has(pin.id)) {
    const id = `pin:${pin.id}`;
    signals.set(id, { id, pins: [pin.id], drivers: pin.direction === 'out' ? [pin.id] : [], objects: [pin.component] });
    pinSignals.set(pin.id, id);
  }
  const gates = Object.values(circuit.components).filter(c => c.kind !== 'Input' && c.kind !== 'Output');
  const edges = new Map(gates.map(c => [c.id, new Set<string>()]));
  for (const gate of gates) for (const pin of gate.pins.filter(id => circuit.pins[id].direction === 'in')) {
    for (const driver of signals.get(pinSignals.get(pin)!)!.drivers) {
      const source = circuit.pins[driver].component;
      if (edges.has(source)) edges.get(source)!.add(gate.id);
    }
  }
  const cycles = feedbackGroups(edges), cyclic = new Set(cycles.flat());
  const pending = new Map(gates.filter(c => !cyclic.has(c.id)).map(c => [c.id, 0]));
  for (const [source, targets] of edges) if (!cyclic.has(source)) for (const target of targets)
    if (pending.has(target)) pending.set(target, pending.get(target)! + 1);
  const queue = [...pending.keys()].filter(id => pending.get(id) === 0), order: Component[] = [];
  for (let i = 0; i < queue.length; i++) {
    const id = queue[i];
    order.push(circuit.components[id]);
    for (const target of edges.get(id)!) if (pending.has(target)) {
      pending.set(target, pending.get(target)! - 1);
      if (pending.get(target) === 0) queue.push(target);
    }
  }
  return { circuit, signals, pinSignals, order, cycles, errors };
}

export function simulate(plan: Plan, inputs: Readonly<Record<string, LogicValue>> = {}): SimulationResult {
  const result: SimulationResult = { pins: {}, nets: {}, outputs: {}, diagnostics: [] };
  if (plan.errors.length) {
    result.diagnostics.push({ code: 'INVALID_CIRCUIT', severity: 'error', message: `회로 데이터 오류: ${plan.errors.join(' · ')}`, objects: [] });
    return result;
  }
  const { circuit, signals, pinSignals } = plan;
  const drives: Record<string, LogicValue> = {};
  for (const component of Object.values(circuit.components)) {
    for (const pin of component.pins) if (circuit.pins[pin].direction === 'out')
      drives[pin] = component.kind === 'Input' ? (logicValues.includes(inputs[component.id]) ? inputs[component.id] : '0') : 'X';
  }
  const read = (pin: string) => resolveDrivers(signals.get(pinSignals.get(pin)!)!.drivers.map(id => drives[id]));
  for (const gate of plan.order) {
    const inputs = gate.pins.filter(id => circuit.pins[id].direction === 'in').map(read);
    const output = gate.pins.find(id => circuit.pins[id].direction === 'out')!;
    drives[output] = evaluateGate(gate.kind as GateKind, inputs);
  }
  for (const group of plan.cycles) {
    result.diagnostics.push({ code: 'COMBINATIONAL_FEEDBACK', severity: 'warning', objects: group,
      message: `조합 피드백: ${group.length}개 게이트의 출력을 X로 처리합니다. 기억 상태·발진 여부는 계산하지 않습니다.` });
  }
  for (const signal of signals.values()) {
    const values = signal.drivers.map(id => drives[id]), resolved = resolveDrivers(values);
    if (circuit.nets[signal.id]) result.nets[signal.id] = resolved;
    for (const pin of signal.pins) result.pins[pin] = resolved;
    const active = values.filter(v => v !== 'Z');
    const objects = [...new Set([...signal.drivers.map(id => circuit.pins[id].component), ...signal.objects])];
    if (active.length > 1) result.diagnostics.push({ code: 'MULTIPLE_DRIVERS', severity: 'warning', objects,
      message: `다중 구동: 하나의 연결망을 ${active.length}개 출력이 구동합니다.` });
    if (active.includes('0') && active.includes('1')) result.diagnostics.push({ code: 'DRIVE_CONFLICT', severity: 'error', objects,
      message: '출력 충돌: 0과 1이 같은 연결망을 구동하여 X가 됩니다.' });
    if (resolved === 'Z') for (const pin of signal.pins.filter(id => circuit.pins[id].direction === 'in')) {
      const component = circuit.components[circuit.pins[pin].component];
      result.diagnostics.push({ code: 'FLOATING_INPUT', severity: 'warning', objects: [component.id, ...signal.objects],
        message: `${component.name} 입력 ${circuit.pins[pin].index + 1}: 구동 신호가 없습니다(Z).` });
    }
  }
  for (const component of Object.values(circuit.components)) if (component.kind === 'Output')
    result.outputs[component.id] = result.pins[component.pins[0]];
  return result;
}
