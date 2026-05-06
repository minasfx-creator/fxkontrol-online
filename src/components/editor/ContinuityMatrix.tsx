/**
 * ─── ContinuityMatrix v2 — Honest 4×8 grid ─────────────────────────
 * 32 channels in 4 rows × 8 columns. Each row labels its FXK16 module
 * source (or "—" when no FXK16 is online). Provenance badge in the
 * header reflects the MUX reader's integration mode.
 *
 * READ-ONLY UI. Never imports uiCommandGateway / fieldBus / executor /
 * SafetyStateMachine.transition. The only kernel write is the implicit
 * `continuityCheckService.runFullCheck()` triggered by RUN CHECK,
 * which routes through the consolidated continuity ↔ SSM contract.
 */
import { useEffect, useState } from 'react';
import { useContinuityMatrix } from '@/hooks/useContinuityMatrix';
import { useActiveControllers } from '@/hooks/useActiveControllers';
import ProvenanceBadge from '@/components/safety/ProvenanceBadge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { RefreshCw, Zap } from 'lucide-react';
import { workMode } from '@/core/safety/workMode';
import type { PinResult, PinStatus } from '@/core/safety/ContinuityCheckService';

const STATUS_CLASS: Record<PinStatus, string> = {
  OK:      'ds-status-ok',
  OPEN:    'ds-status-warn',
  SHORT:   'ds-status-fail',
  UNKNOWN: 'ds-status-mute',
};

const STATUS_LABEL: Record<PinStatus, string> = {
  OK: 'OK', OPEN: 'OPEN', SHORT: 'SHORT', UNKNOWN: '---',
};

function PinCell({ pin }: { pin: PinResult }) {
  const ohmsLabel =
    pin.status === 'UNKNOWN' ? '---'
    : !Number.isFinite(pin.ohms) ? '∞'
    : pin.ohms < 1000 ? `${pin.ohms.toFixed(1)}Ω`
    : '∞';
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded border p-1 transition-all',
        'border-border/40 bg-background/40',
        pin.status === 'SHORT' && 'animate-pulse',
      )}
      data-status={pin.status}
    >
      <span className="text-[8px] font-mono text-muted-foreground/60">
        CH {String(pin.pin).padStart(2, '0')}
      </span>
      <span className={cn('text-[10px] font-black font-mono px-1.5 rounded', STATUS_CLASS[pin.status])}>
        {STATUS_LABEL[pin.status]}
      </span>
      <span className="text-[7px] font-mono text-muted-foreground/40">{ohmsLabel}</span>
    </div>
  );
}

export default function ContinuityMatrix() {
  const { pins, report, provenance, checking, isPassingForArm, runCheck } =
    useContinuityMatrix(1000);

  // Map row → FXK16 module label when available.
  const fxk16s = useActiveControllers().controllers.filter(c => c.profile.kind === 'fxk16');
  const [mode, setMode] = useState(workMode.get());
  useEffect(() => workMode.subscribe(setMode), []);
  const advisory = mode !== 'real_operation';

  const rows: PinResult[][] = [0, 1, 2, 3].map(r => pins.slice(r * 8, r * 8 + 8) as PinResult[]);

  const armReadyToken =
    isPassingForArm &&
    (advisory || provenance.mode === 'live_read_only');

  return (
    <div className="flex flex-col h-full p-3 gap-3 bg-background/80">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-mono font-bold tracking-widest uppercase text-foreground">
            Continuity Matrix
          </span>
          <ProvenanceBadge
            mode={provenance.mode === 'live_read_only' ? 'live_read_only'
              : provenance.mode === 'simulated' ? 'simulated'
              : 'not_integrated'}
            compact
            title={provenance.source}
          />
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-[9px] font-mono">
            <span className="ds-status-ok px-1.5 rounded">{report.ok} OK</span>
            <span className="ds-status-warn px-1.5 rounded">{report.open} OPEN</span>
            <span className="ds-status-fail px-1.5 rounded">{report.short} SHORT</span>
            <span className="ds-status-mute px-1.5 rounded">{report.unknown} UNK</span>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={runCheck}
            disabled={checking}
            className="h-6 text-[9px] font-mono gap-1"
            title={provenance.mode === 'not_integrated'
              ? 'No hardware reader — check returns honest UNKNOWN'
              : `Read via ${provenance.source}`}
          >
            <RefreshCw className={cn('w-3 h-3', checking && 'animate-spin')} />
            {checking ? 'CHECKING…' : 'RUN CHECK'}
          </Button>
        </div>
      </div>

      {/* 4 rows × 8 cols, each row labelled by FXK16 source */}
      <div className="flex-1 flex flex-col gap-2">
        {rows.map((row, rIdx) => {
          const fx = fxk16s[rIdx];
          const sourceLabel = fx?.profile.label
            ? `${fx.profile.label} #${rIdx + 1}`
            : '—';
          return (
            <div key={rIdx} className="flex items-center gap-2">
              <div className="w-28 shrink-0 flex flex-col">
                <span className="text-[8px] font-mono uppercase tracking-widest text-muted-foreground/70">
                  Row {rIdx + 1}
                </span>
                <span className={cn(
                  'text-[10px] font-mono truncate',
                  fx ? 'text-foreground' : 'text-muted-foreground/50',
                )}>
                  {sourceLabel}
                </span>
              </div>
              <div className="grid grid-cols-8 gap-1.5 flex-1">
                {row.map(pin => <PinCell key={pin.pin} pin={pin} />)}
              </div>
            </div>
          );
        })}
      </div>

      {/* ARM readiness banner */}
      <div
        className={cn(
          'flex items-center justify-center gap-2 py-1.5 rounded border text-[10px] font-mono font-bold tracking-widest',
          armReadyToken
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
            : 'bg-red-500/10 border-red-500/30 text-red-400',
        )}
      >
        {armReadyToken
          ? (advisory ? 'SIM · ADVISORY — CONTINUITY PASS' : 'ARM READY — CONTINUITY PASS (LIVE-RO)')
          : isPassingForArm
            ? 'ARM BLOCKED — REAL OP REQUIRES LIVE-RO READER'
            : 'ARM BLOCKED — CHECK FAILURES'}
      </div>
    </div>
  );
}
