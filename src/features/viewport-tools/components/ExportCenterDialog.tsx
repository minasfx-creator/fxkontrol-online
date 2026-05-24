/**
 * ExportCenterDialog
 * ────────────────────────────────────────────────────────────
 * Unified exporter UI for FireOne (.csv), Showven FX Commander (.csv),
 * and MAVLink (.waypoints / .json). Every button passes through the
 * Pre-Export Validator Gate; errors block, warnings are surfaced.
 *
 * Pure read-only over ShowPlan — never mutates.
 */

import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Download,
  ShieldAlert,
  ShieldCheck,
  Flame,
  Sparkles,
  Plane,
  AlertTriangle,
  AlertCircle,
  PlugZap,
} from 'lucide-react';
import RealHardwareBridgeDialog from './RealHardwareBridgeDialog';
import ShowvenBridgeDialog from './ShowvenBridgeDialog';
import { runPreExportGate, type ExportGateReport } from '../exporters/preExportGate';
import {
  exportFireOneFDB,
  downloadFireOneFDB,
} from '../exporters/fireOneExporter';
import {
  exportShowvenPCX,
  downloadShowvenPCX,
} from '../exporters/showvenExporter';
import {
  exportDronesMavlink,
  downloadMavlink,
} from '../exporters/mavlinkExporter';

interface Props {
  open: boolean;
  onClose: () => void;
}

type Toast = { kind: 'ok' | 'warn' | 'err'; message: string } | null;

