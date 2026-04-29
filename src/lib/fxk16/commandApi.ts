/**
 * ─── FXK16 Typed Command API ──────────────────────────────────────
 * Thin, strongly-typed wrapper on top of `FireOneHardwareBridge`
 * that returns discriminated `CommandResponse` results instead of
 * raw booleans. Adds a *client-side* ARM gate (the FXK16 firmware
 * has no `ARM:` opcode, so arming is enforced in software here).
 *
 * - Pure (no React). Wire it into a hook for reactivity.
 * - Honest: never invents new wire opcodes, never returns synthetic
 *   "ok" when the bridge actually rejected the command.
 * - All firing paths require: connected + isFXK16 + healthy + armed.
 *   Emergency stop bypasses ARM and auto-disarms on success.
 */
import {
  FireOneHardwareBridge,
  type BridgeReasonCode,
} from '@/lib/fireoneModuleHardwareBridge';
import { channelsToMask, FXK16_MAX_CHANNEL } from '@/hooks/useFXK16Bridge';

// ── Public types ───────────────────────────────────────────────────

export const FXK16_MIN_DURATION_MS = 1;
export const FXK16_MAX_DURATION_MS = 10_000;

export type Fxk16Channel = number; // validated 1..16 at runtime

export type Fxk16ErrorCode =
  | 'NOT_CONNECTED'
  | 'WRONG_DEVICE'
  | 'NOT_ARMED'
  | 'INVALID_CHANNEL'
  | 'INVALID_DURATION'
  | 'EMPTY_CHANNEL_SET'
  | 'LINK_DEGRADED'
  | 'BRIDGE_REJECTED'
  | 'BRIDGE_THREW'
  | 'TIMEOUT';

export interface Ok<T = void> { ok: true; value: T }
export interface Err {
  ok: false;
  code: Fxk16ErrorCode;
  message: string;
  /** Underlying bridge reason code, when available. */
  bridgeCode?: BridgeReasonCode;
  cause?: unknown;
}
export type CommandResponse<T = void> = Ok<T> | Err;

export interface FireResult {
  channel: number;
  durationMs: number;
}
export interface BatchResult {
  mask: number;
  channels: number[];
  durationMs: number;
}
export interface SelectResult {
  channels: number[];
  mask: number;
}

export interface Fxk16CommandApi {
  // ── State ───────────────────────────────────────────────────────
  isReady(): boolean;
  isArmed(): boolean;

  // ── ARM gate (client-side) ─────────────────────────────────────
  arm():    CommandResponse;
  disarm(): CommandResponse;

  // ── Firing ─────────────────────────────────────────────────────
  fire(channel: Fxk16Channel, durationMs: number): Promise<CommandResponse<FireResult>>;
  fireBatch(channels: Fxk16Channel[], durationMs: number): Promise<CommandResponse<BatchResult>>;

  // ── Channel selection (UI staging buffer) ──────────────────────
  setChannels(channels: Fxk16Channel[]): CommandResponse<SelectResult>;
  getSelectedChannels(): Fxk16Channel[];
  fireSelected(durationMs: number): Promise<CommandResponse<BatchResult>>;

  // ── Stop / E-STOP (always allowed) ─────────────────────────────
  stop():  Promise<CommandResponse>;  // alias for eStop + auto-disarms
  eStop(): Promise<CommandResponse>;
}

export interface Fxk16CommandApiOptions {
  /** Called whenever the ARM flag flips. */
  onArmChange?: (armed: boolean) => void;
  /** Override for tests. */
  now?: () => number;
}

// ── Helpers ────────────────────────────────────────────────────────

function ok<T>(value: T): Ok<T> { return { ok: true, value }; }

function err(code: Fxk16ErrorCode, message: string, extra?: { bridgeCode?: BridgeReasonCode; cause?: unknown }): Err {
  return { ok: false, code, message, ...extra };
}

function validateChannel(c: number): Err | null {
  if (!Number.isInteger(c) || c < 1 || c > FXK16_MAX_CHANNEL) {
    return err('INVALID_CHANNEL', `FXK16 channel ${c} fora do range 1..${FXK16_MAX_CHANNEL}`);
  }
  return null;
}

function validateDuration(ms: number): Err | null {
  if (!Number.isFinite(ms) || ms < FXK16_MIN_DURATION_MS || ms > FXK16_MAX_DURATION_MS) {
    return err(
      'INVALID_DURATION',
      `Duração ${ms}ms fora do range ${FXK16_MIN_DURATION_MS}..${FXK16_MAX_DURATION_MS}ms`,
    );
  }
  return null;
}

/** Map low-level bridge reason codes into our public taxonomy. */
function mapBridgeCode(code: BridgeReasonCode | undefined): Fxk16ErrorCode {
  switch (code) {
    case 'NOT_CONNECTED':       return 'NOT_CONNECTED';
    case 'LINK_NOT_HEALTHY':
    case 'HEARTBEAT_TIMEOUT':
    case 'TRANSPORT_DISCONNECTED':
      return 'LINK_DEGRADED';
    case 'COMMAND_TIMEOUT':     return 'TIMEOUT';
    default:                    return 'BRIDGE_REJECTED';
  }
}

// ── Factory ────────────────────────────────────────────────────────

/**
 * Build a typed command API around an existing bridge. The bridge is
 * shared (the singleton from `useFXK16Bridge`); the ARM flag and the
 * staged channel selection are owned by THIS api instance.
 *
 * Use `createFxk16CommandApi(bridge)` once per process (the singleton
 * hook handles that). Multiple instances would each have their own
 * ARM flag, which is intentional for unit tests but undesirable in app
 * code.
 */
