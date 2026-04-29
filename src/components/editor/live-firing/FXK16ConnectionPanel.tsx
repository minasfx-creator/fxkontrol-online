/**
 * FXK16ConnectionPanel — compact connect/status card for the FXKPYRO
 * console. Lets the operator wire the FXK16 (16-ch ESP32-S3 relay
 * board) over USB-CDC or BLE-UART, see live handshake metadata
 * (model, firmware, channels, transport, RSSI), run a quick test FIRE
 * on a chosen channel, and trigger E-STOP.
 *
 * READ-ONLY-FRIENDLY: the test FIRE button uses Hold-to-Confirm
 * (800ms) so an accidental tap never discharges the bus.
 */
import { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bluetooth, Usb, Power, AlertTriangle, Flame, CheckCircle2, RadioTower,
  ExternalLink, Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useFXK16Bridge, FXK16_MAX_CHANNEL } from '@/hooks/useFXK16Bridge';

const HOLD_MS = 800;
const PULSE_MS = 50;

interface Props {
  /** Tighter padding for embedding in panel headers. */
  compact?: boolean;
}

export function FXK16ConnectionPanel({ compact = false }: Props) {
  const navigate = useNavigate();
  const { status, isFXK16, isConnected, connectUSB, connectBLE, disconnect, fire, eStop } =
    useFXK16Bridge();

  const [busy, setBusy] = useState<'usb' | 'ble' | 'disc' | null>(null);
  const [testCh, setTestCh] = useState(1);
  const [holding, setHolding] = useState(false);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onConnectUSB = useCallback(async () => {
    setBusy('usb'); try { await connectUSB(); } finally { setBusy(null); }
  }, [connectUSB]);
  const onConnectBLE = useCallback(async () => {
    setBusy('ble'); try { await connectBLE(); } finally { setBusy(null); }
  }, [connectBLE]);
  const onDisconnect = useCallback(async () => {
    setBusy('disc'); try { await disconnect(); } finally { setBusy(null); }
  }, [disconnect]);

  const startHold = useCallback(() => {
    if (!isConnected) return;
    setHolding(true);
    holdTimer.current = setTimeout(() => {
      setHolding(false);
      holdTimer.current = null;
      void fire(testCh, PULSE_MS);
    }, HOLD_MS);
  }, [isConnected, testCh, fire]);

  const cancelHold = useCallback(() => {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
    setHolding(false);
  }, []);

  // ── Visual state ────────────────────────────────────────────────
  const accent = isFXK16 && isConnected
    ? 'border-emerald-500/40 bg-emerald-500/5'
    : status.connecting
      ? 'border-amber-500/40 bg-amber-500/5'
      : 'border-border/40 bg-card/40';

  const statusChip = !isConnected
    ? <Badge variant="outline" className="text-[9px] border-muted-foreground/40 text-muted-foreground">offline</Badge>
    : !isFXK16
      ? <Badge variant="outline" className="text-[9px] border-amber-500/40 text-amber-300">{status.deviceModel ?? 'unknown'}</Badge>
      : <Badge className="text-[9px] bg-emerald-600 text-primary-foreground border-0"><CheckCircle2 className="w-2.5 h-2.5 mr-0.5"/>FXK16 OK</Badge>;

  const transportLabel = status.transport && status.transport !== 'none'
    ? status.transport.toUpperCase()
    : '—';

  return (
    <div className={cn('rounded-xl border backdrop-blur', accent, compact ? 'p-3' : 'p-4', 'space-y-3')}>
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <RadioTower className="w-4 h-4 text-primary shrink-0" />
          <h3 className="text-xs font-bold font-mono uppercase tracking-wider truncate">
            FXK16 — 16ch Relay
          </h3>
        </div>
        {statusChip}
      </div>

      {/* Live metadata */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[10px] font-mono">
        <Row label="Modelo" value={status.deviceModel ?? '—'} accent={isFXK16} />
        <Row label="Canais" value={status.channelCount != null ? String(status.channelCount) : '—'} />
        <Row label="Firmware" value={status.firmwareVersion ?? '—'} />
        <Row label="Transport" value={transportLabel} />
        <Row label="Link" value={status.linkHealth ?? 'disconnected'} />
        <Row label="RSSI" value={status.rssi != null ? `${status.rssi} dBm` : '—'} />
      </div>

      {status.lastError && !isConnected && (
        <div className="rounded-md border border-red-500/40 bg-red-500/10 px-2 py-1.5 flex items-start gap-1.5">
          <AlertTriangle className="w-3 h-3 text-red-400 mt-0.5 shrink-0" />
          <p className="text-[10px] text-red-200 break-words">{status.lastError}</p>
        </div>
      )}

      {/* Connect actions */}
      {!isConnected ? (
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            className="h-10 gap-1.5 text-[11px]"
            onClick={onConnectUSB}
            disabled={busy !== null || status.connecting}
          >
            {busy === 'usb' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Usb className="w-3.5 h-3.5" />}
            USB
          </Button>
          <Button
            variant="outline"
            className="h-10 gap-1.5 text-[11px]"
            onClick={onConnectBLE}
            disabled={busy !== null || status.connecting}
          >
            {busy === 'ble' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bluetooth className="w-3.5 h-3.5" />}
            BLE
          </Button>
          <Button
            variant="ghost"
            className="col-span-2 h-9 gap-1.5 text-[10px] text-muted-foreground"
            onClick={() => navigate('/pairing/ble')}
          >
            <ExternalLink className="w-3 h-3" /> Abrir wizard de pareamento BLE
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Test fire row */}
          <div className="rounded-lg border border-border/40 bg-background/40 p-2 space-y-2">
            <p className="text-[9px] uppercase tracking-wider text-muted-foreground">
              Test FIRE — segure {HOLD_MS}ms
            </p>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                max={FXK16_MAX_CHANNEL}
                value={testCh}
                onChange={(e) => {
                  const v = Number.parseInt(e.target.value, 10);
                  if (!Number.isNaN(v)) setTestCh(Math.min(FXK16_MAX_CHANNEL, Math.max(1, v)));
                }}
                className="h-9 w-16 text-center font-mono text-xs"
                aria-label="Canal de teste FXK16"
              />
              <Button
                variant="outline"
                className={cn(
                  'flex-1 h-9 gap-1.5 text-[11px] select-none',
                  holding && 'bg-red-500/20 border-red-500/60 text-red-200',
                )}
                onPointerDown={startHold}
                onPointerUp={cancelHold}
                onPointerLeave={cancelHold}
                onPointerCancel={cancelHold}
              >
                <Flame className="w-3.5 h-3.5" />
                {holding ? `Disparando…` : `Fire CH ${testCh} (${PULSE_MS}ms)`}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="destructive"
              className="h-10 gap-1.5 text-[11px]"
              onClick={() => void eStop()}
            >
              <AlertTriangle className="w-3.5 h-3.5" /> E-STOP
            </Button>
            <Button
              variant="outline"
              className="h-10 gap-1.5 text-[11px]"
              onClick={onDisconnect}
              disabled={busy === 'disc'}
            >
              {busy === 'disc' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Power className="w-3.5 h-3.5" />}
              Desconectar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2 min-w-0">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className={cn('truncate', accent && 'text-emerald-300 font-semibold')}>{value}</span>
    </div>
  );
}
