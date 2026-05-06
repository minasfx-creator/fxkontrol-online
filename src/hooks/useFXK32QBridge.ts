/**
 * ─── useFXK32QBridge — Singleton FXK32Q hardware bridge ───────────
 *
 * Wrapper React do `FireOneHardwareBridge` dedicado ao FXK32Q (32ch).
 * Compartilha um SINGLETON entre todos os componentes que falam com o
 * mesmo módulo físico, e expõe TODOS os transportes do FireOne:
 *
 *   • USB-CDC          → connectUSB()
 *   • BLE              → connectBLE()
 *   • BLE Long Range   → connectBLELongRange()
 *   • WebSocket        → connectWebSocket(url)
 *   • Wi-Fi Direct     → connectWiFiDirect(url?)
 *   • Direct Relay     → connectDirectRelay()  (USB↔RS-485 XLII+ slave)
 *
 * O handshake é o MESMO em todos os transports: VERSION + STATUS
 * (espera-se `MODEL:FXK32Q;CH:32`). Só após esse reply é que
 * `isFXK32Q` vira `true` e o adapter é promovido a LIVE_READ_ONLY
 * pelo `discoveryRegistryBridge`.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  FireOneHardwareBridge,
  type BridgeStatus,
} from '@/lib/fireoneModuleHardwareBridge';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';
import { isFxk32q, FXK32Q_MAX_CHANNEL, channelsToMask32 } from '@/lib/fxk32q/pinmap';

let _singleton: FireOneHardwareBridge | null = null;
const _listeners = new Set<(s: BridgeStatus) => void>();

function getBridge(): FireOneHardwareBridge {
  if (_singleton) return _singleton;
  _singleton = new FireOneHardwareBridge((event, data) => {
    if (event === 'connected') {
      const d = (data ?? {}) as { device?: string; transport?: string };
      toast.success(`FXK32Q conectando via ${d.transport ?? 'transport'}: ${d.device ?? 'unknown'}`);
    } else if (event === 'disconnected') {
      toast.info('FXK32Q desconectado');
    } else if (event === 'heartbeat_timeout') {
      toast.warning('FXK32Q sem resposta — link perdido');
    } else if (event === 'module_model') {
      const model = String(data ?? '');
      if (model.toUpperCase() === 'FXK32Q') {
        toast.success(`Handshake confirmado: ${model}`);
      }
    }
    const snap = _singleton!.getStatus();
    _listeners.forEach((fn) => { try { fn(snap); } catch (e) { logger.warn('[useFXK32QBridge] listener', e); } });
  });
  return _singleton;
}

export interface UseFXK32QBridgeApi {
  status: BridgeStatus;
  isFXK32Q: boolean;
  isConnected: boolean;
  connectUSB: () => Promise<boolean>;
  connectBLE: () => Promise<boolean>;
  connectBLELongRange: () => Promise<boolean>;
  connectWebSocket: (url?: string) => Promise<boolean>;
  connectWiFiDirect: (url?: string) => Promise<boolean>;
  connectDirectRelay: () => Promise<boolean>;
  disconnect: () => Promise<void>;
  fire: (channel: number, durationMs: number) => Promise<boolean>;
  batch: (channels: number[], durationMs: number) => Promise<boolean>;
  eStop: () => Promise<void>;
}

export function useFXK32QBridge(): UseFXK32QBridgeApi {
  const bridge = getBridge();
  const [status, setStatus] = useState<BridgeStatus>(() => bridge.getStatus());

  useEffect(() => {
    const update = (s: BridgeStatus) => setStatus({ ...s });
    _listeners.add(update);
    const tick = setInterval(() => setStatus({ ...bridge.getStatus() }), 1000);
    setStatus({ ...bridge.getStatus() });
    return () => {
      _listeners.delete(update);
      clearInterval(tick);
    };
  }, [bridge]);

  const isFXK32Q = isFxk32q(status.deviceModel, status.channelCount);
  const isConnected = !!status.connected && status.linkHealth === 'healthy';

  const connectUSB = useCallback(() => bridge.connectUSB(), [bridge]);
  const connectBLE = useCallback(() => bridge.connectBLE(), [bridge]);
  const connectBLELongRange = useCallback(() => bridge.connectBLELongRange(), [bridge]);
  const connectWebSocket = useCallback((url?: string) =>
    url ? bridge.connectWebSocket(url) : bridge.connectWebSocket(), [bridge]);
  const connectWiFiDirect = useCallback((url?: string) => bridge.connectWiFiDirect(url), [bridge]);
  const connectDirectRelay = useCallback(() => bridge.connectDirectRelay(), [bridge]);
  const disconnect = useCallback(() => bridge.disconnect(), [bridge]);

  const fire = useCallback(async (channel: number, durationMs: number) => {
    if (!Number.isInteger(channel) || channel < 1 || channel > FXK32Q_MAX_CHANNEL) {
      const msg = `FXK32Q fire(): channel ${channel} fora do range 1..${FXK32Q_MAX_CHANNEL}`;
      logger.error(msg);
      toast.error(msg);
      return false;
    }
    return bridge.fire(channel, durationMs);
  }, [bridge]);

  const batch = useCallback(async (channels: number[], durationMs: number) => {
    let mask: number;
    try {
      mask = channelsToMask32(channels);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'invalid mask';
      logger.error('[FXK32Q] batch error', msg);
      toast.error(msg);
      return false;
    }
    return bridge.fireBatch(mask, durationMs);
  }, [bridge]);

  const eStop = useCallback(async () => { await bridge.eStop(); }, [bridge]);

  return {
    status, isFXK32Q, isConnected,
    connectUSB, connectBLE, connectBLELongRange,
    connectWebSocket, connectWiFiDirect, connectDirectRelay,
    disconnect, fire, batch, eStop,
  };
}

/** Diagnostic accessor — get the singleton without subscribing. */
export function getFXK32QBridge(): FireOneHardwareBridge {
  return getBridge();
}

/**
 * Non-React subscription to the FXK32Q singleton bridge status.
 * Used by `discoveryRegistryBridge` to promote the FXK32QModuleAdapter
 * provenance to `live_read_only` once a real handshake completes
 * (em qualquer dos 6 transports).
 */
export function subscribeFXK32QBridge(
  listener: (status: BridgeStatus) => void,
): () => void {
  getBridge();
  _listeners.add(listener);
  return () => { _listeners.delete(listener); };
}
