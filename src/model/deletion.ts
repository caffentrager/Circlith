import { clone, id, type Circuit, type Endpoint } from "./circuit";
import { pinPosition } from "../geometry/geometry";
import { assertCircuit } from "./connections";

// Deletion is an explicit electrical edit. Repartition by endpoint identities, never coordinates.
export function deleteObjects(c: Circuit, selection: string[]): Circuit {
  const next = clone(c),
    selected = new Set(selection);
  for (const key of selected) delete next.geometry.wires[key];
  for (const key of selected) {
    const comp = next.components[key];
    if (!comp) continue;
    for (const pin of comp.pins) {
      const attached = Object.values(next.geometry.wires).filter((w) =>
        [w.from, w.to].some((e) => e.type === "pin" && e.id === pin),
      );
      if (attached.length) {
        const junction = id();
        next.junctions[junction] = { id: junction, net: attached[0].net };
        next.geometry.junctions[junction] = pinPosition(next, pin);
        for (const w of attached)
          for (const side of ["from", "to"] as const)
            if (w[side].type === "pin" && w[side].id === pin)
              w[side] = { type: "junction", id: junction };
      }
      delete next.pins[pin];
    }
    delete next.components[key];
    delete next.geometry.components[key];
  }
  const used = new Set(
    Object.values(next.geometry.wires).flatMap((w) =>
      [w.from, w.to].filter((e) => e.type === "junction").map((e) => e.id),
    ),
  );
  for (const key of Object.keys(next.junctions))
    if (!used.has(key)) {
      delete next.junctions[key];
      delete next.geometry.junctions[key];
    }
  const token = (e: Endpoint) => `${e.type}:${e.id}`;
  const adjacency = new Map<string, string[]>(),
    endpoints = new Map<string, Endpoint>();
  for (const w of Object.values(next.geometry.wires)) {
    const a = token(w.from),
      b = token(w.to);
    endpoints.set(a, w.from);
    endpoints.set(b, w.to);
    adjacency.set(a, [...(adjacency.get(a) ?? []), b]);
    adjacency.set(b, [...(adjacency.get(b) ?? []), a]);
  }
  const owners = new Map<string, string>(),
    usedNets = new Set<string>();
  next.nets = {};
  for (const w of Object.values(next.geometry.wires)) {
    if (owners.has(token(w.from))) continue;
    const net = usedNets.has(w.net) ? id() : w.net;
    usedNets.add(net);
    const record = { id: net, pins: [] as string[], junctions: [] as string[] };
    next.nets[net] = record;
    const queue = [token(w.from)];
    while (queue.length) {
      const key = queue.pop()!;
      if (owners.has(key)) continue;
      owners.set(key, net);
      const e = endpoints.get(key)!;
      if (e.type === "pin") record.pins.push(e.id);
      else {
        record.junctions.push(e.id);
        next.junctions[e.id].net = net;
      }
      queue.push(...(adjacency.get(key) ?? []));
    }
  }
  for (const w of Object.values(next.geometry.wires))
    w.net = owners.get(token(w.from))!;
  assertCircuit(next);
  return next;
}
