import {
  addComponent,
  clone,
  emptyCircuit,
  type Circuit,
  type ConnectionTarget,
  type Kind,
  type Point,
} from "../model/circuit";
import {
  boxComponents,
  boxWires,
  endpointPosition,
  transform,
} from "../geometry/geometry";
import { editWirePath, replaceWirePath, simplifyPath, type WireEditKind } from "../geometry/wire-edit";
import { assertCircuit, connectTargets, joinCrossing, targetPosition } from "../model/connections";
import { anchorOffsets, pointOnSegment, same } from "../geometry/path";
import { collidingSegments, defaultRouting, planRoute, type RoutingSettings } from "../geometry/routing";
import { applyWireCleanup, planWireCleanup, type WireCleanupPlan } from "../model/wire-cleanup";
export type Draft =
  | { type: "PLACE"; kind: Kind; position: Point; rotation: number }
  | { type: "MOVE"; origin: Point; position: Point; selection: string[]; rotation: number }
  | { type: "SEGMENT_MOVE"; wire: string; index: number; kind: WireEditKind; origin: Point; position: Point; points: Point[] }
  | { type: "WIRE_ROUTE"; wire: string; waypoints: Point[]; checkpoints: Point[][]; position: Point; horizontal: boolean; bendOverride?: boolean }
  | { type: "WIRE_CLEANUP"; position: Point; plan: WireCleanupPlan }
  | {
      type: "WIRE_DRAFT";
      from: ConnectionTarget;
      waypoints: Point[];
      checkpoints: Point[][];
      position: Point;
      horizontal: boolean;
      bendOverride?: boolean;
      to?: ConnectionTarget;
    };
