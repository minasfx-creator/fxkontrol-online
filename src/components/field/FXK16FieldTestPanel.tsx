/**
 * FXK16FieldTestPanel — End-to-end command harness for the FXK16 module
 * inside FieldTest. Exercises the full path:
 *
 *   UI → useFXK16Commands (typed API) → FireOneHardwareBridge (singleton)
 *      → Web Serial / BLE transport → ESP32-S3 → relay channel → ACK
 *
 * Each step writes to a local audit log so the operator can validate
 * latency, error codes, and link state without leaving FieldTest. Reuses
 * the same singleton as PyroFireOnePanel and the /field#fxk16 tab — a
 * single connection serves all three surfaces.
 *
 * Safety:
 *   - Single FIRE uses Hold-to-Confirm (800 ms).
 *   - Batch FIRE requires explicit ARM and a second confirm tap.
 *   - E-STOP bypasses ARM and auto-disarms.
 *   - Auto-disarms on link loss (handled by the typed API).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Cable, Bluetooth, Usb, Shield, ShieldOff, Flame,
  Square, AlertOctagon, CheckCircle2, XCircle, Loader2,
  Activity, ChevronDown, ChevronUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useFXK16Bridge, FXK16_MAX_CHANNEL } from '@/hooks/useFXK16Bridge';
import { useFXK16Commands } from '@/hooks/useFXK16Commands';
import type { CommandResponse } from '@/lib/fxk16/commandApi';
import { haptics } from '@/lib/haptics';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface E2eStep {
  id: string;
  ts: number;
  op: string;
  status: 'ok' | 'error' | 'pending';
  detail: string;
  latencyMs?: number;
  code?: string;
}

const HOLD_MS = 800;
const MAX_LOG = 80;

export default function FXK16FieldTestPanel() {
  const bridge = useFXK16Bridge();
  const { api, ready, armed } = useFXK16Commands();
  const [open, setOpen] = useState(true);
  const [channel, setChannel] = useState<number>(1);
  const [durationMs, setDurationMs] = useState<number>(50);
  const [batchInput, setBatchInput] = useState<string>('1,3,5,7');
  const [steps, setSteps] = useState<E2eStep[]>([]);
  const [holding, setHolding] = useState<null | 'fire' | 'batch'>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdProgress = useRef<HTMLDivElement | null>(null);

  // Cleanup any hold timer on unmount.
  useEffect(() => () => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
  }, []);

  const log = useCallback((entry: Omit<E2eStep, 'id' | 'ts'>) => {
    setSteps((prev) => {
      const next: E2eStep = { ...entry, id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, ts: Date.now() };
      const updated = [next, ...prev];
      return updated.length > MAX_LOG ? updated.slice(0, MAX_LOG) : updated;
    });
  }, []);

  const settle = useCallback(function settleFn<T>(label: string, t0: number, res: CommandResponse<T>): CommandResponse<T> {
    const latencyMs = Math.round(performance.now() - t0);
    if (res.ok === true) {
      log({ op: label, status: 'ok', detail: 'success', latencyMs });
    } else {
      const errRes = res as Extract<CommandResponse<T>, { ok: false }>;
      log({ op: label, status: 'error', detail: errRes.message, code: errRes.code, latencyMs });
    }
    return res;
  }, [log]);

  // ── Connect ───────────────────────────────────────────────
  const connectUSB = useCallback(async () => {
    log({ op: 'CONNECT_USB', status: 'pending', detail: 'requesting Web Serial port…' });
    try {
      const ok = await bridge.connectUSB();
      log({ op: 'CONNECT_USB', status: ok ? 'ok' : 'error', detail: ok ? 'handshake OK' : 'handshake failed' });
      if (ok) haptics.success();
    } catch (e: any) {
      log({ op: 'CONNECT_USB', status: 'error', detail: e?.message ?? 'unknown error' });
    }
  }, [bridge, log]);

  const connectBLE = useCallback(async () => {
    log({ op: 'CONNECT_BLE', status: 'pending', detail: 'requesting BLE device…' });
    try {
      const ok = await bridge.connectBLE();
      log({ op: 'CONNECT_BLE', status: ok ? 'ok' : 'error', detail: ok ? 'handshake OK' : 'handshake failed' });
      if (ok) haptics.success();
    } catch (e: any) {
      log({ op: 'CONNECT_BLE', status: 'error', detail: e?.message ?? 'unknown error' });
    }
  }, [bridge, log]);

  const disconnect = useCallback(async () => {
    await bridge.disconnect();
    log({ op: 'DISCONNECT', status: 'ok', detail: 'link closed' });
  }, [bridge, log]);

  // ── ARM / DISARM ──────────────────────────────────────────
  const onArm = useCallback(() => {
    const t0 = performance.now();
    const res = armed ? api.disarm() : api.arm();
    settle(armed ? 'DISARM' : 'ARM', t0, res);
    if (res.ok) (armed ? haptics.disarm : haptics.arm)?.();
  }, [api, armed, settle]);

  // ── Single FIRE (Hold-to-Confirm) ─────────────────────────
  const startHoldFire = useCallback(() => {
    if (!ready) { toast.error('FXK16 não está pronto'); return; }
    if (!armed) { toast.error('Arme antes de disparar'); return; }
    if (channel < 1 || channel > FXK16_MAX_CHANNEL) {
      toast.error(`Canal fora do range 1..${FXK16_MAX_CHANNEL}`);
      return;
    }
    setHolding('fire');
    haptics.tap?.();
    holdTimer.current = setTimeout(async () => {
      setHolding(null);
      const t0 = performance.now();
      log({ op: `FIRE ch=${channel} ${durationMs}ms`, status: 'pending', detail: 'dispatching…' });
      const res = await api.fire(channel, durationMs);
      settle(`FIRE ch=${channel}`, t0, res);
      if (res.ok) haptics.fire?.();
    }, HOLD_MS);
  }, [api, armed, channel, durationMs, log, ready, settle]);

  const cancelHoldFire = useCallback(() => {
    if (holdTimer.current) { clearTimeout(holdTimer.current); holdTimer.current = null; }
    if (holding) setHolding(null);
  }, [holding]);

  // ── Batch FIRE ────────────────────────────────────────────
  const fireBatch = useCallback(async () => {
    if (!ready || !armed) { toast.error('Pronto + Armado é obrigatório'); return; }
    const channels = batchInput
      .split(/[,\s]+/)
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => Number.isInteger(n) && n >= 1 && n <= FXK16_MAX_CHANNEL);
    if (channels.length === 0) { toast.error('Lista de canais vazia/ inválida'); return; }
    const t0 = performance.now();
    log({ op: `BATCH [${channels.join(',')}] ${durationMs}ms`, status: 'pending', detail: 'dispatching…' });
    const res = await api.fireBatch(channels, durationMs);
    settle(`BATCH n=${channels.length}`, t0, res);
    if (res.ok) haptics.fire?.();
  }, [api, armed, batchInput, durationMs, log, ready, settle]);

  // ── E-STOP ────────────────────────────────────────────────
  const eStop = useCallback(async () => {
    const t0 = performance.now();
    log({ op: 'E-STOP', status: 'pending', detail: 'broadcast…' });
    const res = await api.stop();
    settle('E-STOP', t0, res);
    haptics.panic?.();
  }, [api, log, settle]);

  // ── Sequential round-trip self-test ───────────────────────
  const runSelfTest = useCallback(async () => {
    if (!ready) { toast.error('Conecte primeiro'); return; }
    log({ op: 'SELFTEST', status: 'pending', detail: 'arming → fire ch1 5ms → disarm' });
    const armRes = api.arm(); settle('SELFTEST/arm', performance.now(), armRes);
    if (!armRes.ok) return;
    const t0 = performance.now();
    const fireRes = await api.fire(1, 5);
    settle('SELFTEST/fire ch1', t0, fireRes);
    const disRes = api.disarm(); settle('SELFTEST/disarm', performance.now(), disRes);
    if (fireRes.ok) toast.success(`Self-test OK (${Math.round(performance.now() - t0)}ms)`);
    else toast.error(`Self-test falhou: ${(fireRes as any).message}`);
  }, [api, log, ready, settle]);

  // ── Render ────────────────────────────────────────────────
  const transport = bridge.status.transport ?? 'none';
  const linkHealth = bridge.status.linkHealth ?? 'unknown';

  return (
    <div className="rounded-lg border border-border/40 bg-card/30 backdrop-blur-sm">
      {/* Header */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-card/50 transition-colors"
      >
        <Cable className="w-3.5 h-3.5 text-[hsl(32_100%_65%)]" />
        <span className="text-[10px] font-mono font-bold tracking-[0.18em] uppercase text-foreground/85">
          FXK16 · E2E TEST
        </span>
        <Badge
          variant="outline"
          className={cn(
            'text-[8px] h-4 px-1.5 font-mono ml-1',
            ready ? 'border-green-500/40 text-green-400' : 'border-red-500/40 text-red-400/70',
          )}
        >
          {ready ? 'READY' : 'OFFLINE'}
        </Badge>
        {bridge.isConnected && (
          <Badge variant="outline" className="text-[8px] h-4 px-1.5 font-mono border-blue-500/40 text-blue-400">
            {transport.toUpperCase()} · {linkHealth}
          </Badge>
        )}
        {armed && (
          <Badge variant="outline" className="text-[8px] h-4 px-1.5 font-mono border-amber-500/50 text-amber-300 animate-pulse">
            ARMED
          </Badge>
        )}
        <span className="ml-auto">
          {open ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground/60" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground/60" />}
        </span>
      </button>

      {open && (
        <div className="border-t border-border/30 p-3 space-y-3">
          {/* Connect row */}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={connectUSB} disabled={bridge.isConnected} className="h-7 text-[10px] gap-1.5">
              <Usb className="w-3 h-3" /> USB
            </Button>
            <Button size="sm" variant="outline" onClick={connectBLE} disabled={bridge.isConnected} className="h-7 text-[10px] gap-1.5">
              <Bluetooth className="w-3 h-3" /> BLE
            </Button>
            <Button size="sm" variant="ghost" onClick={disconnect} disabled={!bridge.isConnected} className="h-7 text-[10px]">
              Disconnect
            </Button>
            <Button size="sm" variant="outline" onClick={runSelfTest} disabled={!ready} className="h-7 text-[10px] gap-1.5 ml-auto">
              <Activity className="w-3 h-3" /> Self-test
            </Button>
          </div>

          {/* ARM / E-STOP */}
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={onArm}
              disabled={!ready}
              className={cn(
                'flex-1 h-9 text-[11px] font-mono font-bold gap-1.5',
                armed
                  ? 'bg-amber-600 hover:bg-amber-500 text-black'
                  : 'bg-green-600 hover:bg-green-500 text-black',
              )}
            >
              {armed ? <ShieldOff className="w-3.5 h-3.5" /> : <Shield className="w-3.5 h-3.5" />}
              {armed ? 'DISARM' : 'ARM'}
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={eStop}
              className="h-9 px-4 text-[11px] font-mono font-bold gap-1.5"
            >
              <AlertOctagon className="w-3.5 h-3.5" /> E-STOP
            </Button>
          </div>

          {/* FIRE inputs */}
          <div className="grid grid-cols-3 gap-2">
            <label className="text-[9px] font-mono text-muted-foreground/70 col-span-1 flex flex-col gap-1">
              CHANNEL
              <Input
                type="number"
                min={1}
                max={FXK16_MAX_CHANNEL}
                value={channel}
                onChange={(e) => setChannel(Math.max(1, Math.min(FXK16_MAX_CHANNEL, parseInt(e.target.value || '1', 10))))}
                className="h-7 text-xs font-mono"
              />
            </label>
            <label className="text-[9px] font-mono text-muted-foreground/70 col-span-1 flex flex-col gap-1">
              DURATION (ms)
              <Input
                type="number"
                min={1}
                max={10000}
                value={durationMs}
                onChange={(e) => setDurationMs(Math.max(1, Math.min(10000, parseInt(e.target.value || '50', 10))))}
                className="h-7 text-xs font-mono"
              />
            </label>
            <label className="text-[9px] font-mono text-muted-foreground/70 col-span-1 flex flex-col gap-1">
              BATCH (1..16)
              <Input
                type="text"
                value={batchInput}
                onChange={(e) => setBatchInput(e.target.value)}
                placeholder="1,3,5"
                className="h-7 text-xs font-mono"
              />
            </label>
          </div>

          {/* Hold-to-fire + batch */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onMouseDown={startHoldFire}
              onMouseUp={cancelHoldFire}
              onMouseLeave={cancelHoldFire}
              onTouchStart={startHoldFire}
              onTouchEnd={cancelHoldFire}
              disabled={!ready || !armed}
              className={cn(
                'relative h-10 rounded-md border text-[11px] font-mono font-bold flex items-center justify-center gap-1.5 transition-all overflow-hidden',
                ready && armed
                  ? 'border-red-500/60 bg-red-950/40 text-red-300 hover:bg-red-900/40'
                  : 'border-border/40 bg-card/20 text-muted-foreground/40 cursor-not-allowed',
              )}
            >
              <Flame className="w-3.5 h-3.5" />
              {holding === 'fire' ? 'HOLD…' : `FIRE ch ${channel}`}
              {holding === 'fire' && (
                <div
                  ref={holdProgress}
                  className="absolute inset-x-0 bottom-0 h-0.5 bg-red-500"
                  style={{
                    animation: `fxk16HoldFill ${HOLD_MS}ms linear forwards`,
                  }}
                />
              )}
            </button>

            <Button
              size="sm"
              variant="outline"
              onClick={fireBatch}
              disabled={!ready || !armed}
              className="h-10 text-[11px] font-mono font-bold gap-1.5 border-orange-500/40 text-orange-300 hover:bg-orange-950/30 disabled:opacity-40"
            >
              <Square className="w-3.5 h-3.5" />
              FIRE BATCH
            </Button>
          </div>

          {/* Audit log */}
          <div className="rounded-md border border-border/30 bg-background/40 max-h-40 overflow-y-auto">
            <div className="sticky top-0 px-2 py-1 border-b border-border/30 bg-background/80 backdrop-blur flex items-center gap-2">
              <span className="text-[8px] font-mono font-bold tracking-[0.18em] uppercase text-muted-foreground/60">
                Audit · {steps.length}
              </span>
              {steps.length > 0 && (
                <button onClick={() => setSteps([])} className="ml-auto text-[8px] font-mono uppercase text-muted-foreground/40 hover:text-muted-foreground/80">
                  clear
                </button>
              )}
            </div>
            {steps.length === 0 ? (
              <div className="px-2 py-3 text-[10px] font-mono text-muted-foreground/40 text-center">
                Sem eventos. Conecte e dispare para validar o fluxo.
              </div>
            ) : (
              <ul className="divide-y divide-border/20">
                {steps.map((s) => (
                  <li key={s.id} className="px-2 py-1 flex items-center gap-2 text-[10px] font-mono">
                    {s.status === 'ok' && <CheckCircle2 className="w-3 h-3 text-green-400 shrink-0" />}
                    {s.status === 'error' && <XCircle className="w-3 h-3 text-red-400 shrink-0" />}
                    {s.status === 'pending' && <Loader2 className="w-3 h-3 text-amber-400 shrink-0 animate-spin" />}
                    <span className="text-foreground/85 truncate">{s.op}</span>
                    {s.code && <Badge variant="outline" className="text-[8px] h-3.5 px-1 border-red-500/40 text-red-300">{s.code}</Badge>}
                    <span className="text-muted-foreground/60 truncate flex-1">{s.detail}</span>
                    {s.latencyMs !== undefined && (
                      <span className="text-muted-foreground/70 shrink-0">{s.latencyMs}ms</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      <style>{`@keyframes fxk16HoldFill { from { width: 0%; } to { width: 100%; } }`}</style>
    </div>
  );
}
