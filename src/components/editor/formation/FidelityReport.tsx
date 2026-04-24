/**
 * FidelityReport — Visual diagnostic of a model→formation extraction.
 *
 * Shows the four core fidelity signals so the operator can understand why
 * a given mesh produced a given formation:
 *   • Candidate count  — raw mesh candidates fed to the sampler
 *   • Point count      — drones actually placed by Poisson sampling
 *   • Coverage         — how well the points fill the model's footprint (0–1)
 *   • Distribution     — uniformity of point spacing (0–1, higher is better)
 *
 * Pure presentational. Accepts either a normalized FidelityData object
 * (preferred) or the legacy ModelParseResult.quality shape via a helper.
 */
import { Activity, Target, Layers, Gauge, Lightbulb } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Threshold configuration for color-coding fidelity metrics.
 * Values are in 0..1 range. A metric ≥ `ok` is green, ≥ `warn` is yellow,
 * below `warn` is red. Defaults follow the 0.7 / 0.4 convention.
 */
export interface FidelityThresholds {
  coverage: { ok: number; warn: number };
  distribution: { ok: number; warn: number };
  /** Candidates per placed drone — ratio. Default ok=4, warn=1. */
  candidateRatio: { ok: number; warn: number };
}

export const DEFAULT_FIDELITY_THRESHOLDS: FidelityThresholds = {
  coverage: { ok: 0.7, warn: 0.4 },
  distribution: { ok: 0.7, warn: 0.4 },
  candidateRatio: { ok: 4, warn: 1 },
};

export interface FidelityRecommendation {
  /** Which knob the operator should tweak. */
  setting:
    | 'minDistance'
    | 'droneCount'
    | 'maxCandidates'
    | 'hollow'
    | 'scale';
  /** Human-readable advice (one line). */
  message: string;
  severity: 'warn' | 'critical';
}

export interface FidelityData {
  /** Number of candidate points generated from the raw mesh (pre-Poisson). */
  candidateCount: number;
  /** Number of drone points actually selected for the formation. */
  pointCount: number;
  /** Coverage of the model footprint by the sampled points, 0..1. */
  coverage: number;
  /** Spatial distribution / uniformity score, 0..1 (higher = more uniform). */
  distribution: number;
  /** Optional overall score, 0..100. Computed from coverage + distribution if absent. */
  score?: number;
  /** Optional bounding-box hint (meters) for context. */
  boundingBox?: { width: number; height: number; depth: number };
  /** Optional source label, e.g. "GLB · BMW.glb". */
  sourceLabel?: string;
}

interface Props {
  data: FidelityData;
  className?: string;
  compact?: boolean;
  /** Override the default color-coding thresholds. */
  thresholds?: Partial<FidelityThresholds>;
  /** Hide the auto-generated recommendations panel. */
  hideRecommendations?: boolean;
}

const fmtPct = (v: number) => `${Math.round(clamp01(v) * 100)}%`;
const fmtInt = (v: number) => v.toLocaleString();
const clamp01 = (v: number) => (Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0);

function statusFor(value01: number, t: { ok: number; warn: number }): 'ok' | 'warn' | 'critical' {
  const v = clamp01(value01);
  if (v >= t.ok) return 'ok';
  if (v >= t.warn) return 'warn';
  return 'critical';
}

function statusForRatio(ratio: number, t: { ok: number; warn: number }): 'ok' | 'warn' | 'critical' {
  if (ratio >= t.ok) return 'ok';
  if (ratio >= t.warn) return 'warn';
  return 'critical';
}

function statusColors(status: 'ok' | 'warn' | 'critical') {
  switch (status) {
    case 'ok':       return { text: 'text-green-400',  bar: 'bg-green-500/70',  bg: 'bg-green-500/5  border-green-500/20' };
    case 'warn':     return { text: 'text-yellow-400', bar: 'bg-yellow-500/70', bg: 'bg-yellow-500/5 border-yellow-500/20' };
    case 'critical': return { text: 'text-red-400',    bar: 'bg-red-500/70',    bg: 'bg-red-500/5    border-red-500/20' };
  }
}

/**
 * Inspect the metrics and return ordered, actionable recommendations.
 * Pure function — exported for tests / external panels.
 */
