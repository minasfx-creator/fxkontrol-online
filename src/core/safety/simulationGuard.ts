/**
 * ─── Simulation Guard ──────────────────────────────────────────────
 * Defesa em profundidade: garante que NENHUM bloqueio (lockout,
 * interlock, modeGuard, uiLocks, export gate, badges "BLOCKED") seja
 * aplicado quando o app está em `design` ou `simulation`.
 *
 * Regra única e canônica:
 *   • workMode != real_operation  →  isSimulating() === true
 *   • Qualquer chamada de bloqueio DEVE consultar isSimulating() antes
 *     de rejeitar. Em simulação retornamos `{ blocked: false }` com
 *     reason `'sim-bypass'` e a ação prossegue.
 *
 * Em `real_operation` este guard é transparente — não interfere nos
 * intertravamentos físicos (SafetyStateMachine, aiGuardrail, etc.).
 */

import { workMode } from './workMode';

/** True quando estamos em design ou simulation (i.e. nada físico). */
export function isSimulating(): boolean {
  return !workMode.isRealOperation();
}

/**
 * Helper para gates que retornam `{ allowed, reason }`.
 * Em simulação força `allowed = true` e marca como `sim-bypass`.
 */
export function withSimBypass<T extends { allowed: boolean; reason?: string }>(
  fn: () => T,
  layerLabel: string,
): T {
  if (isSimulating()) {
    return {
      allowed: true,
      reason: `${layerLabel} bypassed (workMode=${workMode.get()})`,
    } as T;
  }
  return fn();
}

/**
 * Para call-sites que só querem um booleano "este layer pode bloquear?".
 * Em simulação SEMPRE retorna false.
 */
export function shouldEnforce(realCheck: () => boolean): boolean {
  if (isSimulating()) return false;
  return realCheck();
}