export type Command = { label: string; before: Circuit; after: Circuit };
export class Editor {
  circuit = emptyCircuit();
  routing: RoutingSettings = { ...defaultRouting };
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
        rotation: 0,
      };
  }
  update(position: Point, target?: ConnectionTarget) {
    if (this.draft && this.transient === "NONE") {
      this.draft.position = position;
      if (this.draft.type === "WIRE_DRAFT") this.draft.to = target;
    }
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
    return this.routePlan().points;
  }
  private routeAnchors(d: Extract<Draft, { type: "WIRE_ROUTE" }>) {
    const anchors = clone(d.waypoints.slice(1));
    const end = endpointPosition(this.circuit, this.circuit.geometry.wires[d.wire].to);
    if (!same(d.position, d.waypoints[d.waypoints.length - 1]) && !same(d.position, end)) anchors.push({ ...d.position });
    return anchors;
  }
  routePlan() {
    const d = this.draft;
    if (d?.type !== "WIRE_ROUTE") return { points: [], blocked: false, collisions: [] };
    const w = this.circuit.geometry.wires[d.wire];
    return planRoute(this.circuit, endpointPosition(this.circuit, w.from), endpointPosition(this.circuit, w.to), this.routing,
      { from: w.from, to: w.to, anchors: this.routeAnchors(d),
        horizontal: d.bendOverride ? d.horizontal : undefined });
  }
  tidyWires(horizontal?: boolean) {
    if (this.draft || this.selectionBox) return;
    let after = this.circuit;
    for (const key of this.selection) {
      const w = after.geometry.wires[key];
      if (!w) continue;
      const result = planRoute(after, endpointPosition(after, w.from), endpointPosition(after, w.to), this.routing,
        { from: w.from, to: w.to, horizontal });
      if (result.blocked) throw new Error("우회 경로를 찾지 못했습니다. 부품 위치를 조정하거나 겹침 경고 모드를 선택하세요.");
      after = replaceWirePath(after, key, result.points);
      delete after.geometry.wires[key].anchors;
    }
    this.commit("Tidy wires", after);
  }
  beginWireCleanup() {
    if (this.draft || this.selectionBox) return 0;
    const plan = planWireCleanup(this.circuit, this.selection);
    if (plan.remove.length) {
      this.tool = "SELECT";
      this.draft = { type: "WIRE_CLEANUP", position: { ...this.circuit.geometry.wires[plan.remove[0]].points[0] }, plan };
    }
    return plan.remove.length;
  }
  previewResult(): { circuit: Circuit; blocked: boolean } {
    const d = this.draft;
    if (d?.type === "SEGMENT_MOVE") {
      const next = replaceWirePath(this.circuit, d.wire,
        editWirePath(d.points, d.index, d.kind, { x: d.position.x - d.origin.x, y: d.position.y - d.origin.y }));
      if (JSON.stringify(next.geometry.wires[d.wire].points) === JSON.stringify(this.circuit.geometry.wires[d.wire].points))
        return { circuit: this.circuit, blocked: false };
      next.geometry.wires[d.wire].anchors = next.geometry.wires[d.wire].points.slice(1, -1);
      return { circuit: next, blocked: this.routing.overlapMode === "avoid" && collidingSegments(next, next.geometry.wires[d.wire].points).length > 0 };
    }
    if (d?.type === "WIRE_ROUTE") {
      const result = this.routePlan(), next = replaceWirePath(this.circuit, d.wire, result.points, this.routeAnchors(d));
      return { circuit: next, blocked: result.blocked };
    }
    if (d?.type === "MOVE") {
      if (d.position.x === d.origin.x && d.position.y === d.origin.y && d.rotation === 0) return { circuit: this.circuit, blocked: false };
      const next = transform(this.circuit, d.selection, {
        x: d.position.x - d.origin.x,
        y: d.position.y - d.origin.y,
      }, d.rotation);
      let blocked = false;
      for (const w of Object.values(next.geometry.wires)) {
        const rotatedPin = d.rotation !== 0 && [w.from, w.to].some((e) => e.type === "pin" && d.selection.includes(next.pins[e.id].component));
        const missingAnchor = w.anchors && anchorOffsets(w.points, w.anchors) === null;
        if (!missingAnchor && !(rotatedPin && this.routing.pathMode === "smart") &&
          !(this.routing.overlapMode === "avoid" && collidingSegments(next, w.points, 10).length)) continue;
        const result = planRoute(next, endpointPosition(next, w.from), endpointPosition(next, w.to), this.routing,
          { from: w.from, to: w.to, anchors: w.anchors });
        w.points = result.points; blocked ||= result.blocked;
      }
      return { circuit: next, blocked };
    }
    return { circuit: this.circuit, blocked: false };
  }
  preview() { return this.previewResult().circuit; }
  rotate(clockwise = false) {
    const rotation = clockwise ? 90 : -90;
    if (this.draft?.type === "PLACE")
      this.draft.rotation = (this.draft.rotation + rotation + 360) % 360;
    else if (this.draft?.type === "MOVE") this.draft.rotation = (this.draft.rotation + rotation + 360) % 360;
    else if (!this.draft && !this.selectionBox) {
      this.move({ x: 0, y: 0 });
      const moving = this.draft as Draft | null;
      if (moving?.type === "MOVE") {
        moving.rotation = (rotation + 360) % 360;
        try { this.confirm(); } catch (error) { this.cancel(); throw error; }
      }
    }
  }
  startWire(from: ConnectionTarget) {
    if (this.draft || this.selectionBox) return;
    const position = targetPosition(this.circuit, from);
    const sourceSegment = from.type === "wire" ? this.circuit.geometry.wires[from.id].points : [];
    const index = sourceSegment.findIndex((p, i) => i < sourceSegment.length - 1 && pointOnSegment(p, sourceSegment[i + 1], position));
    this.tool = "WIRE";
    this.draft = {
      type: "WIRE_DRAFT",
      from,
      waypoints: [position],
      checkpoints: [],
      position,
      horizontal: index < 0 || sourceSegment[index].x === sourceSegment[index + 1].x,
    };
  }
  wirePoints() {
    return this.wirePlan().points;
  }
  wirePlan() {
    const d = this.draft;
    return d?.type === "WIRE_DRAFT"
      ? planRoute(this.circuit, d.waypoints[0], d.position, this.routing,
        { from: d.from, to: d.to, anchors: d.waypoints.slice(1), horizontal: d.bendOverride ? d.horizontal : undefined })
      : { points: [], blocked: false, collisions: [] };
  }
  confirm(target?: ConnectionTarget, repeat = false) {
    const d = this.draft;
    if (!d) return;
    if (d.type === "WIRE_DRAFT") {
      if (!target || (target.type !== "wire" && target.type === d.from.type && target.id === d.from.id))
        return;
      d.position = targetPosition(this.circuit, target);
      d.to = target;
      const result = this.wirePlan(), points = result.points;
      if (result.blocked) throw new Error("우회 경로가 없습니다. 고정 경유점이나 부품 위치를 조정하세요.");
      if (points.length < 2) return;
      const after = connectTargets(this.circuit, d.from, target, points, d.waypoints.slice(1));
      if (!after) return;
      this.commit("Wire", after);
    } else if (d.type === "WIRE_CLEANUP") {
      this.commit("Clean up duplicate wire routes", applyWireCleanup(this.circuit, d.plan));
      this.selection = [...new Set([...this.selection, ...d.plan.keep])];
    } else if (d.type === "PLACE") {
      const after = clone(this.circuit);
      const key = addComponent(after, d.kind, d.position, d.rotation);
      this.commit("Place", after);
      this.selection = [key];
    } else {
      const result = this.previewResult();
      if (result.blocked) throw new Error("우회 경로가 없습니다. 고정 경유점이나 부품 위치를 조정하세요.");
      assertCircuit(result.circuit);
      this.commit(d.type === "MOVE" ? "Move / Rotate" : "Edit wire path", result.circuit);
    }
    this.cancel();
    if (repeat && d.type === "PLACE") this.draft = d;
  }
  joinWires(targets: ConnectionTarget[]) {
    if (this.draft || this.selectionBox) return;
    this.commit("Join crossing", joinCrossing(this.circuit, targets));
  }
  selectNet() {
    if (this.draft || this.selectionBox) return;
    const nets = new Set(this.selection.flatMap((key) => this.circuit.geometry.wires[key] ? [this.circuit.geometry.wires[key].net] : []));
    this.selection = Object.values(this.circuit.geometry.wires).filter((w) => nets.has(w.net)).map((w) => w.id);
  }
  waypoint() {
    const d = this.draft;
    if (d?.type === "WIRE_DRAFT" || d?.type === "WIRE_ROUTE") {
      if (JSON.stringify(d.position) !== JSON.stringify(d.waypoints[d.waypoints.length - 1])) {
        d.checkpoints.push(clone(d.waypoints));
        d.waypoints = [...d.waypoints, { ...d.position }];
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
