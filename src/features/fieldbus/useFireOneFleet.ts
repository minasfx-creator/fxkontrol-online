/**
 * ─── useFireOneFleet — XLII+ / XL4-3 / TNC live operation hook ─────
 *
 * Owns up to two SerialTransports:
 *   • cable  — XLII+/XL4-3 direct (USB-FTDI 9600 8N1)
 *   • radio  — TNC USB-RF dock to wireless modules (38400 8N1)
 *
 * `mode = 'cable' | 'wireless' | 'auto'` selects which links are active.
 * In AUTO we open cable first; if no IDENTIFY reply within 3s we also
 * open the radio link (both can coexist).
 *
 * Honesty contract: no module reply ⇒ no synthetic data.
 * Every write goes through uiCommandGateway. Telemetry is read-only.
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
import { registerCableLink, registerRadioLink } from '@/core/network/realTransports';
import { fieldBus } from '@/core/network/fieldBus';

type LinkState = 'disconnected' | 'connecting' | 'connected' | 'error';
export type FireOneLinkMode = 'cable' | 'wireless' | 'auto';

export interface FireOneLink {
  state: LinkState;
  error?: string;
  txBytes: number;
  rxBytes: number;
  lastReplyAt: number | null;
}

export interface FireOneFleetState {
  /** Aggregated link state for legacy UI: 'connected' if any link up. */
  link: LinkState;
  error?: string;
  mode: FireOneLinkMode;
  cable: FireOneLink;
  radio: FireOneLink;
  modules: Record<number, FireOneModuleStatus>;
  lastIdentifyAt: number | null;
  identifyCount: number;
  txBytes: number;
  rxBytes: number;
  latencyMs: number;
}

const SOURCE = { source: 'FireOnePanel' } as const;
const CABLE_BAUD = 9600;
const RADIO_BAUD = 38400;
const AUTO_FALLBACK_MS = 3000;
const MODE_STORAGE_KEY = 'fxk.fireone.linkMode.v1';

function loadMode(): FireOneLinkMode {
  if (typeof localStorage === 'undefined') return 'auto';
  try {
    const v = localStorage.getItem(MODE_STORAGE_KEY) as FireOneLinkMode | null;
    return v === 'cable' || v === 'wireless' || v === 'auto' ? v : 'auto';
  } catch { return 'auto'; }
}
function saveMode(m: FireOneLinkMode): void {
  if (typeof localStorage === 'undefined') return;
  try { localStorage.setItem(MODE_STORAGE_KEY, m); } catch { /* noop */ }
}

const emptyLink = (): FireOneLink => ({
  state: 'disconnected', txBytes: 0, rxBytes: 0, lastReplyAt: null,
});

function aggregate(cable: FireOneLink, radio: FireOneLink): LinkState {
  if (cable.state === 'connected' || radio.state === 'connected') return 'connected';
  if (cable.state === 'connecting' || radio.state === 'connecting') return 'connecting';
  if (cable.state === 'error' || radio.state === 'error') return 'error';
  return 'disconnected';
}

