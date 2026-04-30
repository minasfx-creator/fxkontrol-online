/**
 * RealHardwareBridgeDialog
 * ────────────────────────────────────────────────────────────
 * Pushes the current ShowPlan timeline (filtered to FXK16-addressable
 * cues — items carrying tube 1..16) into the CueQueueRunner and exposes
 * Connect / Arm / Run / E-STOP controls bound to the live bridge.
 *
 * Honest-hardware rules:
 *   • Status badges reflect REAL bridge state — never simulated.
 *   • E-STOP is always available, regardless of run status.
 *   • ARM is a discrete user action, never auto-triggered.
 *   • Run is gated on bridge.connected && status === 'armed'.
 */

import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Usb,
  Bluetooth,
  Plug,
  PlugZap,
  ShieldAlert,
  Play,
  Square,
  Lock,
  Zap,
  Clock,
  Activity,
} from 'lucide-react';
import { useFXK16Bridge } from '@/hooks/useFXK16Bridge';
import { useProjectStore } from '@/store/useProjectStore';
import {
  getCueQueueRunner,
  type CueRunEvent,
  type CueRunStatus,
  type CueClockSource,
  type CueRunDiagnostics,
} from '../hardware/cueQueueRunner';
import { useHoldToConfirm } from '@/hooks/useHoldToConfirm';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function RealHardwareBridgeDialog({ open, onClose }: Props) {
  const fxk = useFXK16Bridge();
  const items = useProjectStore((s) => s.timelineItems);
  const runner = getCueQueueRunner();

  const [status, setStatus] = useState<CueRunStatus>(runner.getStatus());
  const [progress, setProgress] = useState(runner.getProgress());
  const [log, setLog] = useState<CueRunEvent[]>([]);

  // Subscribe to runner status + events while open.
  useEffect(() => {
    if (!open) return;
    const offS = runner.onStatus((s) => {
      setStatus(s);
      setProgress(runner.getProgress());
    });
    const offE = runner.onEvent((e) => {
      setLog((l) => [...l.slice(-49), e]);
      setProgress(runner.getProgress());
    });
    return () => {
      offS();
      offE();
    };
  }, [open, runner]);

  // Compile the addressable batch every time the dialog opens.
  const addressable = useMemo(() => {
    return items.filter(
      (it) => it.tube !== undefined && it.tube >= 1 && it.tube <= 16,
    );
  }, [items]);

  const skipped = items.length - addressable.length;

  const loadCues = () => {
    try {
      const r = runner.load(addressable);
      setLog((l) => [
        ...l,
        { type: 'started', cueIndex: 0, message: `loaded ${r.loaded}, skipped ${r.skipped}` },
      ]);
    } catch (e) {
      setLog((l) => [...l, { type: 'error', cueIndex: 0, message: (e as Error).message }]);
    }
  };

  const handleArm = () => {
    try {
      runner.arm();
    } catch (e) {
      setLog((l) => [...l, { type: 'error', cueIndex: 0, message: (e as Error).message }]);
    }
  };

  const handleRun = () => {
    try {
      runner.run();
    } catch (e) {
      setLog((l) => [...l, { type: 'error', cueIndex: 0, message: (e as Error).message }]);
    }
  };

  const eStop = useHoldToConfirm({
    duration: 600,
    onConfirm: () => runner.eStop('user-hold'),
  });

  const canArm =
    fxk.isConnected && fxk.isFXK16 &&
    (status === 'idle' || status === 'finished' || status === 'aborted') &&
    runner.getProgress().total > 0;
  const canRun = fxk.isConnected && status === 'armed';
  const canCancel: boolean = status === 'running' || status === 'armed';

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl bg-[#050810]/95 border-cyan-500/30 backdrop-blur">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-cyan-200">
            <PlugZap className="h-5 w-5" />
            Real Hardware Bridge — FXK16
          </DialogTitle>
        </DialogHeader>

        {/* Bridge status row */}
        <div className="rounded-lg border border-cyan-500/15 bg-cyan-500/5 p-2 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge
              variant="outline"
              className={
                fxk.isConnected
                  ? 'border-green-500/40 text-green-300'
                  : 'border-muted-foreground/30 text-muted-foreground'
              }
            >
              <Plug className="h-3 w-3 mr-1" />
              {fxk.isConnected ? 'Connected' : 'Disconnected'}
            </Badge>
            <Badge
              variant="outline"
              className={
                fxk.isFXK16
                  ? 'border-cyan-500/40 text-cyan-300'
                  : 'border-amber-500/40 text-amber-300'
              }
            >
              {fxk.status.deviceModel ?? 'unknown'} · {fxk.status.channelCount ?? 0}ch
            </Badge>
            {fxk.status.transport && (
              <Badge variant="outline" className="border-cyan-500/30 text-cyan-200/80">
                {fxk.status.transport}
              </Badge>
            )}
            <Badge
              variant="outline"
              className={
                status === 'armed' || status === 'running'
                  ? 'border-amber-500/40 text-amber-300'
                  : status === 'finished'
                  ? 'border-green-500/40 text-green-300'
                  : status === 'aborted'
                  ? 'border-red-500/40 text-red-300'
                  : 'border-cyan-500/30 text-cyan-200/70'
              }
            >
              {status.toUpperCase()} · {progress.fired}/{progress.total}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-7 border-cyan-500/40 text-cyan-200 hover:bg-cyan-500/10"
              onClick={() => fxk.connectUSB()}
              disabled={fxk.isConnected}
            >
              <Usb className="h-3 w-3 mr-1" /> USB
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 border-cyan-500/40 text-cyan-200 hover:bg-cyan-500/10"
              onClick={() => fxk.connectBLE()}
              disabled={fxk.isConnected}
            >
              <Bluetooth className="h-3 w-3 mr-1" /> BLE
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-muted-foreground hover:text-red-300"
              onClick={() => fxk.disconnect()}
              disabled={!fxk.isConnected}
            >
              Disconnect
            </Button>
          </div>
        </div>

        {/* Cue load summary */}
        <div className="rounded-lg border border-cyan-500/15 bg-cyan-500/5 p-2 flex items-center gap-3">
          <div className="text-xs text-cyan-200">
            <span className="font-mono text-cyan-300 text-sm">{addressable.length}</span>{' '}
            addressable cue(s)
            {skipped > 0 && (
              <span className="text-amber-300/80 ml-2">
                · {skipped} skipped (no tube/rack)
              </span>
            )}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-7 border-cyan-500/40 text-cyan-200 hover:bg-cyan-500/10"
              onClick={loadCues}
              disabled={status === 'running'}
            >
              Load Cues
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 border-amber-500/40 text-amber-200 hover:bg-amber-500/10"
              onClick={handleArm}
              disabled={!canArm}
            >
              <Lock className="h-3 w-3 mr-1" /> ARM
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 border-green-500/40 text-green-200 hover:bg-green-500/10"
              onClick={handleRun}
              disabled={!canRun}
            >
              <Play className="h-3 w-3 mr-1" /> RUN
            </Button>
          </div>
        </div>

        {/* E-STOP — hold-to-confirm */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onPointerDown={eStop.startHold}
            onPointerUp={eStop.cancelHold}
            onPointerLeave={eStop.cancelHold}
            disabled={!canCancel}
            className="relative flex-1 h-10 rounded-lg border border-red-500/60 bg-red-500/10 text-red-200 font-bold tracking-wider uppercase text-xs hover:bg-red-500/20 transition-all disabled:opacity-40 overflow-hidden"
          >
            <div
              className="absolute inset-y-0 left-0 bg-red-500/30 transition-[width] duration-75"
              style={{ width: `${eStop.progress * 100}%` }}
            />
            <span className="relative flex items-center justify-center gap-2">
              <ShieldAlert className="h-4 w-4" />
              HOLD TO E-STOP (600ms)
            </span>
          </button>
          <Button
            size="sm"
            variant="ghost"
            className="h-10 text-muted-foreground hover:text-amber-300"
            onClick={() => runner.cancel()}
            disabled={!canCancel}
          >
            <Square className="h-3 w-3 mr-1" /> Cancel
          </Button>
        </div>

        {/* Live event log */}
        <div className="rounded-lg border border-cyan-500/15 bg-[#020407] p-2 max-h-40 overflow-auto font-mono text-[10px]">
          {log.length === 0 ? (
            <div className="text-muted-foreground/50 text-center py-4">
              No events yet — load + arm + run.
            </div>
          ) : (
            log.slice(-20).reverse().map((e, i) => (
              <div
                key={i}
                className={
                  e.type === 'fired'
                    ? 'text-cyan-300'
                    : e.type === 'aborted' || e.type === 'error'
                    ? 'text-red-300'
                    : e.type === 'finished'
                    ? 'text-green-300'
                    : 'text-muted-foreground'
                }
              >
                {e.type === 'fired' && <Zap className="inline h-2 w-2 mr-1" />}
                <span className="opacity-50">#{e.cueIndex.toString().padStart(3, '0')}</span>{' '}
                {e.type.toUpperCase()}
                {e.channel !== undefined && ` ch${e.channel}`}
                {e.time !== undefined && ` @${e.time.toFixed(2)}s`}
                {e.message && ` — ${e.message}`}
              </div>
            ))
          )}
        </div>

        <div className="text-[10px] text-muted-foreground/70 leading-relaxed">
          ⚠ This dispatches LIVE fire commands to the connected FXK16 over the
          chosen transport. Channels are 1:1 (tube → relay 1..16). The bridge
          schedules cues client-side via setTimeout (~50ms precision). For
          mission-critical timing, use the SMPTE engine.
        </div>
      </DialogContent>
    </Dialog>
  );
}
