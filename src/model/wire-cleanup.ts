import { clone, type Circuit } from "./circuit";
import { assertCircuit } from "./connections";
import { simplifyPath } from "../geometry/path";
import { collidingSegments } from "../geometry/routing";

export type WireCleanupPlan = { remove: string[]; keep: string[] };

// Parallel edges with identical endpoint IDs are redundant without changing any node.
// A real branch splits an edge, so a detour with a branch cannot enter the same group.
export function planWireCleanup(c: Circuit, selection: string[]): WireCleanupPlan {
  const nets = new Set(selection.flatMap((key) => c.geometry.wires[key] ? [c.geometry.wires[key].net] : []));
  const groups = new Map<string, Circuit["geometry"]["wires"][string][]>();
  for (const w of Object.values(c.geometry.wires)) {
    if (!nets.has(w.net)) continue;
    const endpoints = [w.from, w.to].map((e) => `${e.type}:${e.id}`).sort();
    if (endpoints[0] === endpoints[1]) continue;
    const key = JSON.stringify([w.net, endpoints]);
    const group = groups.get(key) ?? [];
    group.push(w);
    groups.set(key, group);
  }
  const plan: WireCleanupPlan = { remove: [], keep: [] };
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const ranked = group.map((w) => ({ id: w.id, overlap: collidingSegments(c, w.points).length ? 1 : 0,
      length: w.points.slice(1).reduce((sum, p, i) => sum + Math.abs(p.x - w.points[i].x) + Math.abs(p.y - w.points[i].y), 0),
      bends: Math.max(0, simplifyPath(w.points).length - 2) }));
    // Stable sorting preserves the original edge when equally good routes coincide.
    ranked.sort((a, b) => a.overlap - b.overlap || a.length - b.length || a.bends - b.bends);
    plan.keep.push(ranked[0].id); plan.remove.push(...ranked.slice(1).map((w) => w.id));
  }
  return plan;
}

export function applyWireCleanup(c: Circuit, plan: WireCleanupPlan): Circuit {
  assertCircuit(c);
  const valid = planWireCleanup(c, plan.keep);
  if (!plan.remove.length || new Set(plan.remove).size !== plan.remove.length ||
    plan.remove.some((key) => !valid.remove.includes(key)))
    throw new Error("중복 경로 정리 대상이 변경되었습니다. 다시 미리보기하세요.");
  const next = clone(c);
  for (const key of plan.remove) delete next.geometry.wires[key];
  assertCircuit(next);
  return next;
}