export function useFireOneFleet() {
  const cableRef = useRef<SerialTransport | null>(null);
  const radioRef = useRef<SerialTransport | null>(null);
  const pollRef = useRef<number | null>(null);
  const fallbackTimerRef = useRef<number | null>(null);

  const [state, setState] = useState<FireOneFleetState>(() => ({
    link: 'disconnected',
    mode: loadMode(),
    cable: emptyLink(),
    radio: emptyLink(),
    modules: {},
    lastIdentifyAt: null,
    identifyCount: 0,
    txBytes: 0,
    rxBytes: 0,
    latencyMs: 0,
  }));

  const updateLink = useCallback((which: 'cable' | 'radio', patch: Partial<FireOneLink>) => {
    setState(s => {
      const next = { ...s[which], ...patch };
      const link = which === 'cable' ? aggregate(next, s.radio) : aggregate(s.cable, next);
      return { ...s, [which]: next, link };
    });
  }, []);

  // ── Open one specific transport ───────────────────────────
  const openTransport = useCallback(async (which: 'cable' | 'radio') => {
    const ref = which === 'cable' ? cableRef : radioRef;
    if (ref.current) return;
    const baud = which === 'cable' ? CABLE_BAUD : RADIO_BAUD;
    const id = `fireone-${which}-${Date.now()}`;
    updateLink(which, { state: 'connecting', error: undefined });

    const t = new SerialTransport(id, baud);
    t.onStateChange((_id, s, err) => {
      if (s === 'connected') updateLink(which, { state: 'connected', error: undefined });
      else if (s === 'error') updateLink(which, { state: 'error', error: err });
      else if (s === 'disconnected') updateLink(which, { state: 'disconnected' });
    });
    t.onReceive((bytes) => {
      try {
        if (bytes.length >= 2) {
          const addr = bytes[0];
          if (addr >= 1 && addr <= FIREONE_MAX_MODULES) {
            const status = parseStatusPayload(addr, bytes.subarray(1));
            (status as any).connectionMode = which === 'cable' ? 'wired' : 'wireless';
            setState(s => ({
              ...s,
              modules: { ...s.modules, [addr]: status },
              [which]: { ...s[which], rxBytes: s[which].rxBytes + bytes.length, lastReplyAt: Date.now() },
              rxBytes: s.rxBytes + bytes.length,
            }));
          }
        }
      } catch { /* ignore malformed frame */ }
    });

    try {
      await t.connect();
      ref.current = t;
      await t.send(buildIdentify(0));
      markDeviceClassified(t.id, 'fireone');
      setState(s => ({
        ...s,
        lastIdentifyAt: Date.now(),
        identifyCount: s.identifyCount + 1,
      }));
      void recordSafetyNote(`fireone-${which}-connect`, { transportId: t.id, baud });

      const link = {
        id: t.id,
        isAlive: () => ref.current === t,
        send: (b: Uint8Array) => {
          try {
            void t.send(b);
            fieldBus.heartbeat(which === 'cable' ? 'rs485' : 'relay');
            return true;
          } catch { return false; }
        },
      };
      if (which === 'cable') registerCableLink(link);
      else registerRadioLink(link);
    } catch (err: any) {
      updateLink(which, { state: 'error', error: err?.message ?? 'connect failed' });
      ref.current = null;
    }
  }, [updateLink]);

  // ── Close one transport ───────────────────────────────────
  const closeTransport = useCallback(async (which: 'cable' | 'radio') => {
    const ref = which === 'cable' ? cableRef : radioRef;
    const t = ref.current;
    ref.current = null;
    if (which === 'cable') registerCableLink(null);
    else registerRadioLink(null);
    if (t) { try { await t.disconnect(); } catch { /* ignore */ } }
    updateLink(which, emptyLink());
  }, [updateLink]);

  // ── Connect according to current mode ─────────────────────
  const connect = useCallback(async () => {
    const mode = state.mode;
    if (mode === 'cable' || mode === 'auto') await openTransport('cable');
    if (mode === 'wireless') await openTransport('radio');
    if (mode === 'auto') {
      if (fallbackTimerRef.current) window.clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = window.setTimeout(() => {
        if (Object.keys(state.modules).length === 0 && !radioRef.current) {
          void openTransport('radio');
        }
      }, AUTO_FALLBACK_MS);
    }
  }, [state.mode, state.modules, openTransport]);

  const disconnect = useCallback(async () => {
    if (fallbackTimerRef.current) { window.clearTimeout(fallbackTimerRef.current); fallbackTimerRef.current = null; }
    if (pollRef.current) { window.clearInterval(pollRef.current); pollRef.current = null; }
    await Promise.all([closeTransport('cable'), closeTransport('radio')]);
    setState(s => ({
      ...s,
      modules: {},
      lastIdentifyAt: null,
      identifyCount: 0,
      txBytes: 0,
      rxBytes: 0,
      latencyMs: 0,
    }));
  }, [closeTransport]);

  // ── Mode setter (persisted; reconnects active links) ──────
  const setMode = useCallback((mode: FireOneLinkMode) => {
    saveMode(mode);
    setState(s => ({ ...s, mode }));
    // If a link is no longer needed by the new mode, close it.
    if (mode === 'cable' && radioRef.current) void closeTransport('radio');
    if (mode === 'wireless' && cableRef.current) void closeTransport('cable');
  }, [closeTransport]);

  // ── 2 Hz STATUS polling for known slats ───────────────────
  useEffect(() => {
    if (state.link !== 'connected') return;
    pollRef.current = window.setInterval(() => {
      const slats = Object.keys(state.modules).map(Number);
      for (const addr of slats) {
        const mod = state.modules[addr];
        const preferred = mod && (mod as any).connectionMode === 'wireless'
          ? radioRef.current
          : cableRef.current;
        const t = preferred ?? cableRef.current ?? radioRef.current;
        if (!t) continue;
        try { void t.send(buildContinuityCommand(addr)); } catch { /* ignore */ }
      }
    }, 500);
    return () => {
      if (pollRef.current) { window.clearInterval(pollRef.current); pollRef.current = null; }
    };
  }, [state.link, state.modules]);

  // ── Per-slat actions ──────────────────────────────────────
  const continuityCheck = useCallback((slat: number) => {
    uiCommandGateway.continuityCheck({ ...SOURCE, detail: `slat ${slat}` });
    const t = cableRef.current ?? radioRef.current;
    try { if (t) void t.send(buildContinuityCommand(slat)); } catch { /* ignore */ }
  }, []);

  const queryWireless = useCallback((slat: number) => {
    const t = radioRef.current ?? cableRef.current;
    try { if (t) void t.send(buildWirelessStatusQuery(slat)); } catch { /* ignore */ }
  }, []);

  const arm = useCallback(() => uiCommandGateway.arm(SOURCE), []);
  const disarm = useCallback(() => uiCommandGateway.disarm(SOURCE), []);
  const eStop = useCallback(() => uiCommandGateway.eStop(SOURCE), []);
  const fire = useCallback((slat: number, cue: number) => {
    uiCommandGateway.fire({ ...SOURCE, detail: `slat ${slat} cue ${cue}` }, { slat, cue });
  }, []);

  // ── Cleanup on unmount ────────────────────────────────────
  useEffect(() => () => { void disconnect(); }, [disconnect]);

  return {
    state,
    connect, disconnect,
    setMode,
    arm, disarm, eStop, fire,
    continuityCheck, queryWireless,
  };
}
