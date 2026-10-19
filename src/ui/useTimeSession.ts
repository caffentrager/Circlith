import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import type { Circuit } from '../model/circuit';
import type { LogicValue } from '../simulation/logic';
import { TimeSession, type TimeStep } from '../simulation/time-session';

export function useTimeSession(circuit: Circuit, inputs: Readonly<Record<string, LogicValue>>, enabled: boolean,
  restoreInputs?: (inputs: Record<string, LogicValue>) => void) {
  // Inputs are synchronized separately: changing an input must not reset time.
  const session = useMemo(() => enabled ? new TimeSession(circuit, inputs) : null, [circuit, enabled]);
  const [owner, setOwner] = useState<TimeSession | null>(null);
  const [rate, setRate] = useState(2);
  const [, update] = useState(0);
  const refresh = () => update(n => n + 1);
  const running = session !== null && owner === session;
  useLayoutEffect(() => {
    if (!session) return;
    session.setInputs(inputs);
    if (session.error && JSON.stringify(inputs) !== JSON.stringify(session.inputValues)) restoreInputs?.({ ...session.inputValues });
    refresh();
  }, [session, inputs, restoreInputs]);
  useEffect(() => { setOwner(active => active === session ? active : null); }, [session]);
  useEffect(() => {
    if (!running || !session) return;
    const stopWhenHidden = () => { if (document.hidden) setOwner(null); };
    document.addEventListener('visibilitychange', stopWhenHidden);
    const timer = window.setInterval(() => {
      if (document.hidden || !session.step()) setOwner(null);
      refresh();
    }, 1000 / rate);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', stopWhenHidden); };
  }, [session, running, rate]);
  return {
    session, running, rate, setRate, refresh,
    start: () => { if (session?.hasEvents) setOwner(session); },
    pause: () => setOwner(null),
    reset: () => { setOwner(null); session?.reset(); refresh(); },
    step: (mode: TimeStep, clock?: string) => { if (!running) { session?.step(mode, clock); refresh(); } },
  };
}
export type TimeController = ReturnType<typeof useTimeSession>;
