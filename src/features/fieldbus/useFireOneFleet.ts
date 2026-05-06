/**
 * ─── useFireOneFleet — XLII+ / XL4-3 live operation hook ───────────
 *
 * Owns one SerialTransport (USB-FTDI 9600 8N1) and a per-slat status
 * map polled at 2 Hz. All write commands go through uiCommandGateway;
 * we only pull telemetry directly off the protocol (read-only).
 *
 * Honesty contract: no module reply ⇒ no synthetic data; the panel
 * shows "no live module".
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  buildIdentify,
  buildContinuityCommand,
  buildWirelessStatusQuery,
  parseStatusPayload,
  FIREONE_MAX_MODULES,
  type FireOneModuleStatus,
} from '@/lib/fireoneProtocol';
import { SerialTransport } from '@/lib/fireoneTransport';
import { markDeviceClassified } from '@/core/discovery/controllerRegistry';
import { uiCommandGateway } from '@/core/command/uiCommandGateway';
import { recordSafetyNote } from '@/core/safety/safetyBlackBox';
import { registerCableLink } from '@/core/network/realTransports';
import { fieldBus } from '@/core/network/fieldBus';

type LinkState = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface FireOneFleetState {
  link: LinkState;
  error?: string;
  modules: Record<number, FireOneModuleStatus>;
  lastIdentifyAt: number | null;
  identifyCount: number;
  txBytes: number;
  rxBytes: number;
  latencyMs: number;
}

const SOURCE = { source: 'FireOnePanel' } as const;

export function useFireOneFleet() {
  const transportRef = useRef<SerialTransport | null>(null);
  const pollRef = useRef<number | null>(null);
  const [state, setState] = useState<FireOneFleetState>({
    link: 'disconnected',
    modules: {},
    lastIdentifyAt: null,
    identifyCount: 0,
    txBytes: 0,
    rxBytes: 0,
    latencyMs: 0,
  });

  const setLink = (link: LinkState, error?: string) =>
    setState(s => ({ ...s, link, error }));

  // ── Connect ──────────────────────────────────────────────
  const connect = useCallback(async () => {
    if (transportRef.current) return;
    setLink('connecting');
    const t = new SerialTransport(`fireone-xl4-${Date.now()}`, 9600);
    t.onStateChange((_id, s, err) => {
      if (s === 'connected') setLink('connected');
      else if (s === 'error') setLink('error', err);
      else if (s === 'disconnected') setLink('disconnected');
    });
    t.onReceive((bytes) => {
      // Trivial framing: status replies start with a slat addr byte.
      // Real parser lives in fireoneProtocol; for this hook we extract
      // STATUS frames best-effort and update the slat map.
      try {
        if (bytes.length >= 2) {
          const addr = bytes[0];
          if (addr >= 1 && addr <= FIREONE_MAX_MODULES) {
            const status = parseStatusPayload(addr, bytes.subarray(1));
            setState(s => ({
              ...s,
              modules: { ...s.modules, [addr]: status },
              rxBytes: s.rxBytes + bytes.length,
            }));
          }
        }
      } catch { /* ignore malformed frame */ }
    });
    try {
      await t.connect();
      transportRef.current = t;

      // IDENTIFY broadcast → reclassify any FTDI port that replies.
      const probe = buildIdentify(0); // 0 = broadcast
      await t.send(probe);
      // Promote registry entry (best-effort; aggregator may not yet know
      // a deviceId, so we use the transport id as a stable surrogate).
      markDeviceClassified(t.id, 'fireone');
      setState(s => ({ ...s, lastIdentifyAt: Date.now(), identifyCount: s.identifyCount + 1 }));
      void recordSafetyNote('fireone-xl4-connect', { transportId: t.id });
      // Wire FieldBus rs485 transport to this real cable link so pyroExecutor
      // can dispatch through it. Honest contract: revoked on disconnect.
      registerCableLink({
        id: t.id,
        isAlive: () => transportRef.current === t,
        send: (bytes: Uint8Array) => {
          try { void t.send(bytes); fieldBus.heartbeat('rs485'); return true; }
          catch { return false; }
        },
      });
    } catch (err: any) {
      setLink('error', err?.message);
      transportRef.current = null;
    }
  }, []);

  const disconnect = useCallback(async () => {
    const t = transportRef.current;
    transportRef.current = null;
    registerCableLink(null);
    if (pollRef.current) { window.clearInterval(pollRef.current); pollRef.current = null; }
    if (t) { try { await t.disconnect(); } catch { /* ignore */ } }
    setState({
      link: 'disconnected', modules: {}, lastIdentifyAt: null, identifyCount: 0,
      txBytes: 0, rxBytes: 0, latencyMs: 0,
    });
  }, []);

  // ── 2 Hz STATUS polling for known slats ──────────────────
  useEffect(() => {
    if (state.link !== 'connected') return;
    pollRef.current = window.setInterval(() => {
      const t = transportRef.current;
      if (!t) return;
      // Light status sweep: only poll slats we have already seen.
      const slats = Object.keys(state.modules).map(Number);
      for (const addr of slats) {
        try { void t.send(buildContinuityCommand(addr)); } catch { /* link torn */ }
      }
    }, 500);
    return () => {
      if (pollRef.current) { window.clearInterval(pollRef.current); pollRef.current = null; }
    };
  }, [state.link, state.modules]);

  // ── Per-slat actions ─────────────────────────────────────
  const continuityCheck = useCallback((slat: number) => {
    uiCommandGateway.continuityCheck({ ...SOURCE, detail: `slat ${slat}` });
    const t = transportRef.current;
    try { if (t) void t.send(buildContinuityCommand(slat)); } catch { /* ignore */ }
  }, []);

  const queryWireless = useCallback((slat: number) => {
    const t = transportRef.current;
    try { if (t) void t.send(buildWirelessStatusQuery(slat)); } catch { /* ignore */ }
  }, []);

  const arm = useCallback(() => uiCommandGateway.arm(SOURCE), []);
  const disarm = useCallback(() => uiCommandGateway.disarm(SOURCE), []);
  const eStop = useCallback(() => uiCommandGateway.eStop(SOURCE), []);
  const fire = useCallback((slat: number, cue: number) => {
    uiCommandGateway.fire({ ...SOURCE, detail: `slat ${slat} cue ${cue}` }, { slat, cue });
  }, []);

  // ── Cleanup on unmount ───────────────────────────────────
  useEffect(() => () => { void disconnect(); }, [disconnect]);

  return {
    state,
    connect, disconnect,
    arm, disarm, eStop, fire,
    continuityCheck, queryWireless,
  };
}
