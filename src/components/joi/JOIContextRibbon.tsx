/**
 * JOIContextRibbon — Truth/context status bar for JOI panel
 * Shows source_of_truth, integration_mode, evidence_level, confidence, readiness
 */
import { useMemo } from 'react';
import { ShieldCheck, Database, Radio, Eye } from 'lucide-react';
import { joiContextBuilder } from '@/core/joi/JoiContextBuilder';
import type { JOIContextState, JOIConfidenceLevel } from '@/core/joi/joiTypes';
import type { IntegrationMode, EvidenceLevel } from '@/core/hardware/provenance';

const MODE_COLORS: Record<IntegrationMode, string> = {
  simulated: '210 90% 55%',
  replay: '38 90% 55%',
  live_read_only: '160 80% 45%',
  not_integrated: '0 70% 50%',
};

const MODE_LABELS: Record<IntegrationMode, string> = {
  simulated: 'SIMULATED',
  replay: 'REPLAY',
  live_read_only: 'LIVE READ-ONLY',
  not_integrated: 'NOT INTEGRATED',
};

const EVIDENCE_LABELS: Record<EvidenceLevel, string> = {
  ui_only: 'UI ONLY',
  adapter_only: 'ADAPTER',
  telemetry_verified: 'TELEMETRY',
  operator_confirmed: 'CONFIRMED',
};

const CONFIDENCE_COLORS: Record<JOIConfidenceLevel, string> = {
  low: '0 70% 50%',
  medium: '38 90% 55%',
  high: '160 80% 45%',
};

function deriveDominantMode(devices: { mode: string }[]): IntegrationMode {
  if (devices.length === 0) return 'not_integrated';
  const counts: Record<string, number> = {};
  devices.forEach(d => { counts[d.mode] = (counts[d.mode] || 0) + 1; });
  return (Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'simulated') as IntegrationMode;
}

function deriveEvidence(devices: { mode: string }[]): EvidenceLevel {
  if (devices.some(d => d.mode === 'live_read_only')) return 'telemetry_verified';
  if (devices.some(d => d.mode === 'replay')) return 'adapter_only';
  return 'ui_only';
}

function deriveConfidence(ctx: ReturnType<typeof joiContextBuilder.build>): JOIConfidenceLevel {
  if (ctx.hardware.simulatedCount === ctx.hardware.totalAdapters) return 'low';
  if (ctx.verification.failed > 0) return 'medium';
  return 'high';
}

export function JOIContextRibbon() {
  const state = useMemo<JOIContextState>(() => {
    const ctx = joiContextBuilder.build();
    const dominant = deriveDominantMode(ctx.hardware.devices);
    const evidence = deriveEvidence(ctx.hardware.devices);
    const confidence = deriveConfidence(ctx);
    return {
      mode: ctx.operational.currentMode,
      source_of_truth: ['ShowPlan', 'VerificationEngine', 'HardwareRegistry'],
      integration_mode: dominant,
      evidence_level: evidence,
      confidence,
      readiness_status: ctx.readiness.status,
      health_score: ctx.hardware.healthScore,
      simulated_count: ctx.hardware.simulatedCount,
      total_adapters: ctx.hardware.totalAdapters,
      blockers_count: ctx.verification.blockers.length,
    };
  }, []);

  const modeColor = MODE_COLORS[state.integration_mode];
  const confColor = CONFIDENCE_COLORS[state.confidence];
  const readyColor = state.readiness_status.includes('BLOCKED') ? '0 70% 50%'
    : state.readiness_status.includes('EXPORT') ? '160 80% 45%'
    : '38 90% 55%';

  return (
    <div
      className="flex items-center gap-1.5 px-2 py-1 overflow-x-auto shrink-0"
      style={{ borderBottom: '1px solid hsl(190 100% 50% / 0.06)', background: 'hsl(220 20% 4% / 0.5)' }}
    >
      {/* Integration Mode */}
      <span
        className="shrink-0 px-1.5 py-0.5 rounded text-[6px] font-mono tracking-widest uppercase font-bold"
        style={{ background: `hsl(${modeColor} / 0.12)`, color: `hsl(${modeColor})`, border: `1px solid hsl(${modeColor} / 0.25)` }}
      >
        {MODE_LABELS[state.integration_mode]}
      </span>

      {/* Evidence Level */}
      <span
        className="shrink-0 px-1.5 py-0.5 rounded text-[6px] font-mono tracking-wider uppercase"
        style={{ background: 'hsl(190 100% 50% / 0.06)', color: 'hsl(190 100% 60%)', border: '1px solid hsl(190 100% 50% / 0.12)' }}
      >
        <Database className="inline h-2 w-2 mr-0.5 -mt-px" />
        {EVIDENCE_LABELS[state.evidence_level]}
      </span>

      {/* Confidence */}
      <span
        className="shrink-0 px-1.5 py-0.5 rounded text-[6px] font-mono tracking-wider uppercase"
        style={{ background: `hsl(${confColor} / 0.1)`, color: `hsl(${confColor})`, border: `1px solid hsl(${confColor} / 0.2)` }}
      >
        <Eye className="inline h-2 w-2 mr-0.5 -mt-px" />
        {state.confidence.toUpperCase()}
      </span>

      {/* Readiness dot */}
      <span
        className="shrink-0 px-1.5 py-0.5 rounded text-[6px] font-mono tracking-wider uppercase"
        style={{ background: `hsl(${readyColor} / 0.1)`, color: `hsl(${readyColor})`, border: `1px solid hsl(${readyColor} / 0.2)` }}
      >
        <ShieldCheck className="inline h-2 w-2 mr-0.5 -mt-px" />
        {state.readiness_status.replace('READY_FOR_', '').replace(/_/g, ' ')}
      </span>

      {/* Simulated count */}
      {state.simulated_count > 0 && (
        <span className="shrink-0 text-[6px] font-mono tracking-wider" style={{ color: 'hsl(210 90% 55% / 0.6)' }}>
          <Radio className="inline h-2 w-2 mr-0.5 -mt-px" />
          {state.simulated_count}/{state.total_adapters} SIM
        </span>
      )}
    </div>
  );
}
