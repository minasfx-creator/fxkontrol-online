/**
 * ─── useFXK16Commands — Reactive typed command API for FXKPYRO ────
 * Wraps the singleton `FireOneHardwareBridge` (same one used by
 * `useFXK16Bridge`) with the typed `Fxk16CommandApi`. The ARM flag
 * is module-scoped so every panel sees the same state.
 *
 * Returns the API itself plus a reactive `armed` / `ready` snapshot
 * for rendering. Use `useFXK16Bridge` when you need raw status
 * (RSSI, transport, firmware) — use this hook when you want to *send
 * commands* with strong typing and structured error handling.
 */
import { useEffect, useState, useMemo } from 'react';
import { getFXK16Bridge } from '@/hooks/useFXK16Bridge';
import {
  createFxk16CommandApi,
  type Fxk16CommandApi,
} from '@/lib/fxk16/commandApi';

// Module-scoped singleton so ARM state is shared across all consumers.
let _api: Fxk16CommandApi | null = null;
const _armListeners = new Set<(armed: boolean) => void>();

function getApi(): Fxk16CommandApi {
  if (_api) return _api;
  _api = createFxk16CommandApi(getFXK16Bridge(), {
    onArmChange: (armed) => {
      _armListeners.forEach((fn) => {
        try { fn(armed); } catch { /* never break safety on listener errors */ }
      });
    },
  });
  return _api;
}

export interface UseFXK16CommandsApi {
  /** Typed command surface (stable identity). */
  api: Fxk16CommandApi;
  /** Reactive: bridge connected + FXK16 + healthy. */
  ready: boolean;
  /** Reactive: client-side ARM flag. */
  armed: boolean;
}

export function useFXK16Commands(): UseFXK16CommandsApi {
  const api = useMemo(() => getApi(), []);
  const [ready, setReady] = useState<boolean>(() => api.isReady());
  const [armed, setArmed] = useState<boolean>(() => api.isArmed());

  useEffect(() => {
    const onArm = (v: boolean) => setArmed(v);
    _armListeners.add(onArm);
    // Poll readiness from the bridge — cheap, decoupled from ARM events.
    const tick = setInterval(() => {
      setReady(api.isReady());
      setArmed(api.isArmed());
    }, 1000);
    return () => {
      _armListeners.delete(onArm);
      clearInterval(tick);
    };
  }, [api]);

  return { api, ready, armed };
}

/** Non-React accessor (for non-component code, tests, debug consoles). */
export function getFXK16CommandApi(): Fxk16CommandApi {
  return getApi();
}
