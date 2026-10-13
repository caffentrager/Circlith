export type Kind = "Input" | "AND" | "Output";
export type Point = { x: number; y: number };
export type Component = {
  id: string;
  kind: Kind;
  name: string;
  pins: string[];
};
export type Pin = {
  id: string;
  component: string;
  index: number;
  direction: "in" | "out";
};
export type Endpoint = { type: "pin" | "junction"; id: string };
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
      { id: string; net: string; from: Endpoint; to: Endpoint; points: Point[] }
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
  const count = kind === "AND" ? 3 : 1;
  const pins = Array.from({ length: count }, (_, index) => {
    const pin = id();
    c.pins[pin] = {
      id: pin,
      component: key,
      index,
      direction:
        kind === "Input" || (kind === "AND" && index === 2) ? "out" : "in",
    };
    return pin;
  });
  c.components[key] = { id: key, kind, name: kind, pins };
  c.geometry.components[key] = { position, rotation };
  return key;
}
export function connect(
  c: Circuit,
  from: Endpoint,
  to: Endpoint,
  points: Point[],
) {
  const owners = Object.values(c.nets).filter((n) =>
    [from, to].some((e) =>
      e.type === "pin" ? n.pins.includes(e.id) : n.junctions.includes(e.id),
    ),
  );
  const net = owners[0]?.id ?? id();
  c.nets[net] ??= { id: net, pins: [], junctions: [] };
  for (const old of owners.slice(1)) {
    c.nets[net].pins.push(...old.pins);
    c.nets[net].junctions.push(...old.junctions);
    for (const w of Object.values(c.geometry.wires))
      if (w.net === old.id) w.net = net;
    for (const j of Object.values(c.junctions))
      if (j.net === old.id) j.net = net;
    delete c.nets[old.id];
  }
  for (const e of [from, to]) {
    const list = e.type === "pin" ? c.nets[net].pins : c.nets[net].junctions;
    if (!list.includes(e.id)) list.push(e.id);
  }
  const key = id();
  c.geometry.wires[key] = { id: key, net, from, to, points };
}
export function electricalGraph(c: Circuit) {
  return JSON.stringify({
    components: c.components,
    pins: c.pins,
    nets: c.nets,
    junctions: c.junctions,
  });
}
