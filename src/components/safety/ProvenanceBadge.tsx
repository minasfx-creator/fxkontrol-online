/**
 * ─── ProvenanceBadge ───────────────────────────────────────────────
 * Canonical Honesty Layer chip. Renders SIMULATED / REPLAY /
 * LIVE READ-ONLY / NOT INTEGRATED uniformly across every surface that
 * shows hardware-derived data. Use this instead of ad-hoc spans so the
 * design tokens (--ds-status-*) stay coherent and auditable.
 */
import { cn } from '@/lib/utils';
import { getProvenanceBadge, type IntegrationMode } from '@/core/hardware/provenance';

const MODE_CLASS: Record<IntegrationMode, string> = {
  simulated:       'ds-status-sync',          // cyan — synthetic / sim
  replay:          'ds-status-warn',          // amber — replay
  live_read_only:  'ds-status-ok',            // green — verified live
  not_integrated:  'ds-status-fail',          // red — no truth source
};

export interface ProvenanceBadgeProps {
  mode: IntegrationMode;
  /** Optional shorter form for dense matrices. */
  compact?: boolean;
  className?: string;
  title?: string;
}

export function ProvenanceBadge({ mode, compact, className, title }: ProvenanceBadgeProps) {
  const badge = getProvenanceBadge(mode);
  const label = compact
    ? (mode === 'live_read_only' ? 'LIVE-RO' : badge.label.replace(' ', ''))
    : badge.label;
  return (
    <span
      data-prov={mode}
      title={title ?? badge.label}
      className={cn(
        'inline-flex items-center justify-center rounded font-mono uppercase tracking-wide',
        compact ? 'text-[9px] px-1.5 py-0.5' : 'text-[10px] px-2 py-0.5',
        MODE_CLASS[mode],
        className,
      )}
    >
      {label}
    </span>
  );
}

export default ProvenanceBadge;
