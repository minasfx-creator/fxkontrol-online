/**
 * ─── RealFiringReadinessBadge ──────────────────────────────────────
 *
 * Compact pill displayed alongside GlobalEStopButton. Reflects whether
 * a real pyro FIRE would actually reach the wire right now:
 *
 *   READY   — workMode=real_operation + at least one wired transport alive
 *   ARMED   — same, with SafetyStateMachine in ARMED/FIRING
 *   SIM     — design/simulation OR no transport (falls back to buffer)
 *
 * Read-only. No side effects.
 */

import { useEffect, useState } from 'react';
import { useWorkMode } from '@/core/safety/workMode';
import { fieldBus, type FieldBusState } from '@/core/network/fieldBus';
import { safetyStateMachine } from '@/core/safety/SafetyStateMachine';

function useFieldBusSnapshot(): FieldBusState {
  const [s, setS] = useState<FieldBusState>(() => fieldBus.getState());
  useEffect(() => {
    const id = window.setInterval(() => setS(fieldBus.getState()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return s;
}

export default function RealFiringReadinessBadge() {
  const mode = useWorkMode();
  const bus = useFieldBusSnapshot();
  const [ssm, setSsm] = useState(() => safetyStateMachine.state);
  useEffect(() => {
    const unsub = safetyStateMachine.onTransition?.(() => setSsm(safetyStateMachine.state));
    const id = window.setInterval(() => setSsm(safetyStateMachine.state), 1000);
    return () => { try { unsub?.(); } catch { /* noop */ } window.clearInterval(id); };
  }, []);

  const aliveTransports = (Object.entries(bus.transports) as Array<[string, { alive: boolean }]>)
    .filter(([, v]) => v.alive)
    .map(([k]) => k);

  const real = mode === 'real_operation' && aliveTransports.length > 0;
  const armed = real && (ssm === 'ARMED' || ssm === 'FIRING');

  const label = armed ? 'ARMED' : real ? 'READY' : 'SIMULATION';
  const cls = armed
    ? 'bg-red-600/20 text-red-300 border-red-500/40'
    : real
      ? 'bg-emerald-600/20 text-emerald-300 border-emerald-500/40'
      : 'bg-cyan-600/15 text-cyan-300 border-cyan-500/30';

  const detail = real
    ? `transport=${bus.activeTransport} · ${aliveTransports.length} live`
    : mode === 'real_operation'
      ? 'no transport wired'
      : `mode=${mode}`;

  return (
    <div
      className={`pointer-events-none fixed top-2 right-[88px] z-[9998] flex items-center gap-2 rounded-md border px-2 py-1 text-[11px] font-mono backdrop-blur-sm ${cls}`}
      title={`Real-fire readiness · ${detail}`}
      data-testid="real-firing-readiness-badge"
    >
      <span className="font-semibold tracking-wider">{label}</span>
      <span className="opacity-70">{detail}</span>
    </div>
  );
}
