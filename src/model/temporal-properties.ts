import type { Component } from './circuit';

export const clockProperties = (part: Component) => part.clock ?? { period: 10, duty: 50, initial: '0' as const };
export const dffProperties = (part: Component) => part.dff ?? { edge: 'rising' as const, initial: 'X' as const };

export function temporalPropertyError(part: Component): string | undefined {
  if (part.clock !== undefined && (!part.clock || typeof part.clock !== 'object') ||
      part.dff !== undefined && (!part.dff || typeof part.dff !== 'object')) return '시간 속성 형식이 손상되었습니다.';
  if (part.clock !== undefined && part.kind !== 'Clock' || part.dff !== undefined && part.kind !== 'DFF') return '종류에 맞지 않는 시간 속성입니다.';
  if (part.kind === 'Clock') {
    const p = clockProperties(part);
    if (!p || !Number.isInteger(p.period) || p.period < 2 || p.period > 1_000_000 ||
      !Number.isInteger(p.duty) || p.duty < 1 || p.duty > 99 || !['0', '1'].includes(p.initial))
      return 'Clock 주기는 2~1000000 µs 정수, 듀티는 1~99% 정수, 초기값은 0/1이어야 합니다.';
  }
  if (part.kind === 'DFF') {
    const p = dffProperties(part);
    if (!p || !['rising', 'falling'].includes(p.edge) || !['0', '1', 'X'].includes(p.initial))
      return 'DFF 엣지는 상승/하강, 초기 Q는 0/1/X여야 합니다.';
  }
}
