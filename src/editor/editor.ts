import {
  addComponent,
  clone,
  connect,
  emptyCircuit,
  type Circuit,
  type Endpoint,
  type Kind,
  type Point,
} from "../model/circuit";
import {
  clean,
  boxComponents,
  boxWires,
  endpointPosition,
  route,
  transform,
} from "../geometry/geometry";
import { editWirePath, replaceWirePath, simpleWirePath, simplifyPath, type WireEditKind } from "../geometry/wire-edit";
export type Draft =
  | { type: "PLACE"; kind: Kind; position: Point; rotation: number }
  | { type: "MOVE"; origin: Point; position: Point; selection: string[] }
  | { type: "SEGMENT_MOVE"; wire: string; index: number; kind: WireEditKind; origin: Point; position: Point; points: Point[] }
  | { type: "WIRE_ROUTE"; wire: string; waypoints: Point[]; checkpoints: Point[][]; position: Point; horizontal: boolean }
  | {
      type: "WIRE_DRAFT";
      from: Endpoint;
      waypoints: Point[];
      checkpoints: Point[][];
      position: Point;
      horizontal: boolean;
    };
export type Command = { label: string; before: Circuit; after: Circuit };
export class Editor {
  circuit = emptyCircuit();
  selection: string[] = [];
  tool: "SELECT" | "WIRE" = "SELECT";
  draft: Draft | null = null;
  selectionBox: {
    start: Point;
    end: Point;
    base: string[];
    additive: boolean;
  } | null = null;
  transient: "NONE" | "PAN" = "NONE";
  focus: "CANVAS" | "TEXT_EDITOR" | "MODAL" | "IME_COMPOSING" = "CANVAS";
  viewport = { x: 0, y: 0, zoom: 1 };
  history: Command[] = [];
  future: Command[] = [];
  get operation() {
    return this.selectionBox ? "BOX_SELECT" : (this.draft?.type ?? "NONE");
  }
  commit(label: string, after: Circuit) {
    if (JSON.stringify(after) === JSON.stringify(this.circuit)) return;
    this.history.push({
      label,
      before: clone(this.circuit),
      after: clone(after),
    });
    this.circuit = clone(after);
    this.future = [];
    this.pruneSelection();
  }
  private pruneSelection() {
    this.selection = this.selection.filter(
      (key) => this.circuit.components[key] || this.circuit.geometry.wires[key],
    );
  }
  cancel() {
    this.draft = null;
    this.selectionBox = null;
  }
  beginBox(start: Point, additive = false) {
    if (this.draft || this.selectionBox) return;
    this.selectionBox = {
      start,
      end: start,
      base: [...this.selection],
      additive,
    };
  }
  updateBox(end: Point) {
    if (this.selectionBox) this.selectionBox.end = end;
  }
  finishBox(dragged: boolean) {
    const box = this.selectionBox;
    if (!box) return;
    const found = dragged
      ? [
          ...boxComponents(this.circuit, box.start, box.end),
          ...boxWires(this.circuit, box.start, box.end),
        ]
      : [];
    this.selection = box.additive
      ? [...new Set([...box.base, ...found])]
      : found;
    this.selectionBox = null;
  }
  undo() {
    if (this.draft || this.selectionBox) {
      this.cancel();
      return;
    }
    const cmd = this.history.pop();
    if (cmd) {
      this.future.push(cmd);
      this.circuit = clone(cmd.before);
      this.pruneSelection();
    }
  }
  redo() {
    if (this.draft || this.selectionBox) return;
    const cmd = this.future.pop();
    if (cmd) {
      this.history.push(cmd);
      this.circuit = clone(cmd.after);
    }
  }
  setTool(tool: "SELECT" | "WIRE") {
    this.cancel();
    this.tool = tool;
  }
  place(kind: Kind, position: Point) {
    this.cancel();
    this.tool = "SELECT";
    this.draft = { type: "PLACE", kind, position, rotation: 0 };
  }
  move(origin: Point) {
    const components = this.selection.filter((key) => this.circuit.components[key]);
    if (components.length && !this.draft && !this.selectionBox)
      this.draft = {
        type: "MOVE",
        origin,
        position: origin,
        selection: components,
      };
  }
  update(position: Point) {
    if (this.draft && this.transient === "NONE") this.draft.position = position;
  }
  beginWireEdit(wire: string, index: number, kind: WireEditKind, origin: Point) {
    if (this.draft || this.selectionBox || !this.circuit.geometry.wires[wire]) return;
    this.tool = "SELECT";
    this.selection = [wire];
    this.draft = { type: "SEGMENT_MOVE", wire, index, kind, origin, position: origin,
      points: simplifyPath(this.circuit.geometry.wires[wire].points) };
  }
  rerouteWire(wire: string) {
    if (this.draft || this.selectionBox || !this.circuit.geometry.wires[wire]) return;
    const start = endpointPosition(this.circuit, this.circuit.geometry.wires[wire].from);
    this.tool = "SELECT";
    this.selection = [wire];
    this.draft = { type: "WIRE_ROUTE", wire, waypoints: [start], checkpoints: [], position: start, horizontal: true };
  }
  routePoints() {
    const d = this.draft;
    if (d?.type !== "WIRE_ROUTE") return [];
    const end = endpointPosition(this.circuit, this.circuit.geometry.wires[d.wire].to);
    return simplifyPath([...d.waypoints.slice(0, -1),
      ...route(d.waypoints[d.waypoints.length - 1], d.position, d.horizontal),
      ...route(d.position, end, !d.horizontal).slice(1)]);
  }
  tidyWires(horizontal: boolean) {
    if (this.draft || this.selectionBox) return;
    let after = this.circuit;
    for (const key of this.selection)
      if (after.geometry.wires[key]) after = replaceWirePath(after, key, simpleWirePath(after, key, horizontal));
    this.commit("Tidy wires", after);
  }
  preview() {
    const d = this.draft;
    if (d?.type === "SEGMENT_MOVE")
      return replaceWirePath(this.circuit, d.wire,
        editWirePath(d.points, d.index, d.kind, { x: d.position.x - d.origin.x, y: d.position.y - d.origin.y }));
    if (d?.type === "WIRE_ROUTE") return replaceWirePath(this.circuit, d.wire, this.routePoints());
    if (d?.type === "MOVE")
      return transform(this.circuit, d.selection, {
        x: d.position.x - d.origin.x,
        y: d.position.y - d.origin.y,
      });
    return this.circuit;
  }
  rotate(clockwise = false) {
    const rotation = clockwise ? 90 : -90;
    if (this.draft?.type === "PLACE")
      this.draft.rotation = (this.draft.rotation + rotation + 360) % 360;
    else if (!this.draft && !this.selectionBox)
      this.commit(
        "Rotate",
        transform(this.circuit, this.selection, { x: 0, y: 0 }, rotation),
      );
  }
  startWire(from: Endpoint) {
    if (this.draft || this.selectionBox) return;
    const position = endpointPosition(this.circuit, from);
    this.tool = "WIRE";
    this.draft = {
      type: "WIRE_DRAFT",
      from,
      waypoints: [position],
      checkpoints: [],
      position,
      horizontal: true,
    };
  }
  wirePoints() {
    const d = this.draft;
    return d?.type === "WIRE_DRAFT"
      ? clean([
          ...d.waypoints.slice(0, -1),
          ...route(
            d.waypoints[d.waypoints.length - 1],
            d.position,
            d.horizontal,
          ),
        ])
      : [];
  }
  confirm(target?: Endpoint, repeat = false) {
    const d = this.draft;
    if (!d) return;
    if (d.type === "WIRE_DRAFT") {
      if (!target || (target.type === d.from.type && target.id === d.from.id))
        return;
      d.position = endpointPosition(this.circuit, target);
      const points = this.wirePoints();
      if (points.length < 2) return;
      const after = clone(this.circuit);
      connect(after, d.from, target, points);
      this.commit("Wire", after);
    } else if (d.type === "PLACE") {
      const after = clone(this.circuit);
      const key = addComponent(after, d.kind, d.position, d.rotation);
      this.commit("Place", after);
      this.selection = [key];
    } else this.commit(d.type === "MOVE" ? "Move" : "Edit wire path", this.preview());
    this.cancel();
    if (repeat && d.type === "PLACE") this.draft = d;
  }
  waypoint() {
    const d = this.draft;
    if (d?.type === "WIRE_DRAFT" || d?.type === "WIRE_ROUTE") {
      const points = d.type === "WIRE_DRAFT" ? this.wirePoints() : clean([
        ...d.waypoints.slice(0, -1),
        ...route(d.waypoints[d.waypoints.length - 1], d.position, d.horizontal),
      ]);
      if (JSON.stringify(points) !== JSON.stringify(d.waypoints)) {
        d.checkpoints.push(clone(d.waypoints));
        d.waypoints = points;
      }
    }
  }
  backspace() {
    const d = this.draft;
    if (d?.type === "WIRE_DRAFT" || d?.type === "WIRE_ROUTE") {
      const previous = d.checkpoints.pop();
      if (previous) d.waypoints = previous;
      else this.cancel();
    }
  }
  escape() {
    if (this.draft || this.selectionBox) this.cancel();
    else if (this.tool === "WIRE") this.tool = "SELECT";
    else this.selection = [];
  }
}
