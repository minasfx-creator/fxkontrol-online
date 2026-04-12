/**
 * ContinuityMatrix — 32-channel visual grid for igniter continuity status.
 * Displays OK/OPEN/SHORT per pin with resistance values.
 */
import { useState, useCallback } from 'react';
import { continuityCheckService, type PinResult, type PinStatus } from '@/core/safety/ContinuityCheckService';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { RefreshCw, Zap } from 'lucide-react';

const STATUS_STYLE: Record<PinStatus, { bg: string; text: string; label: string }> = {
  OK:      { bg: 'bg-emerald-500/20 border-emerald-500/40', text: 'text-emerald-400', label: 'OK' },
  OPEN:    { bg: 'bg-amber-500/15 border-amber-500/30',    text: 'text-amber-400',   label: 'OPEN' },
  SHORT:   { bg: 'bg-red-500/20 border-red-500/40',        text: 'text-red-400',     label: 'SHORT' },
  UNKNOWN: { bg: 'bg-muted/30 border-border/20',           text: 'text-muted-foreground/50', label: '---' },
};

function PinCell({ pin }: { pin: PinResult }) {
  const style = STATUS_STYLE[pin.status];
  return (
    <div className={cn(
      'flex flex-col items-center justify-center rounded border p-1.5 transition-all',
      style.bg,
      pin.status === 'SHORT' && 'animate-pulse'
    )}>
      <span className="text-[8px] font-mono text-muted-foreground/60">CH {String(pin.pin).padStart(2, '0')}</span>
      <span className={cn('text-[10px] font-black font-mono', style.text)}>{style.label}</span>
      <span className="text-[7px] font-mono text-muted-foreground/40">
        {pin.status === 'UNKNOWN' ? '---' : pin.ohms < 1000 ? `${pin.ohms.toFixed(1)}Ω` : '∞'}
      </span>
    </div>
  );
}

export default function ContinuityMatrix() {
  const [pins, setPins] = useState<readonly PinResult[]>(continuityCheckService.getAllPins());
  const [checking, setChecking] = useState(false);

  const runCheck = useCallback(async () => {
    setChecking(true);
    await continuityCheckService.runFullCheck();
    setPins([...continuityCheckService.getAllPins()]);
    setChecking(false);
  }, []);

  const report = continuityCheckService.getReport();

  return (
    <div className="flex flex-col h-full p-3 gap-3 bg-background/80">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-mono font-bold tracking-widest text-foreground uppercase">
            Continuity Matrix
          </span>
        </div>
        <div className="flex items-center gap-3">
          {/* Summary badges */}
          <div className="flex items-center gap-1.5 text-[9px] font-mono">
            <span className="text-emerald-400">{report.ok} OK</span>
            <span className="text-muted-foreground/30">|</span>
            <span className="text-amber-400">{report.open} OPEN</span>
            <span className="text-muted-foreground/30">|</span>
            <span className="text-red-400">{report.short} SHORT</span>
            <span className="text-muted-foreground/30">|</span>
            <span className="text-muted-foreground/50">{report.unknown} UNK</span>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={runCheck}
            disabled={checking}
            className="h-6 text-[9px] font-mono gap-1"
          >
            <RefreshCw className={cn('w-3 h-3', checking && 'animate-spin')} />
            {checking ? 'CHECKING...' : 'RUN CHECK'}
          </Button>
        </div>
      </div>

      {/* 32-channel grid: 8 columns x 4 rows */}
      <div className="grid grid-cols-8 gap-1.5 flex-1">
        {pins.map(pin => (
          <PinCell key={pin.pin} pin={pin} />
        ))}
      </div>

      {/* ARM readiness */}
      <div className={cn(
        'flex items-center justify-center py-1.5 rounded border text-[10px] font-mono font-bold tracking-widest',
        continuityCheckService.isPassingForArm()
          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
          : 'bg-red-500/10 border-red-500/30 text-red-400'
      )}>
        {continuityCheckService.isPassingForArm() ? 'ARM READY — CONTINUITY PASS' : 'ARM BLOCKED — CHECK FAILURES'}
      </div>
    </div>
  );
}