export default function ExportCenterDialog({ open, onClose }: Props) {
  const [gate, setGate] = useState<ExportGateReport | null>(null);
  const [toast, setToast] = useState<Toast>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [bridgeOpen, setBridgeOpen] = useState(false);
  const [showvenBridgeOpen, setShowvenBridgeOpen] = useState(false);

  useEffect(() => {
    if (open) {
      setGate(runPreExportGate());
      setToast(null);
    }
  }, [open]);

  const blocked = !!gate && !gate.ok;

  const summary = useMemo(() => {
    if (!gate) return null;
    return (
      <div className="flex items-center gap-2 text-xs">
        <Badge variant="outline" className="border-red-500/40 text-red-300">
          {gate.totals.error} errors
        </Badge>
        <Badge variant="outline" className="border-amber-500/40 text-amber-300">
          {gate.totals.warn} warnings
        </Badge>
        <Badge variant="outline" className="border-cyan-500/40 text-cyan-300">
          {gate.totals.info} info
        </Badge>
      </div>
    );
  }, [gate]);

  const runFireOne = () => {
    if (blocked) return;
    setBusy('fireone');
    try {
      const r = exportFireOneFDB();
      if (r.rowCount === 0) {
        setToast({ kind: 'warn', message: 'No FireOne-addressable cues (rack/tube missing on every item).' });
      } else {
        downloadFireOneFDB(r);
        setToast({
          kind: 'ok',
          message: `FireOne CSV exported — ${r.rowCount} cues${r.skipped ? `, ${r.skipped} skipped` : ''}.`,
        });
      }
    } catch (e) {
      setToast({ kind: 'err', message: (e as Error).message });
    } finally {
      setBusy(null);
    }
  };

  const runShowven = () => {
    if (blocked) return;
    setBusy('showven');
    try {
      const r = exportShowvenPCX();
      downloadShowvenPCX(r);
      const extra = r.warnings.length ? ` (${r.warnings.length} warning(s))` : '';
      setToast({
        kind: r.truncated ? 'warn' : 'ok',
        message: `Showven CSV exported — ${r.rowCount} cues${extra}.`,
      });
    } catch (e) {
      setToast({ kind: 'err', message: (e as Error).message });
    } finally {
      setBusy(null);
    }
  };

  const runMavlink = (format: 'waypoints' | 'json') => {
    if (blocked) return;
    setBusy('mavlink');
    try {
      const r = exportDronesMavlink();
      downloadMavlink(r, format);
      setToast({
        kind: r.validation.ok ? 'ok' : 'warn',
        message: `MAVLink ${format} exported — ${r.droneCount} pad(s), ${r.plan.waypoints.length} waypoint(s).`,
      });
    } catch (e) {
      setToast({ kind: 'err', message: (e as Error).message });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl bg-[#050810]/95 border-cyan-500/30 backdrop-blur">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-cyan-200">
            <Download className="h-5 w-5" />
            Export Center
          </DialogTitle>
        </DialogHeader>

        {/* Gate status */}
        <div className="rounded-lg border border-cyan-500/15 bg-cyan-500/5 p-2">
          <div className="flex items-center gap-2">
            {gate?.ok ? (
              <ShieldCheck className="h-4 w-4 text-green-400" />
            ) : (
              <ShieldAlert className="h-4 w-4 text-red-400" />
            )}
            <span className="text-xs font-semibold tracking-wider uppercase text-cyan-300">
              Pre-Export Gate
            </span>
            <div className="ml-auto">{summary}</div>
          </div>
          {gate && !gate.ok && (
            <div className="mt-2 max-h-28 overflow-y-auto pr-1 space-y-0.5">
              {gate.errors.slice(0, 8).map((e, i) => (
                <div key={i} className="flex items-start gap-2 text-[11px] text-red-300/90">
                  <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
                  <span>
                    <span className="font-mono text-[10px] text-red-400/70 mr-1">{e.code}</span>
                    {e.message}
                  </span>
                </div>
              ))}
              {gate.errors.length > 8 && (
                <div className="text-[10px] text-red-400/60">
                  +{gate.errors.length - 8} more error(s)…
                </div>
              )}
            </div>
          )}
          {gate && gate.ok && gate.warnings.length > 0 && (
            <div className="mt-2 text-[11px] text-amber-300/90 flex items-start gap-2">
              <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
              <span>
                {gate.warnings.length} warning(s) — export allowed, but review the
                Validators Report.
              </span>
            </div>
          )}
        </div>

        {/* Exporters grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">
          <ExporterCard
            icon={<Flame className="h-4 w-4" />}
            label="FireOne FDB"
            hint=".csv · FXK-PYRO 2.0"
            onClick={runFireOne}
            disabled={blocked || busy !== null}
            busy={busy === 'fireone'}
          />
          <ExporterCard
            icon={<Sparkles className="h-4 w-4" />}
            label="Showven FX Commander"
            hint=".csv · max 128 cues"
            onClick={runShowven}
            disabled={blocked || busy !== null}
            busy={busy === 'showven'}
          />
          <ExporterCard
            icon={<Plane className="h-4 w-4" />}
            label="MAVLink WPL"
            hint=".waypoints · QGC 110"
            onClick={() => runMavlink('waypoints')}
            disabled={blocked || busy !== null}
            busy={busy === 'mavlink'}
            extra={
              <button
                type="button"
                disabled={blocked || busy !== null}
                onClick={() => runMavlink('json')}
                className="text-[10px] text-cyan-400/70 hover:text-cyan-300 underline disabled:opacity-30"
              >
                JSON instead
              </button>
            }
          />
        </div>

        {/* Real Hardware Bridge — push to FXK16 over Web Serial / BLE */}
        <button
          type="button"
          onClick={() => setBridgeOpen(true)}
          disabled={blocked}
          className="mt-2 w-full rounded-lg border border-cyan-500/40 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-200 py-2 px-3 flex items-center gap-2 text-xs font-semibold tracking-wider uppercase transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <PlugZap className="h-4 w-4" />
          Real Hardware Bridge — push to FXK16
          <span className="ml-auto text-[10px] font-normal text-cyan-300/70 normal-case tracking-normal">
            Web Serial · BLE · 1:1 channels
          </span>
        </button>

        {/* Showven FX Commander Bridge — PBus 19200 8N1 dual-band */}
        <button
          type="button"
          onClick={() => setShowvenBridgeOpen(true)}
          disabled={blocked}
          className="w-full rounded-lg border border-cyan-500/40 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-200 py-2 px-3 flex items-center gap-2 text-xs font-semibold tracking-wider uppercase transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <PlugZap className="h-4 w-4" />
          Showven FX Commander — PBus dual-band
          <span className="ml-auto text-[10px] font-normal text-cyan-300/70 normal-case tracking-normal">
            Web Serial · 19200 8N1 · 433M/868M
          </span>
        </button>

        {toast && (
          <div
            className={
              'mt-2 text-xs rounded-md px-2 py-1.5 border ' +
              (toast.kind === 'ok'
                ? 'border-green-500/40 text-green-300 bg-green-500/5'
                : toast.kind === 'warn'
                ? 'border-amber-500/40 text-amber-300 bg-amber-500/5'
                : 'border-red-500/40 text-red-300 bg-red-500/5')
            }
          >
            {toast.message}
          </div>
        )}

        {blocked && (
          <div className="text-[11px] text-red-300/80 mt-1">
            Export blocked — fix the {gate?.totals.error ?? 0} error(s) above first.
            Run the Validators Report from any segment to inspect details.
          </div>
        )}
      </DialogContent>
      <RealHardwareBridgeDialog
        open={bridgeOpen}
        onClose={() => setBridgeOpen(false)}
      />
      <ShowvenBridgeDialog
        open={showvenBridgeOpen}
        onClose={() => setShowvenBridgeOpen(false)}
      />
    </Dialog>
  );
}

function ExporterCard(props: {
  icon: React.ReactNode;
  label: string;
  hint: string;
  onClick: () => void;
  disabled: boolean;
  busy: boolean;
  extra?: React.ReactNode;
}) {
  return (
    <div
      className={
        'rounded-lg border border-cyan-500/15 bg-cyan-500/5 p-2 flex flex-col gap-1.5 ' +
        (props.disabled ? 'opacity-50' : '')
      }
    >
      <div className="flex items-center gap-1.5 text-cyan-200 text-xs font-semibold">
        {props.icon}
        {props.label}
      </div>
      <div className="text-[10px] text-muted-foreground">{props.hint}</div>
      <Button
        size="sm"
        variant="outline"
        className="h-7 mt-auto border-cyan-500/40 text-cyan-200 hover:bg-cyan-500/10"
        onClick={props.onClick}
        disabled={props.disabled}
      >
        {props.busy ? 'Working…' : 'Export'}
      </Button>
      {props.extra}
    </div>
  );
}
