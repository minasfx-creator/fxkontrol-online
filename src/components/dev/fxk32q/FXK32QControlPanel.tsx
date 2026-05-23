/**
 * ─── FXK32Q Control Panel — bench-only ──────────────────────────
 *
 * Painel dedicado pra:
 *   • Conectar via qualquer um dos 6 transportes (USB / BLE / BLE-LR /
 *     WebSocket / Wi-Fi Direct / Direct Relay = RS-485 XLII+)
 *   • Confirmar handshake (`MODEL:FXK32Q;CH:32`)
 *   • ARM client-side + Hold-to-Confirm (1s) pra disparo em batch
 *   • E-STOP de uma tecla (sempre habilitado quando bridge conectada)
 *
 * NUNCA muta workMode. NUNCA chama SafetyStateMachine direto.
 * Todo disparo passa por `createFxk32qCommandApi` → bridge singleton.
 * Em real_operation o usuário deve usar o Field Ops / uiCommandGateway —
 * este painel é pra **bancada/calibração** (Fase 3).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useFXK32QBridge, getFXK32QBridge } from '@/hooks/useFXK32QBridge';
import { createFxk32qCommandApi, type Fxk32qCommandApi } from '@/lib/fxk32q/commandApi';
import { FXK32Q_MAX_CHANNEL } from '@/lib/fxk32q/pinmap';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Cable, Bluetooth, Radio, Wifi, Network, Zap, Power, Square, ShieldCheck, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

type TransportKind = 'usb' | 'ble' | 'ble-lr' | 'ws' | 'wifi' | 'rs485';

interface TransportOpt {
  key: TransportKind;
  label: string;
  icon: typeof Cable;
  needsUrl?: boolean;
  hint: string;
}

const TRANSPORTS: TransportOpt[] = [
  { key: 'usb',    label: 'USB-CDC',         icon: Cable,     hint: '115200 8N1 (ESP32-S3 nativo)' },
  { key: 'ble',    label: 'BLE',             icon: Bluetooth, hint: 'GATT FFE0/FFE1/FFE2' },
  { key: 'ble-lr', label: 'BLE Long Range',  icon: Radio,     hint: 'Coded PHY S=8 (firmware ≥1.1)' },
  { key: 'ws',     label: 'WebSocket',       icon: Network,   needsUrl: true, hint: 'ws://<ip>:81/' },
  { key: 'wifi',   label: 'Wi-Fi Direct',    icon: Wifi,      needsUrl: true, hint: 'TCP raw 23' },
  { key: 'rs485',  label: 'RS-485 XLII+',    icon: Cable,     hint: 'USB↔RS485 frame XLII+' },
];

const HOLD_MS = 1000;
const DEFAULT_BATCH = '1,3,5,7';
const DEFAULT_PULSE_MS = 80;

export default function FXK32QControlPanel() {
  const br = useFXK32QBridge();
  const apiRef = useRef<Fxk32qCommandApi | null>(null);
  if (!apiRef.current) apiRef.current = createFxk32qCommandApi(getFXK32QBridge(), {
    onArmChange: (a) => setArmed(a),
  });
  const api = apiRef.current;

  const [transport, setTransport] = useState<TransportKind>('usb');
  const [endpoint, setEndpoint] = useState('');
  const [batchStr, setBatchStr] = useState(DEFAULT_BATCH);
  const [pulseMs, setPulseMs] = useState(DEFAULT_PULSE_MS);
  const [armed, setArmed] = useState<boolean>(api.isArmed());
  const [holding, setHolding] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const holdTimer = useRef<number | null>(null);
  const holdRaf = useRef<number | null>(null);
  const holdStart = useRef<number>(0);

  // Auto-disarm on link loss is handled inside command API; we mirror UI.
  useEffect(() => {
    if (!br.isConnected && armed) setArmed(false);
  }, [br.isConnected, armed]);

  const channels = useMemo(() => {
    const set = new Set<number>();
    for (const tok of batchStr.split(/[,\s]+/)) {
      const n = parseInt(tok, 10);
      if (Number.isFinite(n) && n >= 1 && n <= FXK32Q_MAX_CHANNEL) set.add(n);
    }
    return [...set].sort((a, b) => a - b);
  }, [batchStr]);

  const clearHold = () => {
    if (holdTimer.current !== null) { window.clearTimeout(holdTimer.current); holdTimer.current = null; }
    if (holdRaf.current !== null) { window.cancelAnimationFrame(holdRaf.current); holdRaf.current = null; }
    setHolding(false);
    setHoldProgress(0);
  };

  useEffect(() => () => clearHold(), []);

  const handleConnect = async () => {
    setBusy(true);
    try {
      let ok = false;
      switch (transport) {
        case 'usb':    ok = await br.connectUSB(); break;
        case 'ble':    ok = await br.connectBLE(); break;
        case 'ble-lr': ok = await br.connectBLELongRange(); break;
        case 'ws':     ok = await br.connectWebSocket(endpoint || undefined); break;
        case 'wifi':   ok = await br.connectWiFiDirect(endpoint || undefined); break;
        case 'rs485':  ok = await br.connectDirectRelay(); break;
      }
      if (!ok) toast.error(`Falha ao conectar via ${transport.toUpperCase()}`);
    } catch (e) {
      toast.error(`Erro ao conectar: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const handleDisconnect = async () => {
    setBusy(true);
    try { await br.disconnect(); api.disarm(); } finally { setBusy(false); }
  };

  const handleArmToggle = () => {
    if (armed) {
      api.disarm();
      toast.info('FXK32Q DISARMED');
    } else {
      const r = api.arm();
      if (r.ok === false) toast.error(`ARM rejeitado: ${r.message}`);
      else toast.success('FXK32Q ARMED · Hold-1s pra disparar');
    }
  };

  const handleEStop = async () => {
    clearHold();
    const r = await api.eStop();
    if (r.ok === false) toast.error(`E-STOP falhou: ${r.message}`);
    else toast.success('E-STOP enviado');
  };

  const startHold = () => {
    if (!armed || channels.length === 0 || busy) return;
    holdStart.current = performance.now();
    setHolding(true);
    setHoldProgress(0);
    const tick = () => {
      const p = Math.min(1, (performance.now() - holdStart.current) / HOLD_MS);
      setHoldProgress(p);
      if (p < 1) holdRaf.current = window.requestAnimationFrame(tick);
    };
    holdRaf.current = window.requestAnimationFrame(tick);
    holdTimer.current = window.setTimeout(async () => {
      clearHold();
      setBusy(true);
      try {
        const r = await api.fireBatch(channels, pulseMs);
        if (r.ok === false) toast.error(`BATCH rejeitado [${r.code}]: ${r.message}`);
        else toast.success(`BATCH 0x${r.value.mask.toString(16).padStart(8, '0')} → ${pulseMs}ms`);
      } finally {
        setBusy(false);
      }
    }, HOLD_MS);
  };

  const linkBadge = !br.status.connected
    ? { label: 'DISCONNECTED', cls: 'bg-muted/30 text-muted-foreground border-border/40' }
    : br.status.linkHealth === 'healthy'
      ? { label: 'HEALTHY',     cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40' }
      : { label: 'DEGRADED',    cls: 'bg-amber-500/15 text-amber-400 border-amber-500/40' };

  return (
    <div className="rounded-lg border border-border/40 bg-card/30 p-4 space-y-4 font-mono">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-[hsl(190_70%_58%)]" />
          <h2 className="text-xs font-bold tracking-[0.2em] uppercase text-[hsl(190_70%_58%)]">
            FXK32Q · Bench Control
          </h2>
        </div>
        <div className="flex items-center gap-2 text-[10px]">
          <Badge variant="outline" className={cn('border', linkBadge.cls)}>{linkBadge.label}</Badge>
          {br.isFXK32Q
            ? <Badge variant="outline" className="border bg-cyan-500/15 text-cyan-300 border-cyan-500/40">MODEL:FXK32Q · CH:32</Badge>
            : <Badge variant="outline" className="border bg-muted/20 text-muted-foreground">no handshake</Badge>}
          {br.status.firmwareVersion && <span className="text-muted-foreground">FW {br.status.firmwareVersion}</span>}
        </div>
      </div>

      {/* Transport selector */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {TRANSPORTS.map((t) => {
          const I = t.icon;
          const active = transport === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTransport(t.key)}
              className={cn(
                'flex items-start gap-2 rounded-md border px-3 py-2 text-left text-[11px] transition',
                active
                  ? 'border-cyan-500/60 bg-cyan-500/10 text-foreground'
                  : 'border-border/40 bg-background/40 text-muted-foreground hover:border-border/70 hover:text-foreground',
              )}
            >
              <I className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <div className="space-y-0.5">
                <div className="font-bold">{t.label}</div>
                <div className="text-[10px] text-muted-foreground/80">{t.hint}</div>
              </div>
            </button>
          );
        })}
      </div>

      {TRANSPORTS.find((t) => t.key === transport)?.needsUrl && (
        <div className="space-y-1">
          <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Endpoint</Label>
          <Input
            value={endpoint}
            onChange={(e) => setEndpoint(e.target.value)}
            placeholder={transport === 'ws' ? 'ws://192.168.4.1:81/' : 'ws://192.168.4.1:81/'}
            className="font-mono text-xs"
          />
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        {!br.isConnected ? (
          <Button onClick={handleConnect} disabled={busy} className="gap-2">
            <Power className="w-4 h-4" /> Conectar
          </Button>
        ) : (
          <Button onClick={handleDisconnect} disabled={busy} variant="outline" className="gap-2">
            <Power className="w-4 h-4" /> Desconectar
          </Button>
        )}
      </div>

      {/* Batch config */}
      <div className="grid grid-cols-1 sm:grid-cols-[1fr,140px] gap-3">
        <div className="space-y-1">
          <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Canais (1..{FXK32Q_MAX_CHANNEL}) — separados por vírgula
          </Label>
          <Input
            value={batchStr}
            onChange={(e) => setBatchStr(e.target.value)}
            placeholder="1,3,5,7"
            className="font-mono text-xs"
          />
          <div className="text-[10px] text-muted-foreground">
            Resolvidos: <span className="text-foreground">{channels.length === 0 ? '—' : channels.join(', ')}</span>
            {channels.length > 0 && (
              <span className="ml-2 text-cyan-400/80">
                mask 0x{(channels.reduce((m, c) => m | (1 << (c - 1)), 0) >>> 0).toString(16).padStart(8, '0')}
              </span>
            )}
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Pulso (ms)</Label>
          <Input
            type="number"
            min={1}
            max={5000}
            value={pulseMs}
            onChange={(e) => setPulseMs(Math.max(1, Math.min(5000, parseInt(e.target.value, 10) || 0)))}
            className="font-mono text-xs"
          />
        </div>
      </div>

      {/* ARM + FIRE */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <Button
          onClick={handleArmToggle}
          disabled={!br.isConnected || busy}
          variant={armed ? 'default' : 'outline'}
          className={cn('gap-2', armed && 'bg-amber-500 text-black hover:bg-amber-400')}
        >
          <ShieldCheck className="w-4 h-4" />
          {armed ? 'DISARM' : 'ARM (client-side)'}
        </Button>

        <button
          type="button"
          disabled={!armed || channels.length === 0 || busy}
          onPointerDown={startHold}
          onPointerUp={clearHold}
          onPointerLeave={clearHold}
          onPointerCancel={clearHold}
          className={cn(
            'relative overflow-hidden rounded-md border px-3 py-2 text-xs font-bold uppercase tracking-[0.18em] transition',
            armed && channels.length > 0 && !busy
              ? 'border-red-500/60 bg-red-500/10 text-red-300 hover:bg-red-500/20'
              : 'border-border/40 bg-muted/10 text-muted-foreground cursor-not-allowed',
          )}
        >
          <span className="relative z-10">
            {holding ? `Mantenha… ${(holdProgress * 100).toFixed(0)}%` : `Hold 1s · FIRE BATCH (${channels.length})`}
          </span>
          {holding && (
            <span
              className="absolute inset-y-0 left-0 bg-red-500/30 transition-[width] duration-75 ease-linear"
              style={{ width: `${holdProgress * 100}%` }}
            />
          )}
        </button>

        <Button onClick={handleEStop} variant="destructive" className="gap-2" disabled={!br.status.connected}>
          <Square className="w-4 h-4 fill-current" /> E-STOP
        </Button>
      </div>

      {/* Footer disclaimer */}
      <div className="flex items-start gap-2 text-[10px] text-muted-foreground/80 leading-relaxed">
        <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0 text-amber-400" />
        <span>
          Bench-only. ARM aqui é client-side; o gate físico (RS-485/XLII+) não é alterado.
          Em <span className="text-foreground">real_operation</span> use o Field Ops (uiCommandGateway).
          E-STOP sempre alvo &lt; 50&nbsp;ms.
        </span>
      </div>
    </div>
  );
}
