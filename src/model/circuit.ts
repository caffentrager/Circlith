export const gateKinds = ["AND", "OR", "NOT", "XOR", "NAND", "NOR", "XNOR"] as const;
export type GateKind = typeof gateKinds[number];
export const memoryPorts = {
  DFF: ['D', 'CLK', 'Q'], JKFF: ['J', 'K', 'CLK', 'Q'], TFF: ['T', 'CLK', 'Q'],
  SRFF: ['S', 'R', 'CLK', 'Q'], DFFE: ['D', 'EN', 'CLK', 'Q'], DFFSR: ['D', 'CLK', 'S', 'R', 'Q'],
  DLatch: ['D', 'EN', 'Q'], SRLatch: ['S', 'R', 'Q'],
} as const;
export type MemoryKind = keyof typeof memoryPorts;
export type Kind = "Input" | GateKind | "Output" | "Clock" | MemoryKind;
export const memoryKinds = Object.keys(memoryPorts) as MemoryKind[];
export const isMemory = (kind: Kind): kind is MemoryKind => Object.hasOwn(memoryPorts, kind);
export const isFlipFlop = (kind: Kind) => isMemory(kind) && kind !== 'DLatch' && kind !== 'SRLatch';
export const clockPinIndex = (kind: Kind) => isMemory(kind) ? (memoryPorts[kind] as readonly string[]).indexOf('CLK') : -1;
export const isSequential = (kind: Kind) => kind === 'Clock' || isMemory(kind);
export const componentKinds: Kind[] = [...gateKinds, "Input", "Output", "Clock", ...memoryKinds];
export const isGate = (kind: Kind) => (gateKinds as readonly string[]).includes(kind);
export const isBinaryGate = (kind: Kind) => isGate(kind) && kind !== "NOT";
export const MAX_GATE_INPUTS = 16;
export const gateInputCount = (component: Component) => isMemory(component.kind) ? memoryPorts[component.kind].length - 1 : isBinaryGate(component.kind) ? component.pins.length - 1 : 1;
export const gateHalfHeight = (count: number) => Math.max(20, count * 10);
export const inputY = (index: number, count: number) => (index - (count - 1) / 2) * 20;
export type Point = { x: number; y: number };
export type Component = {
  id: string;
  kind: Kind;
  name: string;
  pins: string[];
  clock?: { period: number; duty: number; initial: '0' | '1' };
  dff?: { edge: 'rising' | 'falling'; initial: '0' | '1' | 'X' };
  memory?: { edge: 'rising' | 'falling'; initial: '0' | '1' | 'X'; activeLevel: 'high' | 'low' };
};
export type Pin = {
  id: string;
  component: string;
  index: number;
  direction: "in" | "out";
  inverted?: boolean;
};
export type Endpoint = { type: "pin" | "junction"; id: string };
// A wire hit stays a draft reference until the explicit connection is committed.
export type ConnectionTarget = Endpoint | { type: "wire"; id: string; position: Point };
export type Placement = { position: Point; rotation: number };
export type Circuit = {
  components: Record<string, Component>;
  pins: Record<string, Pin>;
  nets: Record<string, { id: string; pins: string[]; junctions: string[] }>;
  junctions: Record<string, { id: string; net: string }>;
  geometry: {
    components: Record<string, Placement>;
    junctions: Record<string, Point>;
    wires: Record<
      string,
      { id: string; net: string; from: Endpoint; to: Endpoint; points: Point[]; anchors?: Point[] }
    >;
  };
};
export const emptyCircuit = (): Circuit => ({
  components: {},
  pins: {},
  nets: {},
  junctions: {},
  geometry: { components: {}, junctions: {}, wires: {} },
});
export const clone = <T>(value: T): T => structuredClone(value);
export const id = () => crypto.randomUUID();
export function addComponent(
  c: Circuit,
  kind: Kind,
  position: Point,
  rotation = 0,
) {
  const key = id();
  const count = isMemory(kind) ? memoryPorts[kind].length : isBinaryGate(kind) ? 3 : kind === "NOT" ? 2 : 1;
  const pins = Array.from({ length: count }, (_, index) => {
    const pin = id();
    c.pins[pin] = {
      id: pin,
      component: key,
      index,
      direction:
        kind === "Input" || kind === 'Clock' || (kind === "NOT" && index === 1) || ((isMemory(kind) || isBinaryGate(kind)) && index === count - 1) ? "out" : "in",
    };
    return pin;
  });
  c.components[key] = { id: key, kind, name: kind, pins,
    ...(kind === 'Clock' ? { clock: { period: 10, duty: 50, initial: '0' as const } } : {}),
    ...(kind === 'DFF' ? { dff: { edge: 'rising' as const, initial: 'X' as const } } : {}),
    ...(isMemory(kind) && kind !== 'DFF' ? { memory: { edge: 'rising' as const, initial: 'X' as const, activeLevel: 'high' as const } } : {}) };
  c.geometry.components[key] = { position, rotation };
  return key;
}
export function connect(
  c: Circuit,
  from: Endpoint,
  to: Endpoint,
  points: Point[],
  anchors?: Point[],
) {
  const owners = Object.values(c.nets).filter((n) =>
    [from, to].some((e) =>
      e.type === "pin" ? n.pins.includes(e.id) : n.junctions.includes(e.id),
    ),
  );
  const net = mergeNets(c, owners.map((n) => n.id));
  for (const e of [from, to]) {
    const list = e.type === "pin" ? c.nets[net].pins : c.nets[net].junctions;
    if (!list.includes(e.id)) list.push(e.id);
  }
  const key = id();
  c.geometry.wires[key] = { id: key, net, from, to, points, ...(anchors?.length ? { anchors: clone(anchors) } : {}) };
}
export function mergeNets(c: Circuit, ids: string[]): string {
  const net = ids[0] ?? id();
  c.nets[net] ??= { id: net, pins: [], junctions: [] };
  for (const oldId of new Set(ids.slice(1))) {
    if (oldId === net) continue;
    const old = c.nets[oldId];
    if (!old) throw new Error("연결망을 찾을 수 없습니다.");
    c.nets[net].pins.push(...old.pins);
    c.nets[net].junctions.push(...old.junctions);
    for (const w of Object.values(c.geometry.wires)) if (w.net === oldId) w.net = net;
    for (const j of Object.values(c.junctions)) if (j.net === oldId) j.net = net;
    delete c.nets[oldId];
  }
  c.nets[net].pins = [...new Set(c.nets[net].pins)];
  c.nets[net].junctions = [...new Set(c.nets[net].junctions)];
  return net;
}
export function electricalGraph(c: Circuit) {
  return JSON.stringify({
    components: c.components,
    pins: c.pins,
    nets: c.nets,
    junctions: c.junctions,
    // Endpoint ownership is electrical even though wire routes live in geometry.
    wires: Object.values(c.geometry.wires).sort((a, b) => a.id.localeCompare(b.id))
      .map(({ id, net, from, to }) => ({ id, net, from, to })),
  });
}
