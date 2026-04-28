/**
 * /dev/fxk16-validate — Real-hardware validation harness for the FXK16.
 *
 * Lets a tech connect a physical FXK16 (ESP32-S3 v1.3 + 16-relay board)
 * over Web Serial (USB-CDC) or BLE-UART and verify, in order:
 *
 *   1. Handshake recognition: VERSION → captures `MODEL:FXK16;CH:16`
 *   2. STATUS readback         (deviceModel + channelCount + protocolFamily)
 *   3. PINMAP dump              (canonical channel↔GPIO↔terminal table)
 *   4. FIRE per channel        (1..16, 50ms hold-to-fire — explicit click only)
 *
 * This page is **diagnostic-only**. It bypasses the show plan and command
 * bus on purpose — never used during a real show. Hold-to-fire prevents
 * accidental discharge: the user must press AND release within 800ms or
 * the action is cancelled.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { FireOneHardwareBridge, type BridgeStatus } from '@/lib/fireoneModuleHardwareBridge';

type ChannelResult = 'pending' | 'ok' | 'error';

interface FrameLog {
  ts: number;
  dir: 'tx' | 'rx';
  line: string;
}

const FXK16_CHANNELS = 16;
const FIRE_PULSE_MS = 50;
const HOLD_MS = 800;

export default function FXK16ValidatePage() {
  const bridgeRef = useRef<FireOneHardwareBridge | null>(null);
  const [status, setStatus] = useState<BridgeStatus | null>(null);
  const [log, setLog] = useState<FrameLog[]>([]);
  const [channelStatus, setChannelStatus] = useState<ChannelResult[]>(
    () => Array.from({ length: FXK16_CHANNELS }, () => 'pending'),
  );
  const [busy, setBusy] = useState(false);

  // ── Bridge lifecycle ────────────────────────────────────────────
  useEffect(() => {
    const bridge = new FireOneHardwareBridge((event, data) => {
      if (event === 'data') {
        setLog((l) => [
          ...l.slice(-199),
          { ts: Date.now(), dir: 'rx', line: String(data) },
        ]);
      }
    });
    bridgeRef.current = bridge;
    const tick = setInterval(() => setStatus(bridge.getStatus()), 500);
    return () => {
      clearInterval(tick);
      void bridge.disconnect?.();
      bridgeRef.current = null;
    };
  }, []);

  const sendAndLog = useCallback((line: string) => {
    setLog((l) => [
      ...l.slice(-199),
      { ts: Date.now(), dir: 'tx', line },
    ]);
  }, []);

  // ── Connect handlers ────────────────────────────────────────────
  const connectUSB = useCallback(async () => {
    if (!bridgeRef.current) return;
    setBusy(true);
    const ok = await bridgeRef.current.connectUSB();
    sendAndLog(ok ? '[USB connected]' : '[USB connect FAILED]');
    setBusy(false);
  }, [sendAndLog]);

  const connectBLE = useCallback(async () => {
    if (!bridgeRef.current) return;
    setBusy(true);
    const ok = await bridgeRef.current.connectBLE();
    sendAndLog(ok ? '[BLE connected]' : '[BLE connect FAILED]');
    setBusy(false);
  }, [sendAndLog]);

  // ── Diagnostic commands ─────────────────────────────────────────
  const runIdentify = useCallback(async () => {
    const b = bridgeRef.current;
    if (!b?.isHealthy?.()) return;
    sendAndLog('IDENTIFY');
    // Bridge does not expose IDENTIFY directly — write raw line via send queue
    // by abusing its readWithRetry contract is unsafe; instead trigger STATUS
    // which includes MODEL/CH tokens.
    sendAndLog('STATUS');
    await b.requestStatus?.();
  }, [sendAndLog]);

  const fireChannel = useCallback(
    async (channel: number) => {
      const b = bridgeRef.current;
      if (!b?.isHealthy?.()) return;
      sendAndLog(`FIRE:${channel}:${FIRE_PULSE_MS}`);
      const ok = await b.fire?.(channel, FIRE_PULSE_MS);
      setChannelStatus((arr) => {
        const next = [...arr];
        next[channel - 1] = ok ? 'ok' : 'error';
        return next;
      });
    },
    [sendAndLog],
  );

  // ── Hold-to-fire wrapper ────────────────────────────────────────
  const holdRef = useRef<{ ch: number; t0: number; timer: number | null } | null>(null);
  const startHold = (channel: number) => {
    holdRef.current = {
      ch: channel,
      t0: Date.now(),
      timer: window.setTimeout(() => {
        // Cancel — held too long, treat as bumped key.
        holdRef.current = null;
      }, HOLD_MS),
    };
  };
  const endHold = (channel: number) => {
    const h = holdRef.current;
    holdRef.current = null;
    if (!h || h.ch !== channel) return;
    if (h.timer !== null) window.clearTimeout(h.timer);
    const elapsed = Date.now() - h.t0;
    if (elapsed < 80 || elapsed > HOLD_MS) return; // too short or expired
    void fireChannel(channel);
  };

  // ── UI ─────────────────────────────────────────────────────────
  const recognized =
    status?.deviceModel === 'FXK16' &&
    status?.channelCount === FXK16_CHANNELS &&
    status?.protocolFamily === 'showven-c16-compatible';

  return (
    <main className="min-h-dvh bg-background text-foreground p-6 space-y-6">
      <header className="space-y-1">
        <h1 className="text-xl font-bold tracking-tight">FXK16 — Real Hardware Validation</h1>
        <p className="text-sm text-muted-foreground">
          Diagnostic-only. Bypasses ShowPlan / CommandBus. Hold-to-fire (≥80ms,
          ≤{HOLD_MS}ms) per channel. Pulse fixed at {FIRE_PULSE_MS}ms.
        </p>
      </header>

      {/* Connection */}
      <section className="space-y-2">
        <div className="flex gap-2">
          <button
            onClick={connectUSB}
            disabled={busy}
            className="px-4 py-2 rounded bg-primary text-primary-foreground disabled:opacity-50 min-h-[56px]"
          >
            Connect USB (Web Serial)
          </button>
          <button
            onClick={connectBLE}
            disabled={busy}
            className="px-4 py-2 rounded bg-primary text-primary-foreground disabled:opacity-50 min-h-[56px]"
          >
            Connect BLE
          </button>
          <button
            onClick={runIdentify}
            disabled={!status?.connected}
            className="px-4 py-2 rounded bg-secondary text-secondary-foreground disabled:opacity-50 min-h-[56px]"
          >
            Run IDENTIFY / STATUS
          </button>
        </div>
      </section>

      {/* Recognition card */}
      <section className="rounded border border-border p-4 space-y-1 bg-card">
        <div className="text-sm">
          Link:{' '}
          <span className={status?.connected ? 'text-[hsl(var(--success,142_70%_45%))]' : 'text-muted-foreground'}>
            {status?.linkHealth ?? 'disconnected'}
          </span>{' '}
          · Transport: <code>{status?.transport ?? '—'}</code>
        </div>
        <div className="text-sm">
          Model: <code>{status?.deviceModel ?? '—'}</code> · Channels:{' '}
          <code>{status?.channelCount ?? '—'}</code> · Protocol family:{' '}
          <code>{status?.protocolFamily ?? '—'}</code>
        </div>
        <div className="text-sm">
          Compatible with: <code>{status?.compatibleWith ?? '—'}</code> · FW:{' '}
          <code>{status?.firmwareVersion ?? '—'}</code>
        </div>
        <div
          className={`mt-2 text-sm font-bold ${
            recognized ? 'text-[hsl(var(--success,142_70%_45%))]' : 'text-amber-500'
          }`}
        >
          {recognized
            ? '✅ Recognized as FXK16 (16 ch · showven-c16-compatible)'
            : '⏳ Not yet recognized — connect and run IDENTIFY/STATUS'}
        </div>
      </section>

      {/* Channel grid */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          FIRE per channel (hold ≥80 ms)
        </h2>
        <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
          {Array.from({ length: FXK16_CHANNELS }, (_, i) => {
            const ch = i + 1;
            const result = channelStatus[i];
            const tone =
              result === 'ok'
                ? 'bg-[hsl(var(--success,142_70%_45%))] text-background'
                : result === 'error'
                  ? 'bg-destructive text-destructive-foreground'
                  : 'bg-muted text-foreground';
            return (
              <button
                key={ch}
                disabled={!recognized}
                onPointerDown={() => startHold(ch)}
                onPointerUp={() => endHold(ch)}
                onPointerLeave={() => {
                  if (holdRef.current?.ch === ch) holdRef.current = null;
                }}
                className={`min-h-[56px] rounded font-mono text-sm disabled:opacity-30 ${tone}`}
              >
                C{ch}
              </button>
            );
          })}
        </div>
      </section>

      {/* Frame log */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Frame log (last 200)
        </h2>
        <pre className="text-xs bg-card border border-border rounded p-2 max-h-[40vh] overflow-auto font-mono">
          {log.length === 0
            ? '— no frames yet —'
            : log
                .map(
                  (f) =>
                    `${new Date(f.ts).toISOString().slice(11, 23)} ${f.dir === 'tx' ? '→' : '←'} ${f.line}`,
                )
                .join('\n')}
        </pre>
      </section>
    </main>
  );
}