export function recommendFidelityFixes(
  data: FidelityData,
  thresholds: FidelityThresholds = DEFAULT_FIDELITY_THRESHOLDS,
): FidelityRecommendation[] {
  const recs: FidelityRecommendation[] = [];
  const cov = clamp01(data.coverage);
  const dist = clamp01(data.distribution);
  const ratio = data.pointCount > 0 ? data.candidateCount / data.pointCount : 0;

  if (cov < thresholds.coverage.warn) {
    recs.push({
      setting: 'minDistance',
      severity: 'critical',
      message: 'Coverage too low — reduce minDistance so points spread across the model.',
    });
    recs.push({
      setting: 'droneCount',
      severity: 'warn',
      message: 'Increase drone count to fill the model footprint.',
    });
  } else if (cov < thresholds.coverage.ok) {
    recs.push({
      setting: 'minDistance',
      severity: 'warn',
      message: 'Coverage is borderline — try a slightly smaller minDistance.',
    });
  }

  if (dist < thresholds.distribution.warn) {
    recs.push({
      setting: 'maxCandidates',
      severity: 'critical',
      message: 'Distribution is uneven — raise maxCandidates to give Poisson more samples.',
    });
    recs.push({
      setting: 'hollow',
      severity: 'warn',
      message: 'Enable surface (hollow) sampling for area-weighted uniformity.',
    });
  } else if (dist < thresholds.distribution.ok) {
    recs.push({
      setting: 'maxCandidates',
      severity: 'warn',
      message: 'Distribution is borderline — bump maxCandidates by ~50%.',
    });
  }

  if (data.pointCount > 0 && ratio < thresholds.candidateRatio.warn) {
    recs.push({
      setting: 'maxCandidates',
      severity: 'critical',
      message: 'Too few candidates per drone — raise maxCandidates substantially.',
    });
  } else if (ratio > 0 && ratio < thresholds.candidateRatio.ok) {
    recs.push({
      setting: 'maxCandidates',
      severity: 'warn',
      message: 'Candidate pool is thin — consider raising maxCandidates for cleaner spacing.',
    });
  }

  if (data.boundingBox) {
    const { width, height, depth } = data.boundingBox;
    const maxDim = Math.max(width, height, depth);
    if (maxDim > 0 && maxDim < 5) {
      recs.push({
        setting: 'scale',
        severity: 'warn',
        message: 'Model is very small — increase scale so minDistance is meaningful.',
      });
    }
  }

  // De-duplicate by setting, keeping the most severe.
  const seen = new Map<string, FidelityRecommendation>();
  for (const r of recs) {
    const prev = seen.get(r.setting);
    if (!prev || (prev.severity === 'warn' && r.severity === 'critical')) {
      seen.set(r.setting, r);
    }
  }
  return Array.from(seen.values());
}

