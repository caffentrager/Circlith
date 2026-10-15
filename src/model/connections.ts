import { clone, connect, id, mergeNets, type Circuit, type ConnectionTarget, type Endpoint, type Point } from "./circuit";
import { endpointPosition } from "../geometry/geometry";
import { pointOnSegment, same, simplifyPath } from "../geometry/path";

export const targetPosition = (c: Circuit, target: ConnectionTarget): Point =>
  target.type === "wire" ? target.position : endpointPosition(c, target);

// Split only the explicitly named wire. Coincident geometry on other nets is untouched.
function splitWire(c: Circuit, wireId: string, point: Point, shared?: string): { endpoint: Endpoint; tail?: string } {
  const wire = c.geometry.wires[wireId];
  if (!wire) throw new Error("선택한 배선이 없습니다.");
  const points = simplifyPath(wire.points);
  if (same(point, points[0])) return { endpoint: wire.from };
  if (same(point, points[points.length - 1])) return { endpoint: wire.to };
  const index = points.findIndex((p, i) => i < points.length - 1 && pointOnSegment(p, points[i + 1], point));
  if (index < 0) throw new Error("분기점이 배선 위에 있어야 합니다.");
  const junction = shared ?? id(), endpoint: Endpoint = { type: "junction", id: junction };
  c.junctions[junction] ??= { id: junction, net: wire.net };
  c.geometry.junctions[junction] = { ...point };
  if (!c.nets[wire.net].junctions.includes(junction)) c.nets[wire.net].junctions.push(junction);
  const tail = id();
  c.geometry.wires[tail] = { ...wire, id: tail, from: endpoint,
    points: simplifyPath([point, ...points.slice(index + 1)]) };
  wire.to = endpoint;
  wire.points = simplifyPath([...points.slice(0, index + 1), point]);
  return { endpoint, tail };
}

function materialize(c: Circuit, target: ConnectionTarget, lineage: Map<string, string[]>): Endpoint {
  if (target.type !== "wire") return target;
  const fragments = lineage.get(target.id) ?? [target.id];
  const fragment = fragments.find((key) => c.geometry.wires[key]?.points.some((p, i, pts) =>
    i < pts.length - 1 && pointOnSegment(p, pts[i + 1], target.position)));
  if (!fragment) throw new Error("배선 접속 후보가 변경되었습니다.");
  const result = splitWire(c, fragment, target.position);
  if (result.tail) fragments.push(result.tail);
  lineage.set(target.id, fragments);
  return result.endpoint;
}

export function connectTargets(c: Circuit, from: ConnectionTarget, to: ConnectionTarget, points: Point[]): Circuit | null {
  if (same(targetPosition(c, from), targetPosition(c, to))) return null;
  const next = clone(c), lineage = new Map<string, string[]>();
  const a = materialize(next, from, lineage), b = materialize(next, to, lineage);
  if (a.type === b.type && a.id === b.id) return null;
  connect(next, a, b, simplifyPath(points));
  assertCircuit(next);
  return next;
}

export function joinCrossing(c: Circuit, targets: ConnectionTarget[]): Circuit {
  if (targets.length < 2 || targets.some((t) => t.type !== "wire")) throw new Error("교차하는 배선 두 개 이상이 필요합니다.");
  const point = targetPosition(c, targets[0]);
  const wires = [...new Set(targets.map((t) => t.id))];
  if (wires.length < 2 || targets.some((t) => !same(targetPosition(c, t), point))) throw new Error("같은 교차점을 선택하세요.");
  const next = clone(c), junction = id();
  const nets = wires.map((key) => next.geometry.wires[key].net);
  for (const key of wires) {
    const w = next.geometry.wires[key];
    if (same(endpointPosition(next, w.from), point) || same(endpointPosition(next, w.to), point))
      throw new Error("교차점 접속은 선분 내부에서 사용하세요. 끝점은 배선으로 연결하세요.");
    splitWire(next, key, point, junction);
  }
  mergeNets(next, nets);
  assertCircuit(next);
  return next;
}

