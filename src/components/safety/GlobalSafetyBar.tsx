/**
 * ─── GlobalSafetyBar — Mission Control Soberano ────────────────────
 * Always-visible chip strip below the header, above content.
 * READ-ONLY surface — never calls uiCommandGateway / fieldBus / SSM.
 * Hidden in /command (own UI) and /pairing/* (modal focus).
 *
 * Chips: WORK MODE | SAFETY STATE | READINESS | DEVICES | PLAN HASH
 * Token-only colors (--ds-status-*). Mono typography (.ds-mono).
 */

import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useSystemReadiness } from '@/hooks/useSystemReadiness';
import { showPlanManager } from '@/core/showplan/ShowPlanManager';
import { hashShowPlan } from '@/core/showplan/showPlanHash';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type Tone = 'sync' | 'ok' | 'warn' | 'fail' | 'mute';

const STATUS_TONE: Record<string, Tone> = {
  EMPTY: 'mute',
  INVALID: 'fail',
  BLOCKED: 'fail',
  READY: 'ok',
  ARMED: 'warn',
  FIRING: 'fail',
  FAULT: 'fail',
  E_STOPPED: 'fail',
};

const SSM_TONE: Record<string, Tone> = {
  IDLE: 'mute',
  LOCKED: 'sync',
  ARMED: 'warn',
  FIRING: 'fail',
  COOLDOWN: 'sync',
  SAFE: 'fail',
};

const WM_TONE: Record<string, Tone> = {
  design: 'mute',
  simulation: 'sync',
  real_operation: 'warn',
};

const PROV_TONE: Record<string, Tone> = {
  live_read_only: 'ok',
  replay: 'sync',
  simulated: 'warn',
  not_integrated: 'mute',
  none: 'mute',
};

const PROV_LABEL: Record<string, string> = {
  live_read_only: 'LIVE-RO',
  replay: 'REPLAY',
  simulated: 'SIM',
  not_integrated: 'N/I',
  none: '—',
};

function toneClass(tone: Tone): string {
  switch (tone) {
    case 'ok': return 'ds-status-ok';
    case 'warn': return 'ds-status-warn';
    case 'fail': return 'ds-status-fail';
    case 'sync': return 'ds-status-sync';
    case 'mute':
    default: return 'ds-status-mute';
  }
}

function Chip({ label, value, tone, title, onClick }: {
  label: string;
  value: string;
  tone: Tone;
  title?: string;
  onClick?: () => void;
}) {
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      title={title}
      className={cn(
        'ds-mono text-[10px] leading-none px-2 py-1 rounded-[4px]',
        'flex items-center gap-1.5 whitespace-nowrap',
        'border border-white/[0.06] bg-black/30',
        toneClass(tone),
        onClick && 'hover:bg-white/[0.04] cursor-pointer',
      )}
    >
      <span className="opacity-60">{label}</span>
      <span className="font-semibold tracking-wide">{value}</span>
    </Comp>
  );
}

export default function GlobalSafetyBar() {
  const location = useLocation();
  const r = useSystemReadiness();
  const [hash, setHash] = useState<string>('—');

  // Recompute hash when plan identity changes (best-effort, async).
  useEffect(() => {
    let cancelled = false;
    const compute = async () => {
      try {
        const h = await hashShowPlan(showPlanManager.current);
        if (!cancelled) setHash(h.slice(0, 7));
      } catch {
        if (!cancelled) setHash('—');
      }
    };
    compute();
    return () => { cancelled = true; };
  }, [r.showPlanLoaded, r.status]);

  // Hide in immersive cockpit + pairing modals
  const path = location.pathname;
  if (path === '/command' || path.startsWith('/pairing/')) return null;

  const provLabel = PROV_LABEL[r.dominantProvenance] ?? r.dominantProvenance;
  const provTone = PROV_TONE[r.dominantProvenance] ?? 'mute';

  const blockingTitle =
    r.blockingReasons.length > 0
      ? r.blockingReasons.join('\n')
      : r.warnings.length > 0
        ? `Warnings:\n${r.warnings.join('\n')}`
        : `Readiness: ${r.readinessStatus}`;

  const copyHash = async () => {
    if (hash === '—') return;
    try {
      await navigator.clipboard.writeText(hash);
      toast.success(`ShowPlan hash copiado: ${hash}`);
    } catch {
      toast.error('Falha ao copiar hash');
    }
  };

  return (
    <div
      role="status"
      aria-label="Global Safety Bar"
      data-testid="global-safety-bar"
      className={cn(
        'sticky top-0 z-[60] flex items-center gap-1.5 px-2 py-1',
        'bg-black/60 backdrop-blur-sm',
        'border-b border-white/[0.06]',
      )}
    >
      <Chip
        label="MODE"
        value={r.workMode === 'real_operation' ? 'REAL' : r.workMode.toUpperCase()}
        tone={WM_TONE[r.workMode] ?? 'mute'}
      />
      <Chip
        label="STATE"
        value={r.safetyState}
        tone={SSM_TONE[r.safetyState] ?? 'mute'}
      />
      <Chip
        label="STATUS"
        value={r.status}
        tone={STATUS_TONE[r.status] ?? 'mute'}
        title={blockingTitle}
      />
      <Chip
        label="DEV"
        value={`${r.devicesOnline}/${r.devicesTotal} ${provLabel}`}
        tone={provTone}
        title={`Dominant provenance: ${r.dominantProvenance}`}
      />
      <div className="ml-auto">
        <Chip
          label="HASH"
          value={hash}
          tone="mute"
          title="Click para copiar ShowPlan hash"
          onClick={copyHash}
        />
      </div>
    </div>
  );
}
