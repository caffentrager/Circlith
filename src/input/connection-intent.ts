import type { Circuit, Point } from '../model/circuit';
import { connectionHits } from '../geometry/connection-hit';

export type ConnectionIntent = {
  selecting: boolean;
  surface: 'body' | 'pin' | 'other';
};

// Body selection wins over expanded capture only while idle in SELECT.
// Keep geometric capture unchanged for direct pins, WIRE, and finishing a draft.
export function resolveConnectionHits(c: Circuit, p: Point, zoom: number, intent: ConnectionIntent) {
  if (intent.selecting && intent.surface === 'body') return [];
  return connectionHits(c, p, zoom);
}
