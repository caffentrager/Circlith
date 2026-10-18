import { describe, it } from 'vitest';
import { compileCircuit, simulate } from '../src/simulation/simulator';
import { validateCircuit } from '../src/model/connections';
import { builder, record, renameIds, V } from './helpers';

describe('reserved JS object property names used as IDs (external fixture only)', () => {
  it('records the behaviour for net / pin / component ids named like Object.prototype members', () => {
    const rows: Record<string, unknown> = {};
    for (const name of ['constructor', 'toString', 'hasOwnProperty', '__proto__', 'valueOf']) for (const kind of ['net', 'pin', 'component'] as const) {
      const b = builder(), A = b.add('Input'), N = b.add('NOT'), O = b.add('Output'); b.wire(A, N); b.wire(N, O);
      const target = kind === 'net' ? Object.keys(b.c.nets)[0] : kind === 'pin' ? b.c.components[N].pins[0] : N;
      const c = renameIds(b.c, { [target]: name });
      let verdict = '';
      try {
        const errors = validateCircuit(c);
        const results = V.map(v => { const r = simulate(compileCircuit(c), { [A]: v }); return r.outputs[O]; });
        const expected = V.map(v => (v === '0' ? '1' : v === '1' ? '0' : 'X'));
        verdict = errors.length ? `validator: ${errors[0]}` : JSON.stringify(results) === JSON.stringify(expected) ? 'correct' : `WRONG ${JSON.stringify(results)}`;
      } catch (e) { verdict = 'THROWS ' + (e as Error).message; }
      rows[`${kind}=${name}`] = verdict;
    }
    record('probe-proto-ids', rows);
  });
});
