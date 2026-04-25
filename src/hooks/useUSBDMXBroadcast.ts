/**
 * ─── useUSBDMXBroadcast ─────────────────────────────────────────────
 * Loop de broadcast DMX512 via WebSerial (USB-C/USB-A) usando
 * `useUSBDeviceStore.sendDMXToAll`. Default 40Hz (DMX512 spec: 1–44Hz).
 *
 * Garantias:
 *  - Memory mgmt (Core): timer em useRef, clearInterval no unmount,
 *    sem leaks mesmo em remounts rápidos.
 *  - Sem empilhamento: flag `inFlightRef` faz throttle natural se a
 *    USB engasgar (descarta tick em vez de empilhar promessas).
 *  - Zero re-mount em troca de canais: a fonte é uma função
 *    `getChannels()` lida em tempo real (não entra em deps do effect).
 *  - Auto-stop: se o envio lança erro, o loop é interrompido e o
 *    callback `onError` é chamado (UI decide se mostra toast).
 */
import { useEffect, useRef, useState } from 'react';
import { useUSBDeviceStore } from '@/store/useUSBDeviceStore';
import { logger } from '@/lib/logger';

export interface UseUSBDMXBroadcastOptions {
  /** Função que retorna o frame DMX atual (Uint8Array, até 512 bytes). */
  getChannels: () => Uint8Array | null | undefined;
  /** Hz de refresh; clamp 1–44Hz (DMX512 spec). Default 40. */
  fps?: number;
  /** Liga/desliga sem desmontar. Default true. */
  enabled?: boolean;
  /** Callback chamado quando o loop para por erro (auto-stop). */
  onError?: (err: Error) => void;
  /** Callback opcional após cada envio bem-sucedido. */
  onTick?: (info: { frames: number; latencyMs: number; deviceCount: number }) => void;
}

export interface UseUSBDMXBroadcastResult {
  /** True enquanto o setInterval está ativo. */
  streaming: boolean;
  /** Total de frames enviados desde o último start. */
  framesSent: number;
}

export function useUSBDMXBroadcast(
  options: UseUSBDMXBroadcastOptions
): UseUSBDMXBroadcastResult {
  const { getChannels, fps = 40, enabled = true, onError, onTick } = options;

  const sendDMXToAll = useUSBDeviceStore(s => s.sendDMXToAll);
  const dmxDevices = useUSBDeviceStore(s => s.dmxDevices);
  const connectedCount = dmxDevices.filter(
    d => d.state === 'connected' && d.type === 'dmx'
  ).length;

  // Refs (não disparam re-render nem reiniciam o interval)
  const intervalRef = useRef<number | null>(null);
  const inFlightRef = useRef(false);
  const framesRef = useRef(0);
  const getChannelsRef = useRef(getChannels);
  const onErrorRef = useRef(onError);
  const onTickRef = useRef(onTick);
  // State: refletido para o consumidor (ref muta sem re-render).
  const [streaming, setStreaming] = useState(false);

  // Sincroniza refs sem reiniciar o loop
  useEffect(() => { getChannelsRef.current = getChannels; }, [getChannels]);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);
  useEffect(() => { onTickRef.current = onTick; }, [onTick]);

  useEffect(() => {
    // Pré-condições: habilitado + pelo menos 1 dispositivo USB DMX conectado
    if (!enabled || connectedCount === 0) {
      framesRef.current = 0;
      return;
    }

    // Clamp FPS ao range válido do DMX512 (1–44Hz). Floor 23ms ≈ 43.5Hz.
    const safeFps = Math.max(1, Math.min(44, fps));
    const periodMs = Math.max(23, Math.round(1000 / safeFps));

    framesRef.current = 0;
    inFlightRef.current = false;
    logger.info('[useUSBDMXBroadcast] start', {
      fps: safeFps,
      periodMs,
      devices: connectedCount,
    });

    const tick = async () => {
      if (inFlightRef.current) return; // throttle natural — sem empilhamento
      const channels = getChannelsRef.current();
      if (!channels || channels.length === 0) return;

      inFlightRef.current = true;
      const t0 = performance.now();
      try {
        const result = await sendDMXToAll(channels);
        const latencyMs = Math.round(performance.now() - t0);
        framesRef.current += 1;
        onTickRef.current?.({
          frames: framesRef.current,
          latencyMs,
          deviceCount: result.deviceCount,
        });
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        logger.warn('[useUSBDMXBroadcast] send failed — auto-stop', error);
        // Auto-stop em erro: limpa o interval imediatamente
        if (intervalRef.current !== null) {
          window.clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        inFlightRef.current = false;
        setStreaming(false);
        onErrorRef.current?.(error);
      } finally {
        inFlightRef.current = false;
      }
    };

    intervalRef.current = window.setInterval(tick, periodMs);
    setStreaming(true);

    return () => {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      inFlightRef.current = false;
      setStreaming(false);
      logger.info('[useUSBDMXBroadcast] stop', { framesSent: framesRef.current });
    };
  }, [enabled, fps, connectedCount, sendDMXToAll]);

  return {
    streaming,
    framesSent: framesRef.current,
  };
}
