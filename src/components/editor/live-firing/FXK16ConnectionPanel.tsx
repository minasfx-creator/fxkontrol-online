/**
 * FXK16ConnectionPanel — compact connect/status card for the FXKPYRO
 * console. Lets the operator wire the FXK16 (16-ch ESP32-S3 relay
 * board) over USB-CDC or BLE-UART, see live handshake metadata
 * (model, firmware, channels, transport, RSSI), ARM/DISARM the
 * client-side firing gate, run a quick test FIRE on a chosen channel,
 * and trigger E-STOP.
 *
 * Test FIRE uses Hold-to-Confirm (800ms) so an accidental tap never
 * discharges the bus. ARM is enforced client-side via the typed
 * command API (`useFXK16Commands`); E-STOP bypasses ARM and
 * auto-disarms.
 */
import { useState, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bluetooth, Usb, Power, AlertTriangle, Flame, CheckCircle2, RadioTower,
  ExternalLink, Loader2, Lock, Unlock, HelpCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useFXK16Bridge, FXK16_MAX_CHANNEL } from '@/hooks/useFXK16Bridge';
import { useFXK16Commands } from '@/hooks/useFXK16Commands';
import type { CommandResponse, Fxk16ErrorCode } from '@/lib/fxk16/commandApi';
import { detectPlatformCapabilities } from '@/lib/platformCapabilities';

const HOLD_MS = 800;
const PULSE_MS = 50;

/** Map a bridge reason code to an actionable, human-readable hint. */
function usbErrorHint(code?: string, msg?: string): string | null {
  switch (code) {
    case 'UNSUPPORTED_TRANSPORT':
      return 'Use Chrome/Edge desktop ou Chrome Android. Safari/iOS não suportam WebSerial.';
    case 'PERMISSION_DENIED':
      return 'Selecione a porta do FXK16 no diálogo do navegador (CP210x / CH340 / ESP32-S3).';
    case 'SERIAL_OPEN_FAILED':
      return 'Porta ocupada ou cabo defeituoso. Feche Arduino IDE / outros apps e tente novamente.';
    case 'HANDSHAKE_TIMEOUT':
      return 'FXK16 não respondeu. Confirme firmware FXK16, pressione RST na placa e reconecte.';
    case 'HEARTBEAT_TIMEOUT':
      return 'Link caiu após conectar. Verifique cabo e estabilidade de energia.';
    default:
      return msg ? null : null;
  }
}

interface Props {
  /** Tighter padding for embedding in panel headers. */
  compact?: boolean;
}

interface LastResult {
  label: string;
  ok: boolean;
  code?: Fxk16ErrorCode;
  message?: string;
  at: number;
}

function summarize<T>(label: string, r: CommandResponse<T>): LastResult {
  const at = Date.now();
  if (r.ok === true) {
    return { label, ok: true, at };
  }
  return { label, ok: false, code: r.code, message: r.message, at };
}

