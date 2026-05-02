/**
 * inspect_hardware — Sprint 1 (Phase 0) deliverable from JOI orçamento 02/05/2026.
 *
 * Pure read of the unifiedHardwareRegistry + adapterTriage + ReadinessEvaluator
 * + VerificationEngine. Produces a deterministic technical report (object +
 * markdown) that can be downloaded from /dev/readiness-audit and pasted into
 * the engineering channel during the sprint.
 *
 * Honesty rules:
 *   - Zero Math.random / synthetic data.
 *   - Zero CommandBus / FieldBus / SafetyStateMachine touch.
 *   - Adapters in `not_integrated` are NOT counted as errors — they are
 *     classified by their triage entry (NOT_INTEGRATED_EXPECTED vs
 *     AWAITING_HANDSHAKE vs ADAPTER_ISSUE).
 *
 * Pure-on-data: pass the registry as argument so it stays unit-testable.
 */

import type { unifiedHardwareRegistry } from './UnifiedHardwareRegistry';
import {
  ADAPTER_TRIAGE,
  getTriageEntry,
  pendingRequiredAdapters,
  type AdapterTriageEntry,
  type TriageClass,
} from './adapterTriage';
import { readinessEvaluator } from './ReadinessEvaluator';
import { verificationEngine } from '@/core/verification/VerificationEngine';

export interface InspectHardwareAdapterRow {
  id: string;
  label: string;
  type: string;
  online: boolean;
  connection: string;
  integration_mode: string;
  evidence_level: string;
  transport: string;
  last_seen_at: number;
  warnings: string[];
  errors: string[];
  triage: TriageClass | 'UNKNOWN';
  required_for_sync: boolean;
  next_action_label: string;
}

export interface InspectHardwareReport {
  capturedAt: string;
  health: { online: number; total: number; warnings: number; errors: number; score: number };
  readiness: { status: string; mode: string; allowed: string[] };
  verification: { level: string; errors: number; warnings: number; passed: number };
  triageCounts: Record<TriageClass, number>;
  pending: AdapterTriageEntry[];
  adapters: InspectHardwareAdapterRow[];
  /** Phase 0 hardware-pairing exit criterion. */
  phase0HardwareReady: boolean;
}

export function inspectHardware(
  registry: typeof unifiedHardwareRegistry,
): InspectHardwareReport {
  const adapters = registry.getAllAdapters();
  const triageCounts: Record<TriageClass, number> = {
    NOT_INTEGRATED_EXPECTED: 0,
    AWAITING_HANDSHAKE: 0,
    ADAPTER_ISSUE: 0,
  };

  const rows: InspectHardwareAdapterRow[] = adapters.map((a) => {
    const prov = a.getProvenance();
    const snap = a.getSnapshot();
    const tri = getTriageEntry(a.deviceId);
    const klass: TriageClass | 'UNKNOWN' = tri?.class ?? 'UNKNOWN';
    if (tri) triageCounts[tri.class]++;
    return {
      id: a.deviceId,
      label: a.label,
      type: a.deviceType,
      online: snap.online,
      connection: a.getConnectionState(),
      integration_mode: prov.integration_mode,
      evidence_level: prov.evidence_level,
      transport: prov.transport_type,
      last_seen_at: prov.last_seen_at,
      warnings: snap.warnings,
      errors: snap.errors,
      triage: klass,
      required_for_sync: tri?.requiredForSync ?? false,
      next_action_label: tri?.nextAction.label ?? 'Sem triagem registrada',
    };
  });

  const pending = pendingRequiredAdapters(registry);
  const verif = verificationEngine.run();
  const verifIssues = verif.issues ?? [];
  const verifErrors = verifIssues.filter((i) => i.severity === 'error').length;
  const verifWarnings = verifIssues.filter((i) => i.severity === 'warning').length;
  const verifPassed = verifIssues.filter((i) => i.passed).length;
  const readiness = readinessEvaluator.evaluate();
  const health = registry.getSystemHealth();

  return {
    capturedAt: new Date().toISOString(),
    health,
    readiness: {
      status: readiness.status,
      mode: readiness.mode,
      allowed: [...readiness.allowed_operations],
    },
    verification: {
      level: verif.level,
      errors: verifErrors,
      warnings: verifWarnings,
      passed: verifPassed,
    },
    triageCounts,
    pending,
    adapters: rows,
    phase0HardwareReady: pending.length === 0,
  };
}

/** Render the report as a deterministic Markdown document. */
export function inspectHardwareToMarkdown(r: InspectHardwareReport): string {
  const L: string[] = [];
  L.push(`# FX KONTROL · Hardware Inspection Report`);
  L.push(``);
  L.push(`Captured: \`${r.capturedAt}\``);
  L.push(``);
  L.push(`## Summary`);
  L.push(`- Readiness: **${r.readiness.status}** (mode: ${r.readiness.mode})`);
  L.push(`- Verification: **${r.verification.level}** · ${r.verification.errors} errors · ${r.verification.warnings} warnings · ${r.verification.passed} passed`);
  L.push(`- Health score: **${r.health.score}** · online ${r.health.online}/${r.health.total} · errors ${r.health.errors} · warnings ${r.health.warnings}`);
  L.push(`- Phase 0 hardware ready: **${r.phase0HardwareReady ? 'YES' : 'NO'}** (pending required: ${r.pending.length})`);
  L.push(``);
  L.push(`## Triage breakdown (${ADAPTER_TRIAGE.length} adapters classified)`);
  L.push(`- NOT_INTEGRATED_EXPECTED: ${r.triageCounts.NOT_INTEGRATED_EXPECTED}`);
  L.push(`- AWAITING_HANDSHAKE: ${r.triageCounts.AWAITING_HANDSHAKE}`);
  L.push(`- ADAPTER_ISSUE: ${r.triageCounts.ADAPTER_ISSUE}`);
  L.push(``);
  if (r.pending.length > 0) {
    L.push(`## Pending required adapters (block exit from SIMULATION)`);
    for (const p of r.pending) {
      const action =
        p.nextAction.kind === 'route'
          ? `route → \`${p.nextAction.path}\` (${p.nextAction.label})`
          : p.nextAction.kind === 'doc'
            ? `doc → \`${p.nextAction.path}\``
            : p.nextAction.label;
      L.push(`- **${p.id}** [${p.class}] · ${p.rationale}`);
      L.push(`  - next: ${action}`);
    }
    L.push(``);
  }
  L.push(`## Adapters (${r.adapters.length})`);
  L.push(``);
  L.push(`| ID | Online | Connection | Integration | Transport | Triage | Required | Next |`);
  L.push(`|---|---|---|---|---|---|---|---|`);
  for (const a of r.adapters) {
    L.push(
      `| \`${a.id}\` | ${a.online ? 'yes' : 'no'} | ${a.connection} | ${a.integration_mode} | ${a.transport} | ${a.triage} | ${a.required_for_sync ? 'yes' : 'no'} | ${a.next_action_label} |`,
    );
  }
  const withWarn = r.adapters.filter((a) => a.warnings.length || a.errors.length);
  if (withWarn.length > 0) {
    L.push(``);
    L.push(`## Adapter diagnostics`);
    for (const a of withWarn) {
      L.push(`### \`${a.id}\``);
      for (const w of a.warnings) L.push(`- ⚠ ${w}`);
      for (const e of a.errors) L.push(`- ✖ ${e}`);
    }
  }
  L.push(``);
  L.push(`---`);
  L.push(`Generated by FX KONTROL inspect_hardware (Sprint 1, Phase 0). Pure read · zero CommandBus/FieldBus.`);
  return L.join('\n');
}
