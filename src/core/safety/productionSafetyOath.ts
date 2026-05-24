/**
 * ─── Production Safety Oath ────────────────────────────────────────
 *
 * Hard interlock independent from the runtime safety-gate quarantine.
 *
 * Today the safety gate is in "Modo Testes" (see memory
 * "Safety Gate Quarentena"). All blocking layers are neutralised so
 * developers can iterate freely. The risk: if a production build
 * accidentally ships with the quarantine still active, the
 * `requestRealOperation()` path would happily flip workMode into
 * `real_operation` even though the lockouts are stubbed out.
 *
 * This module is the last line of defense:
 *
 *   • In `import.meta.env.MODE === 'production'`,
 *   • AND when the safety quarantine is detected as active,
 *   • requestRealOperation() MUST refuse before mutating workMode.
 *
 * The check is intentionally cheap, synchronous, and independent of
 * the rest of the safety stack so it cannot be silenced by the same
 * shims that disabled the gate.
 *
 * Pure module — no React, no singletons, no I/O.
 */

export type ProductionEnv = 'development' | 'production' | 'test' | string;

export interface ProductionOathInputs {
  /** import.meta.env.MODE — `production` triggers the hard gate. */
  envMode: ProductionEnv;
  /** True when the safety quarantine shims are active. */
  quarantineActive: boolean;
}

export type ProductionOathReason =
  | 'production-with-safety-quarantine-active';

export interface ProductionOathResult {
  ok: boolean;
  reason?: ProductionOathReason;
  envMode: ProductionEnv;
  quarantineActive: boolean;
}

/**
 * Returns `{ ok: true }` when it is acceptable to proceed with a
 * physical-hardware authorisation request. Returns a reason otherwise.
 *
 * Whitelist semantics: ANY non-production build is allowed; production
 * is allowed ONLY if the quarantine is OFF. We intentionally do NOT
 * check the inverse (dev with quarantine off) — that's a legitimate
 * production-rehearsal posture.
 */
export function evaluateProductionOath(
  inputs: ProductionOathInputs,
): ProductionOathResult {
  const isProd = inputs.envMode === 'production';
  if (isProd && inputs.quarantineActive) {
    return {
      ok: false,
      reason: 'production-with-safety-quarantine-active',
      envMode: inputs.envMode,
      quarantineActive: true,
    };
  }
  return {
    ok: true,
    envMode: inputs.envMode,
    quarantineActive: inputs.quarantineActive,
  };
}

/**
 * Default detector for the current runtime. Reads `import.meta.env.MODE`
 * and probes a process-wide flag that the quarantine README documents
 * as `globalThis.__FXK_SAFETY_QUARANTINE__ === true`. Any explicit `true`
 * triggers the oath; missing/false means the runtime considers the
 * gate restored.
 */
export function detectProductionOathInputs(): ProductionOathInputs {
  let envMode: ProductionEnv = 'development';
  try {
    const meta = (import.meta as unknown as { env?: { MODE?: string } }).env;
    if (meta && typeof meta.MODE === 'string') envMode = meta.MODE;
  } catch {
    /* SSR / test runner without import.meta — default development */
  }
  const flag = (globalThis as { __FXK_SAFETY_QUARANTINE__?: boolean })
    .__FXK_SAFETY_QUARANTINE__;
  return { envMode, quarantineActive: flag === true };
}

export function explainProductionOath(reason: ProductionOathReason): string {
  switch (reason) {
    case 'production-with-safety-quarantine-active':
      return (
        'Build de produção detectado com a quarentena de segurança ainda ativa. ' +
        'requestRealOperation() recusou a transição para evitar comandos físicos ' +
        'sem os intertravamentos canônicos. Restaurar via src/_quarantine/safety/.'
      );
  }
}
