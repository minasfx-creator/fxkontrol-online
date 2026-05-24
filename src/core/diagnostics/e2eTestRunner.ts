/**
 * ─── End-to-End Test Runner ─────────────────────────────────────────
 *
 * Validates the full real-firing chain in one ordered sequence:
 *
 *   1. DISCOVERY     — wait for at least one PhysicalDevice via deviceAggregator
 *   2. ROUTING       — for every armed-target module, resolve active transport
 *                      (cable / wireless / fallback) from useFireOneFleet state
 *   3. CONTINUITY    — uiCommandGateway.continuityCheck per module, expect
 *                      telemetry frame within timeout
 *   4. ARM           — uiCommandGateway.arm per module (real_operation honours
 *                      SafetyValidator / quarantine; design/sim is advisory)
 *   5. FIRE-DRY      — by default emits a FIRE intent with `dryRun:true` flag;
 *                      live firing must be explicitly enabled by operator and
 *                      gated outside this runner (Hold-to-Confirm UI).
 *   6. TELEMETRY     — wait for confirmation frame post-FIRE
 *   7. DISARM        — uiCommandGateway.disarm per module
 *
 * Pure orchestration: no direct fieldBus / pyroExecutor calls.
 * Honest hardware: when a step has no real signal in the timeout window,
 * it is recorded as TIMEOUT — never as PASS-by-default.
 *
 * Every step yields a structured `E2ETestStep` event so the UI can stream
 * the live log AND `safetyBlackBox` receives a `recordSafetyNote` per step.
 */

import { uiCommandGateway } from '@/core/command/uiCommandGateway';
import { deviceAggregator } from '@/core/discovery/DeviceAggregator';
import { recordSafetyNote } from '@/core/safety/safetyBlackBox';
import { workMode } from '@/core/safety/workMode';
import type { FireOneFleetState } from '@/features/fieldbus/useFireOneFleet';

export type E2EStepKind =
  | 'discovery'
  | 'routing'
  | 'continuity'
  | 'arm'
  | 'fire-dry'
  | 'fire-live'
  | 'telemetry'
  | 'disarm'
  | 'summary';

export type E2EStepStatus = 'running' | 'pass' | 'fail' | 'timeout' | 'skipped';

export interface E2ETestStep {
  id: string;
  kind: E2EStepKind;
  label: string;
  /** Module address, when relevant. */
  moduleAddress?: number;
  status: E2EStepStatus;
  startedAt: number;
  endedAt?: number;
  detail?: string;
  /** Free-form telemetry snapshot at completion. */
  meta?: Record<string, unknown>;
}

export interface E2ETestRunOptions {
  /** Module addresses to test. If empty, derived from current fleet.modules. */
  modules?: number[];
  /** Per-step timeout in ms. Default 2500. */
  stepTimeoutMs?: number;
  /** When false (default) FIRE step is dry-run intent only. */
  liveFire?: boolean;
  /** Source label used for SafetyAuditTrail. */
  source?: string;
}

export interface E2ETestRunResult {
  ok: boolean;
  startedAt: number;
  endedAt: number;
  steps: E2ETestStep[];
  modulesTested: number[];
  workMode: ReturnType<typeof workMode.get>;
}

const DEFAULT_TIMEOUT = 2500;

const SOURCE = 'E2ETestRunner';

function nowMs(): number { return Date.now(); }

function step(
  kind: E2EStepKind,
  label: string,
  moduleAddress?: number,
): E2ETestStep {
  return {
    id: `${kind}-${moduleAddress ?? 'all'}-${nowMs()}-${Math.random().toString(36).slice(2, 6)}`,
    kind,
    label,
    moduleAddress,
    status: 'running',
    startedAt: nowMs(),
  };
}

function close(s: E2ETestStep, status: E2EStepStatus, detail?: string, meta?: Record<string, unknown>): E2ETestStep {
  s.status = status;
  s.endedAt = nowMs();
  if (detail) s.detail = detail;
  if (meta) s.meta = meta;
  return s;
}