export function validateCircuit(c: Circuit): string[] {
  const errors: string[] = [], ids = new Set<string>(), owners = new Map<string, string>();
  for (const records of [c.components, c.pins, c.nets, c.junctions, c.geometry.wires])
    for (const [key, value] of Object.entries(records)) {
      if (value.id !== key || ids.has(key)) errors.push(`중복 또는 잘못된 ID: ${key}`);
      ids.add(key);
    }
  for (const comp of Object.values(c.components)) {
    const p = c.geometry.components[comp.id];
    if (!p || !Number.isFinite(p.position.x) || !Number.isFinite(p.position.y) || !Number.isFinite(p.rotation)) errors.push("부품 좌표 오류");
    if (new Set(comp.pins).size !== comp.pins.length || comp.pins.some((key) => c.pins[key]?.component !== comp.id)) errors.push("부품 핀 참조 오류");
  }
  for (const pin of Object.values(c.pins)) if (!c.components[pin.component]?.pins.includes(pin.id)) errors.push("핀 소유권 오류");
  for (const net of Object.values(c.nets)) {
    for (const [kind, list] of [["pin", net.pins], ["junction", net.junctions]] as const) {
      if (new Set(list).size !== list.length) errors.push("중복 연결망 구성원");
      for (const key of list) {
        const token = `${kind}:${key}`;
        if (owners.has(token) || (kind === "pin" ? !c.pins[key] : c.junctions[key]?.net !== net.id)) errors.push("연결망 소유권 오류");
        owners.set(token, net.id);
      }
    }
  }
  for (const j of Object.values(c.junctions)) if (!c.geometry.junctions[j.id] || owners.get(`junction:${j.id}`) !== j.net) errors.push("접속점 참조 오류");
  const adjacency = new Map<string, Set<string>>();
  for (const w of Object.values(c.geometry.wires)) {
    const a = `${w.from.type}:${w.from.id}`, b = `${w.to.type}:${w.to.id}`;
    if (!c.nets[w.net] || owners.get(a) !== w.net || owners.get(b) !== w.net) { errors.push("배선 연결망 참조 오류"); continue; }
    const endpointExists = (e: Endpoint) => e.type === "pin"
      ? !!c.geometry.components[c.pins[e.id]?.component]
      : !!c.geometry.junctions[e.id];
    if (!endpointExists(w.from) || !endpointExists(w.to)) { errors.push("끝점 좌표 참조 오류"); continue; }
    adjacency.set(a, new Set([...(adjacency.get(a) ?? []), b]));
    adjacency.set(b, new Set([...(adjacency.get(b) ?? []), a]));
    const pts = w.points;
    if (pts.length < 1 || pts.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y)) ||
      !same(pts[0], endpointPosition(c, w.from)) || !same(pts[pts.length - 1], endpointPosition(c, w.to)) ||
      pts.some((p, i) => i > 0 && (same(p, pts[i - 1]) || (p.x !== pts[i - 1].x && p.y !== pts[i - 1].y)))) errors.push("배선 경로 오류");
  }
  for (const net of Object.values(c.nets)) {
    const nodes = [...net.pins.map((p) => `pin:${p}`), ...net.junctions.map((j) => `junction:${j}`)];
    const seen = new Set<string>(), queue = nodes.slice(0, 1);
    while (queue.length) { const n = queue.pop()!; if (seen.has(n)) continue; seen.add(n); queue.push(...(adjacency.get(n) ?? [])); }
    if (nodes.some((n) => !seen.has(n))) errors.push("실제 배선과 연결망 불일치");
  }
  return errors;
}
export function assertCircuit(c: Circuit) {
  const errors = validateCircuit(c);
  if (errors.length) throw new Error(errors.join(" · "));
}
