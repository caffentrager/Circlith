import type { Circuit, ConnectionTarget, Point } from "../model/circuit";
import { endpointPosition, pinPosition, snap } from "./geometry";
import { pointOnSegment, projectSegment, same } from "./path";

export type ConnectionHit = { target: ConnectionTarget; position: Point; distance: number };
export function connectionHits(c: Circuit, p: Point, zoom: number): ConnectionHit[] {
  const endpoints: ConnectionHit[] = [
    ...Object.keys(c.pins).map((id) => ({ target: { type: "pin", id } as ConnectionTarget, position: pinPosition(c, id) })),
    ...Object.entries(c.geometry.junctions).map(([id, position]) => ({ target: { type: "junction", id } as ConnectionTarget, position })),
  ].map((candidate) => ({ ...candidate, distance: Math.hypot(candidate.position.x - p.x, candidate.position.y - p.y) * zoom }))
    .filter((candidate) => candidate.distance <= 13);
  const nearest = (hits: ConnectionHit[]) => {
    hits.sort((a, b) => a.distance - b.distance || a.target.id.localeCompare(b.target.id));
    return hits.filter((hit) => hit.distance <= (hits[0]?.distance ?? 0) + .5);
  };
  if (endpoints.length) return nearest(endpoints);
  const wires: ConnectionHit[] = [];
  for (const w of Object.values(c.geometry.wires)) {
    let best: ConnectionHit | undefined;
    for (let i = 1; i < w.points.length; i++) {
      const a = w.points[i - 1], b = w.points[i];
      const projection = projectSegment(a, b, p);
      if (Math.hypot(projection.x - p.x, projection.y - p.y) * zoom > 12) continue;
      const gridPoint = projectSegment(a, b, snap(projection));
      const position = gridPoint;
      const distance = Math.hypot(projection.x - p.x, projection.y - p.y) * zoom;
      const endpoint = [w.from, w.to].find((e) => same(endpointPosition(c, e), position));
      const target: ConnectionTarget = endpoint ?? { type: "wire", id: w.id, position };
      if (!best || distance < best.distance) best = { target, position, distance };
    }
    if (best) wires.push(best);
  }
  // Magnetize nearby geometric crossings to their shared point, without joining nets.
  let crossing: {position:Point;distance:number;ids:Set<string>}|undefined;
  for(let i=0;i<wires.length;i++)for(let j=i+1;j<wires.length;j++){
    const x=wires[i].target,y=wires[j].target;if(x.type!=='wire'||y.type!=='wire')continue;
    const a=c.geometry.wires[x.id].points,b=c.geometry.wires[y.id].points;
    for(let m=1;m<a.length;m++)for(let n=1;n<b.length;n++){
      const ah=a[m-1].y===a[m].y,bh=b[n-1].y===b[n].y;if(ah===bh)continue;
      const position=ah?{x:b[n].x,y:a[m].y}:{x:a[m].x,y:b[n].y};
      const distance=Math.hypot(position.x-p.x,position.y-p.y)*zoom;
      if(distance>12||!pointOnSegment(a[m-1],a[m],position)||!pointOnSegment(b[n-1],b[n],position))continue;
      if(!crossing||distance<crossing.distance)crossing={position,distance,ids:new Set([x.id,y.id])};
      else if(same(crossing.position,position)){crossing.ids.add(x.id);crossing.ids.add(y.id);}
    }
  }
  if(crossing){const hit=crossing;return wires.filter(w=>hit.ids.has(w.target.id)).map(w=>({...w,target:{type:'wire',id:w.target.id,position:hit.position},position:hit.position,distance:hit.distance}));}
  // Shared endpoints reported by several fragments are one candidate.
  const unique = wires.filter((hit, i) => wires.findIndex((other) => other.target.type === hit.target.type && other.target.id === hit.target.id) === i);
  return nearest(unique);
}