export function FXK16ConnectionPanel({ compact = false }: Props) {
  const navigate = useNavigate();
  const { status, isFXK16, isConnected, connectUSB, connectBLE, disconnect } =
    useFXK16Bridge();
  const { api, armed, ready } = useFXK16Commands();
  const caps = useMemo(() => detectPlatformCapabilities(), []);
  const usbHint = usbErrorHint((status as any).lastErrorCode, status.lastError);

  const [busy, setBusy] = useState<'usb' | 'ble' | 'disc' | null>(null);
  const [testCh, setTestCh] = useState(1);
  const [holdMode, setHoldMode] = useState<'arm' | 'fire' | null>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [last, setLast] = useState<LastResult | null>(null);

  const onConnectUSB = useCallback(async () => {
    setBusy('usb'); try { await connectUSB(); } finally { setBusy(null); }
  }, [connectUSB]);
  const onConnectBLE = useCallback(async () => {
    setBusy('ble'); try { await connectBLE(); } finally { setBusy(null); }
  }, [connectBLE]);
  const onDisconnect = useCallback(async () => {
    setBusy('disc'); try { await disconnect(); } finally { setBusy(null); }
  }, [disconnect]);

  // ── ARM toggle (Hold-to-Confirm) ────────────────────────────────
  const startArmHold = useCallback(() => {
    if (armed) {
      // Disarm is instant — no hold required.
      const r = api.disarm();
      setLast(summarize('DISARM', r));
      toast.info('FXK16 desarmado');
      return;
    }
    if (!ready) {
      toast.error('FXK16 não está pronto (offline ou link degradado)');
      return;
    }
    setHoldMode('arm');
    holdTimer.current = setTimeout(() => {
      setHoldMode(null);
      holdTimer.current = null;
      const r = api.arm();
      setLast(summarize('ARM', r));
      if (r.ok === true) toast.success('FXK16 ARMADO');
      else toast.error(`ARM falhou: ${r.message}`);
    }, HOLD_MS);
  }, [api, armed, ready]);

  const startFireHold = useCallback(() => {
    if (!ready) return;
    if (!armed) {
      toast.warning('Arme o FXK16 antes de testar FIRE');
      return;
    }
    setHoldMode('fire');
    holdTimer.current = setTimeout(async () => {
      setHoldMode(null);
      holdTimer.current = null;
      const r = await api.fire(testCh, PULSE_MS);
      setLast(summarize(`FIRE ch${testCh}`, r));
      if (r.ok === false) toast.error(`FIRE falhou: ${r.code} — ${r.message}`);
    }, HOLD_MS);
  }, [api, armed, ready, testCh]);

  const cancelHold = useCallback(() => {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
    setHoldMode(null);
  }, []);

  const onEStop = useCallback(async () => {
    const r = await api.stop();
    setLast(summarize('E-STOP', r));
    if (r.ok === true) toast.warning('E-STOP enviado — FXK16 desarmado');
    else toast.error(`E-STOP falhou: ${r.code} — ${r.message}`);
  }, [api]);

  // ── Visual state ────────────────────────────────────────────────
  const accent = armed
    ? 'border-red-500/50 bg-red-500/5'
    : isFXK16 && isConnected
      ? 'border-emerald-500/40 bg-emerald-500/5'
      : status.connecting
        ? 'border-amber-500/40 bg-amber-500/5'
        : 'border-border/40 bg-card/40';

  const statusChip = !isConnected
    ? <Badge variant="outline" className="text-[9px] border-muted-foreground/40 text-muted-foreground">offline</Badge>
    : !isFXK16
      ? <Badge variant="outline" className="text-[9px] border-amber-500/40 text-amber-300">{status.deviceModel ?? 'unknown'}</Badge>
      : armed
        ? <Badge className="text-[9px] bg-red-600 text-primary-foreground border-0"><Unlock className="w-2.5 h-2.5 mr-0.5"/>ARMED</Badge>
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
          <div className="min-w-0 flex-1">
            <p className="text-[10px] text-red-200 break-words">{status.lastError}</p>
            {usbHint && (
              <p className="mt-1 text-[10px] text-amber-200/90 break-words flex items-start gap-1">
                <HelpCircle className="w-3 h-3 mt-0.5 shrink-0" />
                <span>{usbHint}</span>
              </p>
            )}
          </div>
        </div>
      )}

      {!caps.webSerial && !isConnected && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1.5 text-[10px] text-amber-200">
          WebSerial indisponível neste navegador. USB direto requer Chrome/Edge desktop ou Chrome Android — use BLE como alternativa.
        </div>
      )}

      {/* Last typed-API result */}
      {last && (
        <div className={cn(
          'rounded-md border px-2 py-1 text-[10px] font-mono flex items-start gap-1.5',
          last.ok
            ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-200'
            : 'border-red-500/40 bg-red-500/10 text-red-200',
        )}>
          {last.ok
            ? <CheckCircle2 className="w-3 h-3 mt-0.5 shrink-0" />
            : <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />}
          <span className="break-words">
            <strong>{last.label}</strong>{' '}
            {last.ok ? 'OK' : <>{last.code} — {last.message}</>}
          </span>
        </div>
      )}

      {/* Connect actions */}
      {!isConnected ? (
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            className="h-10 gap-1.5 text-[11px]"
            onClick={onConnectUSB}
            disabled={busy !== null || status.connecting || !caps.webSerial}
            title={caps.webSerial ? 'Conectar FXK16 via USB-CDC (CP210x / CH340 / ESP32-S3)' : 'WebSerial indisponível neste navegador'}
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
          {/* ARM toggle */}
          <Button
            variant={armed ? 'destructive' : 'outline'}
            className={cn(
              'w-full h-10 gap-1.5 text-[11px] select-none',
              !armed && holdMode === 'arm' && 'bg-amber-500/20 border-amber-500/60 text-amber-200',
            )}
            onPointerDown={startArmHold}
            onPointerUp={armed ? undefined : cancelHold}
            onPointerLeave={armed ? undefined : cancelHold}
            onPointerCancel={armed ? undefined : cancelHold}
            disabled={!ready && !armed}
          >
            {armed
              ? <><Unlock className="w-3.5 h-3.5" /> DISARM</>
              : holdMode === 'arm'
                ? <><Lock className="w-3.5 h-3.5" /> Mantenha {HOLD_MS}ms…</>
                : <><Lock className="w-3.5 h-3.5" /> ARM (segure {HOLD_MS}ms)</>}
          </Button>

          {/* Test fire row */}
          <div className="rounded-lg border border-border/40 bg-background/40 p-2 space-y-2">
            <p className="text-[9px] uppercase tracking-wider text-muted-foreground">
              Test FIRE — segure {HOLD_MS}ms{!armed && ' (requer ARM)'}
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
                  holdMode === 'fire' && 'bg-red-500/20 border-red-500/60 text-red-200',
                )}
                disabled={!armed}
                onPointerDown={startFireHold}
                onPointerUp={cancelHold}
                onPointerLeave={cancelHold}
                onPointerCancel={cancelHold}
              >
                <Flame className="w-3.5 h-3.5" />
                {holdMode === 'fire' ? 'Disparando…' : `Fire CH ${testCh} (${PULSE_MS}ms)`}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="destructive"
              className="h-10 gap-1.5 text-[11px]"
              onClick={onEStop}
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
