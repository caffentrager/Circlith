import type { Circuit, Kind } from '../model/circuit';

export type CircuitLabels = { components: Map<string, string>; pins: Map<string, string>; nets: Map<string, string> };

/** Session numbers belong to identities, so deleting another object never renumbers a surviving object. */
export class CircuitLabelRegistry {
  private components = new Map<string, number>();
  private counts = new Map<Kind, number>();
  private nets = new Map<string, number>();
  labels(circuit: Circuit): CircuitLabels {
    const components = new Map<string, string>(), pins = new Map<string, string>(), nets = new Map<string, string>();
    for (const c of Object.values(circuit.components)) {
      if (!this.components.has(c.id)) {
        const n = (this.counts.get(c.kind) ?? 0) + 1;
        this.counts.set(c.kind, n); this.components.set(c.id, n);
      }
      components.set(c.id, c.name === c.kind ? `${c.kind} ${this.components.get(c.id)}` : c.name);
      for (const id of c.pins) pins.set(id, circuit.pins[id].direction === 'out' ? 'O' : `I${circuit.pins[id].index}`);
    }
    for (const net of Object.values(circuit.nets)) {
      if (!this.nets.has(net.id)) this.nets.set(net.id, this.nets.size + 1);
      nets.set(net.id, `N${this.nets.get(net.id)}`);
    }
    return { components, pins, nets };
  }
}
