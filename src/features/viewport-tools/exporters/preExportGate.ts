/**
 * Pre-Export Validator Gate
 * ────────────────────────────────────────────────────────────
 * Single funnel that every viewport-tools exporter MUST pass through.
 *
 * Rules:
 *  - Runs all advanced validators (PYRO base + FireOne + Showven + DRONES).
 *  - `error` issues BLOCK export (returns ok=false with details).
 *  - `warn` and `info` are returned but do not block.
 *  - In design / simulation WorkMode the gate still runs but only reports;
 *    UI decides whether to honor block flags.
 *
 * No dependency on SafetyStateMachine — exporters are file generation, not
 * physical actuation. SafetyStateMachine remains the only authority for
 * ARM/FIRE/E-STOP per the canonical command path.
 */

import { useProjectStore } from '@/store/useProjectStore';
import type { ValidationContext, ValidationIssue } from '@/features/viewport-tools/types';
import { pyroValidators } from '@/features/viewport-tools/validators/pyro.validator';
import { fireoneValidators } from '@/features/viewport-tools/validators/fireone.validator';
import { showvenValidators } from '@/features/viewport-tools/validators/showven.validator';
import { dronesValidators } from '@/features/viewport-tools/validators/drones.validator';

export interface ExportGateReport {
  ok: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  infos: ValidationIssue[];
  totals: { error: number; warn: number; info: number };
}

export function runPreExportGate(): ExportGateReport {
  const positions = useProjectStore.getState().positions;
  const allIds = positions.map((p) => p.id);

  const ctxFor = (segment: ValidationContext['segment']): ValidationContext => ({
    segment,
    selectionIds: allIds,
    positions,
  });

  const issues: ValidationIssue[] = [
    ...pyroValidators.flatMap((v) => v(ctxFor('PYRO'))),
    ...fireoneValidators.flatMap((v) => v(ctxFor('PYRO'))),
    ...showvenValidators.flatMap((v) => v(ctxFor('PYRO'))),
    ...showvenValidators.flatMap((v) => v(ctxFor('SFX'))),
    ...dronesValidators.flatMap((v) => v(ctxFor('DRONES'))),
  ];

  const errors = issues.filter((i) => i.severity === 'error');
  const warnings = issues.filter((i) => i.severity === 'warn');
  const infos = issues.filter((i) => i.severity === 'info');

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    infos,
    totals: { error: errors.length, warn: warnings.length, info: infos.length },
  };
}