export default function FidelityReport({
  data,
  className,
  compact = false,
  thresholds: thresholdsOverride,
  hideRecommendations = false,
}: Props) {
  const thresholds: FidelityThresholds = {
    coverage: { ...DEFAULT_FIDELITY_THRESHOLDS.coverage, ...(thresholdsOverride?.coverage ?? {}) },
    distribution: { ...DEFAULT_FIDELITY_THRESHOLDS.distribution, ...(thresholdsOverride?.distribution ?? {}) },
    candidateRatio: { ...DEFAULT_FIDELITY_THRESHOLDS.candidateRatio, ...(thresholdsOverride?.candidateRatio ?? {}) },
  };

  const score = typeof data.score === 'number'
    ? Math.max(0, Math.min(100, Math.round(data.score)))
    : Math.round((clamp01(data.coverage) * 0.5 + clamp01(data.distribution) * 0.5) * 100);

  const sStatus = score >= thresholds.coverage.ok * 100 ? 'ok'
                : score >= thresholds.coverage.warn * 100 ? 'warn' : 'critical';
  const sColor = statusColors(sStatus);

  const candidateRatio = data.pointCount > 0 ? data.candidateCount / data.pointCount : 0;

  const rows: Array<{
    icon: React.ElementType;
    label: string;
    value: string;
    bar01?: number;
    status: 'ok' | 'warn' | 'critical';
    hint?: string;
  }> = [
    {
      icon: Layers,
      label: 'Candidates',
      value: fmtInt(data.candidateCount),
      status: statusForRatio(candidateRatio, thresholds.candidateRatio),
      hint: `Raw mesh samples fed to the Poisson selector (${candidateRatio.toFixed(1)}× drones)`,
    },
    {
      icon: Target,
      label: 'Drones placed',
      value: fmtInt(data.pointCount),
      status: data.pointCount > 0 ? 'ok' : 'critical',
      hint: 'Final formation point count',
    },
    {
      icon: Gauge,
      label: 'Coverage',
      value: fmtPct(data.coverage),
      bar01: clamp01(data.coverage),
      status: statusFor(data.coverage, thresholds.coverage),
      hint: 'How well the points fill the model footprint',
    },
    {
      icon: Activity,
      label: 'Distribution',
      value: fmtPct(data.distribution),
      bar01: clamp01(data.distribution),
      status: statusFor(data.distribution, thresholds.distribution),
      hint: 'Spatial uniformity of nearest-neighbor spacing',
    },
  ];

  const recommendations = hideRecommendations ? [] : recommendFidelityFixes(data, thresholds);


  return (
    <div
      className={cn(
        'rounded-md border border-border/50 bg-surface-2/60 p-2 space-y-1.5 font-mono-code',
        className,
      )}
    >
      {/* Header: source + score */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-col min-w-0">
          <span className="text-[8px] font-bold uppercase tracking-wider text-muted-foreground">
            Fidelity Report
          </span>
          {data.sourceLabel && (
            <span className="text-[9px] text-foreground/80 truncate" title={data.sourceLabel}>
              {data.sourceLabel}
            </span>
          )}
        </div>
        <div
          className={cn(
            'rounded-sm border px-2 py-0.5 text-center',
            sColor.bg,
          )}
          title="Overall extraction score (0–100)"
        >
          <div className={cn('text-[12px] font-bold leading-none', sColor.text)}>{score}</div>
          <div className="text-[7px] uppercase tracking-wider text-muted-foreground mt-0.5">Score</div>
        </div>
      </div>

      {/* Rows */}
      <div className={cn('grid gap-1', compact ? 'grid-cols-2' : 'grid-cols-1')}>
        {rows.map((r) => {
          const c = statusColors(r.status);
          const Icon = r.icon;
          return (
            <div
              key={r.label}
              className="flex items-center gap-1.5 px-1.5 py-1 rounded-sm bg-surface-1/60"
              title={r.hint}
            >
              <Icon className={cn('h-3 w-3 shrink-0', c.text)} />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[9px] text-muted-foreground truncate">{r.label}</span>
                  <span className={cn('text-[10px] font-semibold', c.text)}>{r.value}</span>
                </div>
                {typeof r.bar01 === 'number' && (
                  <div className="mt-0.5 h-1 rounded-sm bg-surface-3/60 overflow-hidden">
                    <div
                      className={cn('h-full transition-all', c.bar)}
                      style={{ width: `${Math.round(r.bar01 * 100)}%` }}
                    />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer: bbox */}
      {data.boundingBox && (
        <div className="flex justify-between text-[8px] text-muted-foreground pt-0.5 border-t border-border/40">
          <span>Bounding box</span>
          <span className="text-foreground/80">
            {data.boundingBox.width}×{data.boundingBox.height}×{data.boundingBox.depth} m
          </span>
        </div>
      )}
    </div>
  );
}

/* ── Adapters ──────────────────────────────────────────────────── */

/**
 * Build FidelityData from the legacy `ModelParseResult` shape produced by
 * `parseModelToFormation` (src/lib/modelToFormation.ts). Distribution is
 * derived from the coefficient of variation of nearest-neighbor spacing.
 */
export function fidelityFromModelParse(input: {
  points: { x: number; z: number }[];
  originalVertexCount: number;
  modelName: string;
  format: string;
  quality: { avgSpacing: number; spacingUniformity: number; coverage: number; score: number };
  boundingBox: { width: number; height: number; depth: number };
}): FidelityData {
  const cv = input.quality.avgSpacing > 0
    ? input.quality.spacingUniformity / input.quality.avgSpacing
    : 1;
  const distribution = clamp01(1 - cv);
  return {
    candidateCount: input.originalVertexCount,
    pointCount: input.points.length,
    coverage: clamp01(input.quality.coverage),
    distribution,
    score: input.quality.score,
    boundingBox: input.boundingBox,
    sourceLabel: `${input.format} · ${input.modelName}`,
  };
}

/**
 * Build FidelityData from the Nível 3 `ModelExtractionReport` shape
 * (src/modules/swarmgpt/advanced/model3d/types.ts). Coverage and
 * distribution come straight from `scoreFormationFidelity`.
 */
export function fidelityFromExtractionReport(input: {
  points: unknown[];
  candidateCount: number;
  fidelity: { score: number; coverage: number; distribution: number; pointCount: number };
  boundingBox: { min: { x: number; y: number; z: number }; max: { x: number; y: number; z: number } };
}, sourceLabel?: string): FidelityData {
  const bb = input.boundingBox;
  return {
    candidateCount: input.candidateCount,
    pointCount: input.fidelity.pointCount || input.points.length,
    coverage: input.fidelity.coverage,
    distribution: input.fidelity.distribution,
    score: Math.round(input.fidelity.score * 100),
    boundingBox: {
      width: +(bb.max.x - bb.min.x).toFixed(1),
      height: +(bb.max.y - bb.min.y).toFixed(1),
      depth: +(bb.max.z - bb.min.z).toFixed(1),
    },
    sourceLabel,
  };
}
