/**
 * ─── Adapter Tick Gate ─────────────────────────────────────────────
 * Defesa em profundidade contra geração sintética de telemetria.
 *
 * Política:
 *   1. Se o flag global `dev_hardware_simulator` está OFF (default), NUNCA
 *      agendamos ou executamos um tick que possa chamar Math.random().
 *   2. Se o flag está ON, ainda exigimos que o adapter esteja efetivamente
 *      `connected` (real handshake) — não basta o operador ter "ligado" o
 *      objeto. Adapters começam disconnected.
 *
 * Uso:
 *   - `shouldAdapterTick(adapter)` antes de agendar `setInterval`/`tick`.
 *   - `shouldRunSyntheticBranch(adapter)` dentro do próprio `pollTelemetry`
 *     como defesa final caso alguém adicione um caminho novo.
 *
 * Ambos retornam `false` por padrão em produção honest-hardware.
 */

import { isHardwareSimulatorEnabled } from '@/lib/featureFlags';

interface TickableAdapter {
  getConnectionState?: () => 'connected' | 'disconnected' | 'connecting' | 'error' | string;
}

/** Returns true only if it's safe to schedule a polling timer for this adapter. */
export function shouldAdapterTick(adapter?: TickableAdapter | null): boolean {
  if (!isHardwareSimulatorEnabled()) return false;
  if (!adapter) return false;
  try {
    return adapter.getConnectionState?.() === 'connected';
  } catch {
    return false;
  }
}

/**
 * Returns true only when the synthetic / Math.random branch inside a
 * `pollTelemetry` body is allowed to execute. Identical semantics to
 * `shouldAdapterTick` — kept as a separate name so call-sites read clearly.
 */
export function shouldRunSyntheticBranch(adapter?: TickableAdapter | null): boolean {
  return shouldAdapterTick(adapter);
}
