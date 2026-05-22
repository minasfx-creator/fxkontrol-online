/**
 * ─── FXK32Q Typed Command API ────────────────────────────────────
 * Espelho do `src/lib/fxk16/commandApi.ts`, adaptado para 32 canais
 * e máscara 32-bit. Reutiliza o MESMO `FireOneHardwareBridge` — o
 * firmware FXK32Q fala o mesmo handshake ASCII, então o transporte
 * (USB-CDC + BLE) é compartilhado sem inventar novo path.
 *
 * ARM gate é client-side (firmware FXK32Q também não tem opcode ARM
 * no caminho USB/BLE — ARM físico só existe via RS-485/XLII+).
 * Auto-disarm em link loss; eStop bypassa ARM e auto-desarma.
 */
import {
  FireOneHardwareBridge,
  type BridgeReasonCode,
} from '@/lib/fireoneModuleHardwareBridge';
import {
  FXK32Q_MAX_CHANNEL,
  FXK32Q_MIN_DURATION_MS,
  FXK32Q_MAX_DURATION_MS,
  channelsToMask32,
  isFxk32q,
  type Fxk32qChannel,
} from './pinmap';

export type Fxk32qErrorCode =
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

export type Ok<T = void> = { ok: true; value: T };
export type Err = {
  ok: false;
  code: Fxk32qErrorCode;
  message: string;
  bridgeCode?: BridgeReasonCode;
  cause?: unknown;
};
export type CommandResponse<T = void> = Ok<T> | Err;

export interface FireResult { channel: number; durationMs: number; }
export interface BatchResult { mask: number; channels: number[]; durationMs: number; }

export interface Fxk32qCommandApi {
  isReady(): boolean;
  isArmed(): boolean;
  arm(): CommandResponse;
  disarm(): CommandResponse;
  fire(channel: Fxk32qChannel, durationMs: number): Promise<CommandResponse<FireResult>>;
  fireBatch(channels: Fxk32qChannel[], durationMs: number): Promise<CommandResponse<BatchResult>>;
  stop(): Promise<CommandResponse>;
  eStop(): Promise<CommandResponse>;
}

export interface Fxk32qCommandApiOptions {
  onArmChange?: (armed: boolean) => void;
}

const ok = <T,>(value: T): Ok<T> => ({ ok: true, value });
const err = (code: Fxk32qErrorCode, message: string, extra?: { bridgeCode?: BridgeReasonCode; cause?: unknown }): Err =>
  ({ ok: false, code, message, ...extra });

function validateChannel(c: number): Err | null {
  if (!Number.isInteger(c) || c < 1 || c > FXK32Q_MAX_CHANNEL) {
    return err('INVALID_CHANNEL', `FXK32Q channel ${c} fora do range 1..${FXK32Q_MAX_CHANNEL}`);
  }
  return null;
}
function validateDuration(ms: number): Err | null {
  if (!Number.isFinite(ms) || ms < FXK32Q_MIN_DURATION_MS || ms > FXK32Q_MAX_DURATION_MS) {
    return err('INVALID_DURATION',
      `Duração ${ms}ms fora do range ${FXK32Q_MIN_DURATION_MS}..${FXK32Q_MAX_DURATION_MS}ms`);
  }
  return null;
}
function mapBridgeCode(code: BridgeReasonCode | undefined): Fxk32qErrorCode {
  switch (code) {
    case 'NOT_CONNECTED': return 'NOT_CONNECTED';
    case 'LINK_NOT_HEALTHY':
    case 'HEARTBEAT_TIMEOUT':
    case 'TRANSPORT_DISCONNECTED': return 'LINK_DEGRADED';
    case 'COMMAND_TIMEOUT': return 'TIMEOUT';
    default: return 'BRIDGE_REJECTED';
  }
}

export function createFxk32qCommandApi(
  bridge: FireOneHardwareBridge,
  opts: Fxk32qCommandApiOptions = {},
): Fxk32qCommandApi {
  let armed = false;
  const setArmed = (v: boolean): void => {
    if (armed === v) return;
    armed = v;
    try { opts.onArmChange?.(v); } catch { /* listener errors must not break safety */ }
  };

  const isDeviceFxk32q = (): boolean => {
    const s = bridge.getStatus();
    return isFxk32q(s.deviceModel, s.channelCount);
  };

  const requireReady = (): Err | null => {
    const s = bridge.getStatus();
    if (!s.connected) return err('NOT_CONNECTED', 'FXK32Q não está conectado', { bridgeCode: 'NOT_CONNECTED' });
    if (!isDeviceFxk32q()) return err('WRONG_DEVICE', `Dispositivo conectado não é FXK32Q (${s.deviceModel ?? 'unknown'})`);
    if (s.linkHealth !== 'healthy') {
      return err('LINK_DEGRADED', `Link FXK32Q não saudável (${s.linkHealth ?? 'disconnected'})`, { bridgeCode: 'LINK_NOT_HEALTHY' });
    }
    return null;
  };

  const callBridge = async <T,>(label: string, fn: () => Promise<boolean>, payload: T): Promise<CommandResponse<T>> => {
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

  const watchLink = (): void => {
    if (!armed) return;
    const s = bridge.getStatus();
    if (!s.connected || s.linkHealth !== 'healthy') setArmed(false);
  };

  return {
    isReady: () => {
      const s = bridge.getStatus();
      return !!s.connected && s.linkHealth === 'healthy' && isDeviceFxk32q();
    },
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
      const chErr = validateChannel(channel);     if (chErr) return chErr;
      const durErr = validateDuration(durationMs); if (durErr) return durErr;
      const gate = requireReady();                 if (gate) return gate;
      if (!armed) return err('NOT_ARMED', 'FXK32Q desarmado — chame arm() antes de fire()');
      return callBridge(`FIRE ch${channel}`, () => bridge.fire(channel, durationMs), { channel, durationMs });
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
      const durErr = validateDuration(durationMs); if (durErr) return durErr;
      const gate = requireReady();                 if (gate) return gate;
      if (!armed) return err('NOT_ARMED', 'FXK32Q desarmado — chame arm() antes de fireBatch()');
      let mask: number;
      try {
        mask = channelsToMask32(channels);
      } catch (cause) {
        return err('INVALID_CHANNEL', cause instanceof Error ? cause.message : 'invalid mask', { cause });
      }
      // O bridge.fireBatch aceita number; máscara 32-bit cabe (>>>0 garante unsigned).
      return callBridge(
        `BATCH 0x${mask.toString(16).padStart(8, '0')}`,
        () => bridge.fireBatch(mask, durationMs),
        { mask, channels: [...channels], durationMs },
      );
    },
    async stop() {
      const result = await this.eStop();
      setArmed(false);
      return result;
    },
    async eStop() {
      return callBridge('ESTOP', () => bridge.eStop(), undefined);
    },
  };
}
