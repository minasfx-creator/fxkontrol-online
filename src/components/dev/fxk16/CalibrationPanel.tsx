/**
 * /dev/fxk16-calibrate — Calibration & diagnostics console for the FXK16.
 *
 * Diagnostic-only page (bypasses ShowPlan / CommandBus). Three goals:
 *
 *   1. **Handshake status** — large traffic-light card showing link state,
 *      transport, firmware model/version, latency and protocol family.
 *   2. **Detected channel count** — pulled from STATUS (`CH:N`); compared
 *      to the expected 16, with explicit OK/MISMATCH banner.
 *   3. **Per-channel relay test (C1..C16)** — manual hold-to-fire OR
 *      automatic sweep with adjustable inter-channel gap and pulse width.
 *      Each channel tracks pending → firing → ok / error, with a summary.
 *
 * Hold-to-fire (≥80 ms, ≤800 ms) is preserved. Auto-sweep requires an
 * extra "Arm sweep" toggle — it never fires without an explicit arm.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FireOneHardwareBridge, type BridgeStatus } from '@/lib/fireoneModuleHardwareBridge';

type ChannelResult = 'pending' | 'firing' | 'ok' | 'error';

interface FrameLog {
  ts: number;
  dir: 'tx' | 'rx';
  line: string;
}

const EXPECTED_CHANNELS = 16;
const DEFAULT_PULSE_MS = 50;
const DEFAULT_GAP_MS = 250;
const HOLD_MIN_MS = 80;
const HOLD_MAX_MS = 800;

export default function FXK16CalibrationPage() {
  const bridgeRef = useRef<FireOneHardwareBridge | null>(null);
  const [status, setStatus] = useState<BridgeStatus | null>(null);
  const [log, setLog] = useState<FrameLog[]>([]);
  const [channelStatus, setChannelStatus] = useState<ChannelResult[]>(() =>
    Array.from({ length: EXPECTED_CHANNELS }, () => 'pending'),
  );
  const [busy, setBusy] = useState(false);

  // Sweep config
  const [pulseMs, setPulseMs] = useState(DEFAULT_PULSE_MS);
  const [gapMs, setGapMs] = useState(DEFAULT_GAP_MS);
  const [armed, setArmed] = useState(false);
  const [sweeping, setSweeping] = useState(false);
  const sweepAbortRef = useRef(false);

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
      sweepAbortRef.current = true;
      clearInterval(tick);
      void bridge.disconnect();
      bridgeRef.current = null;
    };
  }, []);

  const pushTx = useCallback((line: string) => {
    setLog((l) => [...l.slice(-199), { ts: Date.now(), dir: 'tx', line }]);
  }, []);

  // ── Connect ─────────────────────────────────────────────────────
  const connectUSB = useCallback(async () => {
    if (!bridgeRef.current) return;
    setBusy(true);
    const ok = await bridgeRef.current.connectUSB();
    pushTx(ok ? '[USB connected]' : '[USB connect FAILED]');
    setBusy(false);
  }, [pushTx]);

  const connectBLE = useCallback(async () => {
    if (!bridgeRef.current) return;
    setBusy(true);
    const ok = await bridgeRef.current.connectBLE();
    pushTx(ok ? '[BLE connected]' : '[BLE connect FAILED]');
    setBusy(false);
  }, [pushTx]);

  const refreshStatus = useCallback(async () => {
    const b = bridgeRef.current;
    if (!b?.isHealthy?.()) return;
    pushTx('STATUS');
    await b.requestStatus();
  }, [pushTx]);

  const resetResults = useCallback(() => {
    setChannelStatus(Array.from({ length: EXPECTED_CHANNELS }, () => 'pending'));
  }, []);

  // ── FIRE one channel ────────────────────────────────────────────
  const fireChannel = useCallback(
    async (channel: number) => {
      const b = bridgeRef.current;
      if (!b?.isHealthy?.()) return false;
      setChannelStatus((arr) => {
        const next = [...arr];
        next[channel - 1] = 'firing';
        return next;
      });
      pushTx(`FIRE:${channel}:${pulseMs}`);
      const ok = await b.fire(channel, pulseMs);
      setChannelStatus((arr) => {
        const next = [...arr];
        next[channel - 1] = ok ? 'ok' : 'error';
        return next;
      });
      return ok;
    },
    [pulseMs, pushTx],
  );

  // ── Hold-to-fire (manual) ───────────────────────────────────────
  const holdRef = useRef<{ ch: number; t0: number; timer: number | null } | null>(null);
  const startHold = (channel: number) => {
    holdRef.current = {
      ch: channel,
      t0: Date.now(),
      timer: window.setTimeout(() => {
        holdRef.current = null;
      }, HOLD_MAX_MS),
    };
  };
  const endHold = (channel: number) => {
    const h = holdRef.current;
    holdRef.current = null;
    if (!h || h.ch !== channel) return;
    if (h.timer !== null) window.clearTimeout(h.timer);
    const elapsed = Date.now() - h.t0;
    if (elapsed < HOLD_MIN_MS || elapsed > HOLD_MAX_MS) return;
    void fireChannel(channel);
  };

  // ── Auto sweep ──────────────────────────────────────────────────
  const startSweep = useCallback(async () => {
    if (!armed || sweeping) return;
    const b = bridgeRef.current;
    if (!b?.isHealthy?.()) return;
    sweepAbortRef.current = false;
    setSweeping(true);
    resetResults();
    for (let ch = 1; ch <= EXPECTED_CHANNELS; ch++) {
      if (sweepAbortRef.current) break;
      await fireChannel(ch);
      if (ch < EXPECTED_CHANNELS) {
        await new Promise((r) => setTimeout(r, gapMs));
      }
    }
    setSweeping(false);
    setArmed(false);
  }, [armed, sweeping, gapMs, fireChannel, resetResults]);

  const abortSweep = useCallback(() => {
    sweepAbortRef.current = true;
  }, []);

  // ── Derived ─────────────────────────────────────────────────────
  const detectedChannels = status?.channelCount ?? null;
  const handshakeOk = status?.linkHealth === 'healthy' && !!status?.deviceModel;
  const recognized =
    handshakeOk &&
    status?.deviceModel === 'FXK16' &&
    detectedChannels === EXPECTED_CHANNELS &&
    status?.protocolFamily === 'showven-c16-compatible';

  const summary = useMemo(() => {
    const ok = channelStatus.filter((c) => c === 'ok').length;
    const err = channelStatus.filter((c) => c === 'error').length;
    const pending = channelStatus.filter((c) => c === 'pending').length;
    return { ok, err, pending };
  }, [channelStatus]);

  const hsTone = handshakeOk
    ? 'border-[hsl(var(--success,142_70%_45%))]'
    : status?.linkHealth === 'handshaking'
      ? 'border-amber-500'
      : 'border-destructive';

  // ── UI ─────────────────────────────────────────────────────────
  return (
    <main className="min-h-dvh bg-background text-foreground p-6 space-y-6">
      <header className="space-y-1">
        <h1 className="text-xl font-bold tracking-tight">
          FXK16 — Calibration & Diagnostics
        </h1>
        <p className="text-sm text-muted-foreground">
          Diagnostic-only. Bypasses ShowPlan / CommandBus. Test individual
          relays C1..C16, monitor handshake, verify detected channel count.
        </p>
      </header>

      {/* Connection bar */}
      <section className="flex flex-wrap gap-2">
        <button
          onClick={connectUSB}
          disabled={busy}
          className="px-4 py-2 rounded bg-primary text-primary-foreground disabled:opacity-50 min-h-[56px]"
        >
          Connect USB
        </button>
        <button
          onClick={connectBLE}
          disabled={busy}
          className="px-4 py-2 rounded bg-primary text-primary-foreground disabled:opacity-50 min-h-[56px]"
        >
          Connect BLE
        </button>
        <button
          onClick={refreshStatus}
          disabled={!status?.connected}
          className="px-4 py-2 rounded bg-secondary text-secondary-foreground disabled:opacity-50 min-h-[56px]"
        >
          Refresh STATUS
        </button>
        <button
          onClick={resetResults}
          className="px-4 py-2 rounded bg-muted text-foreground min-h-[56px]"
        >
          Reset results
        </button>
      </section>

      {/* Handshake card */}
      <section className={`rounded border-2 ${hsTone} p-4 space-y-2 bg-card`}>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Handshake
          </h2>
          <span
            className={`text-xs font-mono px-2 py-1 rounded ${
              handshakeOk
                ? 'bg-[hsl(var(--success,142_70%_45%))] text-background'
                : status?.linkHealth === 'handshaking'
                  ? 'bg-amber-500 text-background'
                  : 'bg-destructive text-destructive-foreground'
            }`}
          >
            {status?.linkHealth?.toUpperCase() ?? 'DISCONNECTED'}
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
          <div>
            <div className="text-xs text-muted-foreground">Transport</div>
            <code>{status?.transport ?? '—'}</code>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Model</div>
            <code>{status?.deviceModel ?? '—'}</code>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Firmware</div>
            <code>{status?.firmwareVersion ?? '—'}</code>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Protocol</div>
            <code>{status?.protocolFamily ?? '—'}</code>
          </div>
        </div>
      </section>

      {/* Channel detection card */}
      <section className="rounded border border-border p-4 space-y-1 bg-card">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Detected channels
        </h2>
        <div className="flex items-baseline gap-3">
          <span className="text-3xl font-mono font-bold">
            {detectedChannels ?? '—'}
          </span>
          <span className="text-sm text-muted-foreground">
            / {EXPECTED_CHANNELS} expected
          </span>
        </div>
        <div
          className={`text-sm font-bold ${
            recognized
              ? 'text-[hsl(var(--success,142_70%_45%))]'
              : detectedChannels && detectedChannels !== EXPECTED_CHANNELS
                ? 'text-destructive'
                : 'text-amber-500'
          }`}
        >
          {recognized
            ? '✅ Recognized as FXK16 (16 ch · showven-c16-compatible)'
            : detectedChannels && detectedChannels !== EXPECTED_CHANNELS
              ? `⚠️ MISMATCH — firmware reports ${detectedChannels}, expected ${EXPECTED_CHANNELS}`
              : '⏳ Awaiting STATUS — connect and click Refresh STATUS'}
        </div>
      </section>

      {/* Sweep config */}
      <section className="rounded border border-border p-4 space-y-3 bg-card">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Auto sweep (C1 → C16)
        </h2>
        <div className="flex flex-wrap gap-4 items-end">
          <label className="text-sm space-y-1">
            <div className="text-xs text-muted-foreground">Pulse (ms)</div>
            <input
              type="number"
              min={20}
              max={500}
              value={pulseMs}
              onChange={(e) => setPulseMs(Math.max(20, Math.min(500, Number(e.target.value) || DEFAULT_PULSE_MS)))}
              className="w-24 px-2 py-1 rounded bg-background border border-border font-mono"
            />
          </label>
          <label className="text-sm space-y-1">
            <div className="text-xs text-muted-foreground">Gap (ms)</div>
            <input
              type="number"
              min={50}
              max={5000}
              value={gapMs}
              onChange={(e) => setGapMs(Math.max(50, Math.min(5000, Number(e.target.value) || DEFAULT_GAP_MS)))}
              className="w-24 px-2 py-1 rounded bg-background border border-border font-mono"
            />
          </label>
          <label className="text-sm flex items-center gap-2 select-none">
            <input
              type="checkbox"
              checked={armed}
              onChange={(e) => setArmed(e.target.checked)}
              disabled={sweeping || !recognized}
            />
            <span>Arm sweep</span>
          </label>
          <button
            onClick={startSweep}
            disabled={!armed || sweeping || !recognized}
            className="px-4 py-2 rounded bg-destructive text-destructive-foreground disabled:opacity-30 min-h-[56px] font-bold"
          >
            ▶ Start sweep
          </button>
          {sweeping && (
            <button
              onClick={abortSweep}
              className="px-4 py-2 rounded bg-muted text-foreground min-h-[56px]"
            >
              Abort
            </button>
          )}
        </div>
        <div className="text-xs text-muted-foreground">
          Summary: <span className="text-[hsl(var(--success,142_70%_45%))]">{summary.ok} OK</span>{' '}
          · <span className="text-destructive">{summary.err} ERR</span>{' '}
          · {summary.pending} pending
        </div>
      </section>

      {/* Channel grid */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Manual FIRE per channel (hold ≥{HOLD_MIN_MS} ms, ≤{HOLD_MAX_MS} ms)
        </h2>
        <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
          {Array.from({ length: EXPECTED_CHANNELS }, (_, i) => {
            const ch = i + 1;
            const result = channelStatus[i];
            const tone =
              result === 'ok'
                ? 'bg-[hsl(var(--success,142_70%_45%))] text-background'
                : result === 'error'
                  ? 'bg-destructive text-destructive-foreground'
                  : result === 'firing'
                    ? 'bg-amber-500 text-background animate-pulse'
                    : 'bg-muted text-foreground';
            return (
              <button
                key={ch}
                disabled={!recognized || sweeping}
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