/**
 * Wait until predicate returns truthy, polling at `intervalMs`.
 * Resolves with the truthy value, or null on timeout.
 */
async function waitFor<T>(
  predicate: () => T | null | undefined | false,
  timeoutMs: number,
  intervalMs = 100,
): Promise<T | null> {
  const start = nowMs();
  while (nowMs() - start < timeoutMs) {
    const v = predicate();
    if (v) return v as T;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return null;
}

export interface E2ERunDeps {
  /** Snapshot of fleet state at call time. Re-read on each await via getter. */
  getFleet: () => FireOneFleetState;
  /** Optional listener — receives every step transition. */
  onStep?: (s: E2ETestStep) => void;
}

export async function runE2ETest(
  deps: E2ERunDeps,
  opts: E2ETestRunOptions = {},
): Promise<E2ETestRunResult> {
  const startedAt = nowMs();
  const steps: E2ETestStep[] = [];
  const timeoutMs = opts.stepTimeoutMs ?? DEFAULT_TIMEOUT;
  const source = opts.source ?? SOURCE;
  const liveFire = opts.liveFire === true;

  function emit(s: E2ETestStep): void {
    steps.push(s);
    try { deps.onStep?.(s); } catch { /* noop */ }
    void recordSafetyNote(`e2e-${s.kind}`, {
      status: s.status,
      moduleAddress: s.moduleAddress,
      detail: s.detail,
    });
  }

  // 1. DISCOVERY ────────────────────────────────────────────────────
  const discoveryStep = step('discovery', 'Aguardando ao menos um PhysicalDevice');
  emit(discoveryStep);
  const devices = await waitFor(
    () => {
      const list = deviceAggregator.getDevices();
      return list.length > 0 ? list : null;
    },
    timeoutMs,
  );
  if (!devices) {
    emit(close(discoveryStep, 'timeout', 'Nenhum dispositivo descoberto'));
    return finalize(steps, opts.modules ?? [], false, startedAt);
  }
  emit(close(discoveryStep, 'pass', `${devices.length} device(s) ativo(s)`, {
    devices: devices.map((d) => ({ id: d.aggregateId, family: (d as any).family ?? null })),
  }));

  // 2. ROUTING ──────────────────────────────────────────────────────
  const fleet0 = deps.getFleet();
  const knownModules = Object.keys(fleet0.modules).map(Number).filter((n) => n > 0);
  const targets = (opts.modules && opts.modules.length > 0)
    ? opts.modules
    : knownModules;

  const routingStep = step('routing', 'Resolvendo transporte por módulo');
  emit(routingStep);
  if (targets.length === 0) {
    emit(close(routingStep, 'fail', 'Nenhum módulo conhecido / informado'));
    return finalize(steps, [], false, startedAt);
  }
  const routes: Record<number, 'wired' | 'wireless' | 'fallback' | 'unknown'> = {};
  for (const addr of targets) {
    const m = fleet0.modules[addr];
    const mode = (m as any)?.connectionMode;
    if (mode === 'wired' || mode === 'wireless') routes[addr] = mode;
    else if (fleet0.cable.state === 'connected') routes[addr] = 'wired';
    else if (fleet0.radio.state === 'connected') routes[addr] = 'wireless';
    else routes[addr] = 'unknown';
  }
  const unknown = targets.filter((a) => routes[a] === 'unknown');
  emit(close(
    routingStep,
    unknown.length === 0 ? 'pass' : 'fail',
    unknown.length === 0
      ? `${targets.length} rota(s) resolvida(s)`
      : `Sem rota: ${unknown.join(', ')}`,
    { routes },
  ));
  if (unknown.length > 0) return finalize(steps, targets, false, startedAt);

  // Per-module sequence: continuity → arm → fire-dry/live → telemetry → disarm
  for (const addr of targets) {
    const before = nowMs();

    // 3. CONTINUITY ─────────────────────────────────────────────────
    const contStep = step('continuity', `CONTINUITY check`, addr);
    emit(contStep);
    uiCommandGateway.continuityCheck({ source, detail: `mod-${addr}` });
    const cont = await waitFor(() => {
      const m = deps.getFleet().modules[addr];
      return m && m.lastSeen >= before ? m : null;
    }, timeoutMs);
    if (!cont) {
      emit(close(contStep, 'timeout', 'Sem telemetria pós-CONTINUITY'));
      continue;
    }
    emit(close(contStep, 'pass', `${cont.igniters.filter((i) => i.connected).length} igniter(s) conectados`, {
      battery: cont.batteryVoltage, rssi: cont.rssiDbm,
    }));

    // 4. ARM ────────────────────────────────────────────────────────
    const armStep = step('arm', `ARM`, addr);
    emit(armStep);
    const armBefore = nowMs();
    uiCommandGateway.arm({ source, detail: `mod-${addr}` });
    const armed = await waitFor(() => {
      const m = deps.getFleet().modules[addr];
      return m && m.lastSeen >= armBefore && m.armed ? m : null;
    }, timeoutMs);
    if (!armed) {
      emit(close(armStep, 'timeout', 'Módulo não confirmou ARM'));
      // Try to disarm defensively then move on.
      uiCommandGateway.disarm({ source, detail: `mod-${addr}-recover` });
      continue;
    }
    emit(close(armStep, 'pass', 'ARM confirmado', { armed: true }));

    // 5. FIRE (dry by default) ──────────────────────────────────────
    if (!liveFire) {
      const dry = step('fire-dry', `FIRE intent (dry-run, sem energizar)`, addr);
      emit(dry);
      // Dry-run: registra intenção sem disparar.
      void recordSafetyNote('e2e-fire-dry-intent', {
        moduleAddress: addr, mode: workMode.get(),
      });
      emit(close(dry, 'pass', 'Intenção registrada (sem disparo físico)'));
    } else {
      const live = step('fire-live', `FIRE real (canal 1)`, addr);
      emit(live);
      const fireBefore = nowMs();
      uiCommandGateway.fire(
        { source, detail: `mod-${addr}` },
        { moduleAddress: addr, channel: 1, duration: 0.1, effectId: 'e2e-test' },
      );
      // 6. TELEMETRY confirm
      const telem = await waitFor(() => {
        const m = deps.getFleet().modules[addr];
        return m && m.lastSeen >= fireBefore ? m : null;
      }, timeoutMs);
      if (!telem) {
        emit(close(live, 'timeout', 'Sem telemetria pós-FIRE'));
      } else {
        const fired = telem.igniters.find((i) => i.position === 1)?.fired === true;
        emit(close(live, fired ? 'pass' : 'fail',
          fired ? 'Igniter 1 reportou fired=true' : 'Igniter 1 não confirmou disparo',
          { rssi: telem.rssiDbm, battery: telem.batteryVoltage },
        ));
      }
    }

    // 7. DISARM ─────────────────────────────────────────────────────
    const disarmStep = step('disarm', `DISARM`, addr);
    emit(disarmStep);
    uiCommandGateway.disarm({ source, detail: `mod-${addr}` });
    const disarmBefore = nowMs();
    const dis = await waitFor(() => {
      const m = deps.getFleet().modules[addr];
      return m && m.lastSeen >= disarmBefore && !m.armed ? m : null;
    }, timeoutMs);
    emit(close(disarmStep,
      dis ? 'pass' : 'timeout',
      dis ? 'Confirmado disarmado' : 'Sem confirmação — verificar campo',
    ));
  }

  return finalize(steps, targets, true, startedAt);
}

function finalize(
  steps: E2ETestStep[],
  modules: number[],
  ok: boolean,
  startedAt: number,
): E2ETestRunResult {
  const failed = steps.some((s) => s.status === 'fail' || s.status === 'timeout');
  return {
    ok: ok && !failed,
    startedAt,
    endedAt: nowMs(),
    steps,
    modulesTested: modules,
    workMode: workMode.get(),
  };
}