export function createFxk16CommandApi(
  bridge: FireOneHardwareBridge,
  opts: Fxk16CommandApiOptions = {},
): Fxk16CommandApi {
  let armed = false;
  let selected: Fxk16Channel[] = [];

  const setArmed = (v: boolean): void => {
    if (armed === v) return;
    armed = v;
    try { opts.onArmChange?.(v); } catch { /* listener errors must not break safety */ }
  };

  const isFXK16 = (): boolean => {
    const s = bridge.getStatus();
    return (s.deviceModel ?? '').toUpperCase() === 'FXK16'
      && s.channelCount === FXK16_MAX_CHANNEL;
  };

  const isReady = (): boolean => {
    const s = bridge.getStatus();
    return !!s.connected && s.linkHealth === 'healthy' && isFXK16();
  };

  const requireReady = (): Err | null => {
    const s = bridge.getStatus();
    if (!s.connected) return err('NOT_CONNECTED', 'FXK16 não está conectado', { bridgeCode: 'NOT_CONNECTED' });
    if (!isFXK16())   return err('WRONG_DEVICE', `Dispositivo conectado não é FXK16 (${s.deviceModel ?? 'unknown'})`);
    if (s.linkHealth !== 'healthy') {
      return err('LINK_DEGRADED', `Link FXK16 não saudável (${s.linkHealth ?? 'disconnected'})`, { bridgeCode: 'LINK_NOT_HEALTHY' });
    }
    return null;
  };

  /** Wrap a bridge boolean call with try/catch and translate the result. */
  const callBridge = async <T>(
    label: string,
    fn: () => Promise<boolean>,
    payload: T,
  ): Promise<CommandResponse<T>> => {
    try {
      const ok2 = await fn();
      if (!ok2) {
        const code = bridge.getStatus().lastErrorCode;
        return err(mapBridgeCode(code), `${label} rejeitado pela bridge`, { bridgeCode: code });
      }
      return ok(payload);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      return err('BRIDGE_THREW', `${label} lançou exceção: ${message}`, { cause });
    }
  };

  // Auto-disarm on link loss / disconnect (defense in depth).
  // We poll the bridge status here on every gate check anyway, but
  // flipping the flag eagerly keeps onArmChange consumers honest.
  const watchLink = (): void => {
    if (!armed) return;
    const s = bridge.getStatus();
    if (!s.connected || s.linkHealth !== 'healthy') {
      setArmed(false);
    }
  };

  return {
    isReady,
    isArmed: () => armed,

    arm() {
      const gate = requireReady();
      if (gate) return gate;
      setArmed(true);
      return ok(undefined);
    },

    disarm() {
      setArmed(false);
      return ok(undefined);
    },

    async fire(channel, durationMs) {
      watchLink();
      const chErr = validateChannel(channel);          if (chErr)  return chErr;
      const durErr = validateDuration(durationMs);     if (durErr) return durErr;
      const gate = requireReady();                     if (gate)   return gate;
      if (!armed) return err('NOT_ARMED', 'FXK16 desarmado — chame arm() antes de fire()');
      return callBridge(`FIRE ch${channel}`, () => bridge.fire(channel, durationMs), {
        channel, durationMs,
      });
    },

    async fireBatch(channels, durationMs) {
      watchLink();
      if (!Array.isArray(channels) || channels.length === 0) {
        return err('EMPTY_CHANNEL_SET', 'fireBatch() recebeu lista vazia');
      }
      for (const c of channels) {
        const chErr = validateChannel(c);
        if (chErr) return chErr;
      }
      const durErr = validateDuration(durationMs);    if (durErr) return durErr;
      const gate = requireReady();                    if (gate)   return gate;
      if (!armed) return err('NOT_ARMED', 'FXK16 desarmado — chame arm() antes de fireBatch()');
      let mask: number;
      try {
        mask = channelsToMask(channels);
      } catch (cause) {
        return err('INVALID_CHANNEL', cause instanceof Error ? cause.message : 'invalid mask', { cause });
      }
      return callBridge(
        `BATCH 0x${mask.toString(16).padStart(4, '0')}`,
        () => bridge.fireBatch(mask, durationMs),
        { mask, channels: [...channels], durationMs },
      );
    },

    setChannels(channels) {
      if (!Array.isArray(channels)) {
        return err('INVALID_CHANNEL', 'setChannels(): argumento não é array');
      }
      // Empty array is a valid "clear" operation — no error.
      const dedup = Array.from(new Set(channels));
      for (const c of dedup) {
        const chErr = validateChannel(c);
        if (chErr) return chErr;
      }
      dedup.sort((a, b) => a - b);
      selected = dedup;
      let mask = 0;
      try { mask = channelsToMask(dedup); } catch { mask = 0; }
      return ok({ channels: [...dedup], mask });
    },

    getSelectedChannels() {
      return [...selected];
    },

    async fireSelected(durationMs) {
      if (selected.length === 0) {
        return err('EMPTY_CHANNEL_SET', 'Nenhum canal selecionado — use setChannels() antes');
      }
      return this.fireBatch(selected, durationMs);
    },

    async stop() {
      const result = await this.eStop();
      // Fail-safe: clear ARM regardless of stop result.
      setArmed(false);
      return result;
    },

    async eStop() {
      // Bypasses ARM and link health by design — must always try.
      return callBridge('ESTOP', () => bridge.eStop(), undefined);
    },
  };
}
