/**
 * ShowvenBridgeDialog
 * ────────────────────────────────────────────────────────────
 * Pushes the current ShowPlan timeline (filtered to PBus-addressable
 * cues — items carrying rack 1..64 + tube 1..16) into the Showven
 * CueQueueRunner and exposes Connect / Scan / Arm / Run / E-STOP
 * controls bound to the live PBus dual-band link.
 *
 * Honest-hardware rules:
 *   • Status badges reflect REAL transport state (state machine).
 *   • E-STOP is always available — broadcasts PBus 0x00/0xFF.
 *   • ARM is a discrete user action, never auto-triggered.
 *   • Run is gated on PBus state ∈ {connected, degraded} && armed.
 */

import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Usb,
  Plug,
  Radio,
  ShieldAlert,
  Play,
  Square,
  Lock,
  Zap,
  Search,
  BatteryMedium,
} from 'lucide-react';
import { usePBusHardware } from '@/hooks/usePBusHardware';
import { useProjectStore } from '@/store/useProjectStore';
import {
  getShowvenCueRunner,
  type ShowvenRunEvent,
  type ShowvenRunStatus,
} from '../hardware/showvenCueRunner';
import { useHoldToConfirm } from '@/hooks/useHoldToConfirm';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function ShowvenBridgeDialog({ open, onClose }: Props) {
  const pbus = usePBusHardware();
  const items = useProjectStore((s) => s.timelineItems);
  const runner = getShowvenCueRunner();

  const [status, setStatus] = useState<ShowvenRunStatus>(runner.getStatus());
  const [progress, setProgress] = useState(runner.getProgress());
  const [log, setLog] = useState<ShowvenRunEvent[]>([]);

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
    return () => { offS(); offE(); };
  }, [open, runner]);

  // Compile the addressable batch from current timeline.
  const addressable = useMemo(() => {
    return items.filter((it) => {
      const rack = (it as { rack?: number }).rack ?? 1;
      return (
        it.tube !== undefined &&
        it.tube >= 1 && it.tube <= 16 &&
        rack >= 1 && rack <= 64
      );
    });
  }, [items]);
  const skipped = items.length - addressable.length;

  const loadCues = () => {
    try {
      const r = runner.load(addressable);
      setLog((l) => [
        ...l,
        { type: 'info', cueIndex: 0, message: `loaded ${r.loaded}, skipped ${r.skipped}` },
      ]);
    } catch (e) {
      setLog((l) => [...l, { type: 'error', cueIndex: 0, message: (e as Error).message }]);
    }
  };

  const handleArm = () => {
    try { runner.arm(); }
    catch (e) {
      setLog((l) => [...l, { type: 'error', cueIndex: 0, message: (e as Error).message }]);
    }
  };

  const handleRun = () => {
    try { runner.run(); }
    catch (e) {
      setLog((l) => [...l, { type: 'error', cueIndex: 0, message: (e as Error).message }]);
    }
  };

  const handleArmAll = async () => {
    try { await pbus.armAll(); }
    catch (e) {
      setLog((l) => [...l, { type: 'error', cueIndex: 0, message: `ARM ALL failed: ${(e as Error).message}` }]);
    }
  };

  const handleScan = async () => {
    try { await pbus.discoverDevices(32); }
    catch (e) {
      setLog((l) => [...l, { type: 'error', cueIndex: 0, message: `Scan failed: ${(e as Error).message}` }]);
    }
  };

  const eStop = useHoldToConfirm({
    duration: 600,
    onConfirm: () => {
      void runner.eStop('user-hold');
      void pbus.emergencyStop().catch(() => { /* swallow */ });
    },
  });

  const canArm =
    pbus.isConnected &&
    (status === 'idle' || status === 'finished' || status === 'aborted') &&
    runner.getProgress().total > 0;
  const canRun = pbus.isConnected && status === 'armed';
  const canCancel: boolean = status === 'running' || status === 'armed';

  const transportLabel =
    pbus.connectionPath === 'wired' ? 'Web Serial' :
    pbus.connectionPath === 'radio' ? 'Radio' :
    'Disconnected';

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl bg-[#050810]/95 border-cyan-500/30 backdrop-blur">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-cyan-200">
            <Radio className="h-5 w-5" />
            Showven FX Commander Bridge — PBus dual-band
          </DialogTitle>
        </DialogHeader>

        {/* Bridge status row */}
        <div className="rounded-lg border border-cyan-500/15 bg-cyan-500/5 p-2 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge
              variant="outline"
              className={
                pbus.isConnected
                  ? 'border-green-500/40 text-green-300'
                  : 'border-muted-foreground/30 text-muted-foreground'
              }
            >
              <Plug className="h-3 w-3 mr-1" />
              {transportLabel}
            </Badge>
            <Badge variant="outline" className="border-cyan-500/40 text-cyan-300">
              19200 8N1 · {pbus.bestBand}
            </Badge>
            <Badge variant="outline" className="border-cyan-500/30 text-cyan-200/80">
              {pbus.deviceCount} device(s)
            </Badge>
            {pbus.worstBattery !== null && (
              <Badge variant="outline" className="border-amber-500/30 text-amber-200/80">
                <BatteryMedium className="h-3 w-3 mr-1" />
                {pbus.worstBattery!.toFixed(1)}V min
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
              onClick={() => pbus.connect().catch(() => {})}
              disabled={pbus.isConnected}
            >
              <Usb className="h-3 w-3 mr-1" /> Connect Serial
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 border-cyan-500/40 text-cyan-200 hover:bg-cyan-500/10"
              onClick={handleScan}
              disabled={!pbus.isConnected || pbus.scanning}
            >
              <Search className="h-3 w-3 mr-1" />
              {pbus.scanning ? 'Scanning…' : 'Scan Bus'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 border-amber-500/40 text-amber-200 hover:bg-amber-500/10"
              onClick={handleArmAll}
              disabled={!pbus.isConnected}
            >
              <Lock className="h-3 w-3 mr-1" /> Arm Fleet
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-muted-foreground hover:text-red-300"
              onClick={() => pbus.disconnect()}
              disabled={!pbus.isConnected}
            >
              Disconnect
            </Button>
          </div>
          {pbus.connectionError && (
            <div className="text-[10px] text-red-300/80 font-mono">
              {pbus.connectionError}
            </div>
          )}
        </div>

        {/* Cue load summary */}
        <div className="rounded-lg border border-cyan-500/15 bg-cyan-500/5 p-2 flex items-center gap-3 flex-wrap">
          <div className="text-xs text-cyan-200">
            <span className="font-mono text-cyan-300 text-sm">{addressable.length}</span>{' '}
            addressable cue(s) · {progress.devices} device(s)
            {skipped > 0 && (
              <span className="text-amber-300/80 ml-2">
                · {skipped} skipped (no rack/tube)
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
              <Lock className="h-3 w-3 mr-1" /> ARM Runner
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
            disabled={!pbus.isConnected && !canCancel}
            className="relative flex-1 h-10 rounded-lg border border-red-500/60 bg-red-500/10 text-red-200 font-bold tracking-wider uppercase text-xs hover:bg-red-500/20 transition-all disabled:opacity-40 overflow-hidden"
          >
            <div
              className="absolute inset-y-0 left-0 bg-red-500/30 transition-[width] duration-75"
              style={{ width: `${eStop.progress * 100}%` }}
            />
            <span className="relative flex items-center justify-center gap-2">
              <ShieldAlert className="h-4 w-4" />
              HOLD TO E-STOP (600ms) — broadcast PBus 0xFF
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
              No events yet — Connect Serial → Scan Bus → Load Cues → ARM Runner → RUN.
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
                {e.device !== undefined && ` dev${e.device}`}
                {e.channels && e.channels.length > 1
                  ? ` ch[${e.channels.join(',')}]`
                  : e.channel !== undefined
                  ? ` ch${e.channel}`
                  : ''}
                {e.time !== undefined && ` @${e.time.toFixed(2)}s`}
                {e.message && ` — ${e.message}`}
              </div>
            ))
          )}
        </div>

        <div className="text-[10px] text-muted-foreground/70 leading-relaxed">
          ⚠ This dispatches LIVE FIRE frames over PBus (19200 8N1, dual-band
          433M/868M) to every Showven PyroSlave on the bus. Mapping: rack →
          device address (1..64), tube → cue index (1..16). Same-device cues
          within {`8`}ms are coalesced into a single FIRE_SEQ frame.
        </div>
      </DialogContent>
    </Dialog>
  );
}
