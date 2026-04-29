/**
 * ─── useFXK16Bridge — Singleton FXK16 hardware bridge for FXKPYRO ──
 *
 * Wraps `FireOneHardwareBridge` (the same ASCII transport the FXK16
 * firmware speaks) as a process-singleton so multiple PYRO panels
 * share ONE physical link. Reactive `status` updates 1Hz.
 *
 * Surface:
 *   - connectUSB() / connectBLE() / disconnect()
 *   - fire(channel, ms) / batch(mask, ms) / eStop()
 *   - status: live BridgeStatus (deviceModel, channelCount, transport,
 *     RSSI, linkHealth)
 *   - isFXK16: true once handshake confirmed `MODEL:FXK16;CH:16`
 *
 * Channel mapping is 1:1 — FXKPYRO channel `n` (1..16) → FXK16 relay `n`.
 * Calls with channel > 16 are rejected with a clear error.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  FireOneHardwareBridge,
  type BridgeStatus,
} from '@/lib/fireoneModuleHardwareBridge';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';

let _singleton: FireOneHardwareBridge | null = null;
const _listeners = new Set<(s: BridgeStatus) => void>();

function getBridge(): FireOneHardwareBridge {
  if (_singleton) return _singleton;
  _singleton = new FireOneHardwareBridge((event, data) => {
    if (event === 'connected') {
      const d = (data ?? {}) as { device?: string };
      toast.success(`FXK16 conectado: ${d.device ?? 'unknown'}`);
    } else if (event === 'disconnected') {
      toast.info('FXK16 desconectado');
    } else if (event === 'heartbeat_timeout') {
      toast.warning('FXK16 sem resposta — link perdido');
    }
    const snap = _singleton!.getStatus();
    _listeners.forEach((fn) => { try { fn(snap); } catch (e) { logger.warn('[useFXK16Bridge] listener', e); } });
  });
  return _singleton;
}

export const FXK16_MAX_CHANNEL = 16;

export interface UseFXK16BridgeApi {
  status: BridgeStatus;
  isFXK16: boolean;
  isConnected: boolean;
  connectUSB: () => Promise<boolean>;
  connectBLE: () => Promise<boolean>;
  disconnect: () => Promise<void>;
  fire: (channel: number, durationMs: number) => Promise<boolean>;
  batch: (channels: number[], durationMs: number) => Promise<boolean>;
  eStop: () => Promise<void>;
}

/** Build a 16-bit mask from a list of 1-indexed FXK16 channels. */
export function channelsToMask(channels: number[]): number {
  let mask = 0;
  for (const c of channels) {
    if (c < 1 || c > FXK16_MAX_CHANNEL) {
      throw new Error(`FXK16 channel out of range: ${c} (valid 1..${FXK16_MAX_CHANNEL})`);
    }
    mask |= 1 << (c - 1);
  }
  return mask & 0xFFFF;
}

export function useFXK16Bridge(): UseFXK16BridgeApi {
  const bridge = getBridge();
  const [status, setStatus] = useState<BridgeStatus>(() => bridge.getStatus());

  useEffect(() => {
    const update = (s: BridgeStatus) => setStatus({ ...s });
    _listeners.add(update);
    // Polling fallback so RSSI / latency surface even when no events fire.
    const tick = setInterval(() => setStatus({ ...bridge.getStatus() }), 1000);
    setStatus({ ...bridge.getStatus() });
    return () => {
      _listeners.delete(update);
      clearInterval(tick);
    };
  }, [bridge]);

  const isFXK16 =
    (status.deviceModel ?? '').toUpperCase() === 'FXK16'
    && status.channelCount === FXK16_MAX_CHANNEL;
  const isConnected = !!status.connected && status.linkHealth === 'healthy';

  const connectUSB = useCallback(() => bridge.connectUSB(), [bridge]);
  const connectBLE = useCallback(() => bridge.connectBLE(), [bridge]);
  const disconnect = useCallback(() => bridge.disconnect(), [bridge]);

  const fire = useCallback(async (channel: number, durationMs: number) => {
    if (channel < 1 || channel > FXK16_MAX_CHANNEL) {
      const msg = `FXK16 fire(): channel ${channel} fora do range 1..${FXK16_MAX_CHANNEL}`;
      logger.error(msg);
      toast.error(msg);
      return false;
    }
    return bridge.fire(channel, durationMs);
  }, [bridge]);

  const batch = useCallback(async (channels: number[], durationMs: number) => {
    let mask: number;
    try {
      mask = channelsToMask(channels);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'invalid mask';
      logger.error('[FXK16] batch error', msg);
      toast.error(msg);
      return false;
    }
    return bridge.fireBatch(mask, durationMs);
  }, [bridge]);

  const eStop = useCallback(async () => {
    await bridge.eStop();
  }, [bridge]);

  return { status, isFXK16, isConnected, connectUSB, connectBLE, disconnect, fire, batch, eStop };
}

/** Diagnostic accessor — get the singleton without subscribing (for non-React code). */
export function getFXK16Bridge(): FireOneHardwareBridge {
  return getBridge();
}
