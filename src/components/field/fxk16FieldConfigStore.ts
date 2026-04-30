/**
 * fxk16FieldConfigStore — Persisted per-operator configuration for the
 * FXK16 FieldTest harness. Survives reloads (localStorage) and is shared
 * across the FieldTest panel and the /field#fxk16 tab through a tiny
 * subscribe/snapshot store (no Zustand dep).
 *
 * NEVER persists ARM state — that is session-scoped by design (safety).
 */
export type Fxk16TransportPref = 'auto' | 'usb' | 'ble';
export type Fxk16TestMode = 'manual' | 'self_test' | 'continuity_sweep' | 'burst';

export interface Fxk16FieldConfig {
  /** Selected device canonical key from portRegistry, or null = "first available". */
  deviceKey: string | null;
  /** Preferred transport when (re)connecting. */
  transport: Fxk16TransportPref;
  /** Test mode driving the harness UI. */
  mode: Fxk16TestMode;
  /** Default fire pulse duration (ms). 1..10000. */
  durationMs: number;
  /** Default single-fire channel (1..16). */
  defaultChannel: number;
  /** Continuity Sweep: ms between channels. */
  sweepIntervalMs: number;
  /** Burst: number of repeats. */
  burstRepeat: number;
  /** Burst: ms between repeats on the same channel. */
  burstIntervalMs: number;
  /** Auto-disarm timeout after the last command (ms). 0 = disabled. */
  autoDisarmAfterMs: number;
  /** Confirm batch fires with an extra tap. */
  confirmBatch: boolean;
}

const STORAGE_KEY = 'fxk16:field:config:v1';

const DEFAULTS: Fxk16FieldConfig = {
  deviceKey: null,
  transport: 'auto',
  mode: 'manual',
  durationMs: 50,
  defaultChannel: 1,
  sweepIntervalMs: 250,
  burstRepeat: 3,
  burstIntervalMs: 200,
  autoDisarmAfterMs: 30_000,
  confirmBatch: true,
};

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, Math.round(n)));
}

function sanitize(raw: Partial<Fxk16FieldConfig>): Fxk16FieldConfig {
  return {
    deviceKey: typeof raw.deviceKey === 'string' && raw.deviceKey.length > 0 ? raw.deviceKey : null,
    transport: raw.transport === 'usb' || raw.transport === 'ble' ? raw.transport : 'auto',
    mode: raw.mode === 'self_test' || raw.mode === 'continuity_sweep' || raw.mode === 'burst'
      ? raw.mode
      : 'manual',
    durationMs: clamp(raw.durationMs ?? DEFAULTS.durationMs, 1, 10_000),
    defaultChannel: clamp(raw.defaultChannel ?? DEFAULTS.defaultChannel, 1, 16),
    sweepIntervalMs: clamp(raw.sweepIntervalMs ?? DEFAULTS.sweepIntervalMs, 50, 5_000),
    burstRepeat: clamp(raw.burstRepeat ?? DEFAULTS.burstRepeat, 1, 50),
    burstIntervalMs: clamp(raw.burstIntervalMs ?? DEFAULTS.burstIntervalMs, 50, 5_000),
    autoDisarmAfterMs: clamp(raw.autoDisarmAfterMs ?? DEFAULTS.autoDisarmAfterMs, 0, 600_000),
    confirmBatch: typeof raw.confirmBatch === 'boolean' ? raw.confirmBatch : DEFAULTS.confirmBatch,
  };
}

let _state: Fxk16FieldConfig = (() => {
  if (typeof window === 'undefined') return { ...DEFAULTS };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? sanitize(JSON.parse(raw)) : { ...DEFAULTS };
  } catch {
    return { ...DEFAULTS };
  }
})();

const _listeners = new Set<(c: Fxk16FieldConfig) => void>();

function persist(): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(_state)); } catch { /* quota — ignore */ }
}

export const fxk16FieldConfig = {
  get(): Fxk16FieldConfig {
    return _state;
  },
  set(patch: Partial<Fxk16FieldConfig>): Fxk16FieldConfig {
    _state = sanitize({ ..._state, ...patch });
    persist();
    _listeners.forEach((fn) => { try { fn(_state); } catch { /* listener safety */ } });
    return _state;
  },
  reset(): Fxk16FieldConfig {
    _state = { ...DEFAULTS };
    persist();
    _listeners.forEach((fn) => { try { fn(_state); } catch { /* */ } });
    return _state;
  },
  subscribe(fn: (c: Fxk16FieldConfig) => void): () => void {
    _listeners.add(fn);
    return () => { _listeners.delete(fn); };
  },
};

export const FXK16_FIELD_CONFIG_DEFAULTS = DEFAULTS;
