/**
 * useExternalSyncDiagnostics — explains *which* external sync is driving the
 * timeline and *why* local transport (Play/Pause/Seek) is overridden.
 *
 * Surfaces:
 *  - `isExternal`  — clock currently slaved to an external source.
 *  - `source`      — best-effort identification of the master ('SMPTE' | 'MTC' |
 *                    'OSC' | 'external' | null). Inferred from the SMPTE store
 *                    (slave + connected external WS bridge → SMPTE/MTC) and
 *                    falls back to the generic timelineClock `external` source
 *                    when no specific bridge is identifiable.
 *  - `running`     — master is actively producing timecode (recent packets).
 *  - `locked`      — clock has confirmed sync within the last second AND drift
 *                    is sub-frame, i.e. we are tracking the master cleanly.
 *  - `label`       — short pill label, e.g. `EXT · SMPTE locked`.
 *  - `description` — operator-facing tooltip explaining current state and
 *                    why local transport buttons are disabled.
 *
 * Pure read model — no side effects. Components subscribe and render.
 */
import { useEffect, useMemo, useState } from 'react';
import { timelineClock, type TimelineClockState } from '@/core/timeline/TimelineClock';
import { useSMPTEStore } from '@/store/useSMPTEStore';

export type ExternalSyncSource = 'SMPTE' | 'MTC' | 'OSC' | 'external' | null;

export interface ExternalSyncDiagnostics {
  isExternal: boolean;
  source: ExternalSyncSource;
  running: boolean;
  locked: boolean;
  label: string;
  description: string;
}

const LOCK_DRIFT_SEC = 0.04;       // <40ms ≈ sub-frame at 25fps
const LOCK_FRESHNESS_MS = 1000;    // last sync confirmed within 1s
const RUNNING_FRESHNESS_MS = 1500; // last packet within 1.5s

function inferSource(
  clockSource: TimelineClockState['source'],
  smpte: ReturnType<typeof useSMPTEStore.getState>,
): ExternalSyncSource {
  if (clockSource !== 'external') return null;
  if (smpte.externalEnabled && smpte.status === 'connected' && smpte.mode === 'slave') {
    // The WS bridge in this project carries SMPTE LTC frames primarily; MTC
    // would be flagged via a future `data.protocol` field. Default to SMPTE.
    return 'SMPTE';
  }
  return 'external';
}

function buildLabel(source: ExternalSyncSource, locked: boolean, running: boolean): string {
  if (!source) return 'EXT';
  if (source === 'external') return locked ? 'EXT · locked' : running ? 'EXT · live' : 'EXT';
  if (locked) return `EXT · ${source} locked`;
  if (running) return `EXT · ${source} live`;
  return `EXT · ${source}`;
}

function buildDescription(
  source: ExternalSyncSource,
  locked: boolean,
  running: boolean,
  driftSec: number,
): string {
  if (!source) return 'Timeline is driven locally.';
  const masterName = source === 'external' ? 'an external master' : `external ${source}`;
  if (!running) {
    return `Timeline is slaved to ${masterName}, but no recent timecode has been received. Local Play/Pause is disabled — restore the master signal or release external sync.`;
  }
  if (!locked) {
    const driftMs = Math.round(Math.abs(driftSec) * 1000);
    return `Timeline is following ${masterName} but is still chasing (drift ≈ ${driftMs} ms). Local Play/Pause is disabled until lock is acquired.`;
  }
  return `Timeline is locked to ${masterName}. Local Play/Pause is disabled — all transport is driven by the master.`;
}

function compute(
  state: TimelineClockState,
  smpte: ReturnType<typeof useSMPTEStore.getState>,
  now: number,
): ExternalSyncDiagnostics {
  const isExternal = state.source === 'external';
  const source = inferSource(state.source, smpte);

  const lastSync = state.lastExternalSync ?? 0;
  const lastPacket = smpte.lastPacketAt ?? 0;
  const lastActivity = Math.max(lastSync, lastPacket);

  const running = isExternal && lastActivity > 0 && now - lastActivity < RUNNING_FRESHNESS_MS;
  const locked =
    isExternal &&
    running &&
    lastSync > 0 &&
    now - lastSync < LOCK_FRESHNESS_MS &&
    Math.abs(state.driftSec) < LOCK_DRIFT_SEC;

  return {
    isExternal,
    source,
    running,
    locked,
    label: buildLabel(source, locked, running),
    description: buildDescription(source, locked, running, state.driftSec),
  };
}

export function useExternalSyncDiagnostics(): ExternalSyncDiagnostics {
  const [clockState, setClockState] = useState<TimelineClockState>(() => timelineClock.getState());
  const smpteSlice = useSMPTEStore((s) => ({
    externalEnabled: s.externalEnabled,
    status: s.status,
    mode: s.mode,
    lastPacketAt: s.lastPacketAt,
  }));

  useEffect(() => timelineClock.onChange(setClockState), []);

  // Re-evaluate freshness once per second so the chip de-locks when the master
  // signal goes silent even if no new clock event arrives.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => (t + 1) % 1_000_000), 500);
    return () => clearInterval(id);
  }, []);

  return useMemo(
    () => compute(clockState, useSMPTEStore.getState(), Date.now()),
    // smpteSlice is included so React re-renders when SMPTE store changes;
    // compute() reads the freshest snapshot from getState() to avoid stale closures.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [clockState, smpteSlice.externalEnabled, smpteSlice.status, smpteSlice.mode, smpteSlice.lastPacketAt],
  );
}
