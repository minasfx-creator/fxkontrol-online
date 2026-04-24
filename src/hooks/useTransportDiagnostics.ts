/**
 * useTransportDiagnostics — single source of truth for the transport status
 * chip (`0×` / `END` / `EXT`) and the "why didn't Play move?" toast.
 *
 * - `chip` reflects the *current* non-obvious transport state, refreshed on
 *   every clock change so the desktop Timeline and the MobileHUD stay in sync.
 * - `playWithFeedback()` wraps `timelineTransport.play()` and consumes the
 *   last auto-correction (`speed` → "restored to 1×" / `rewind` → "rewound to 0")
 *   so the operator immediately understands why Play just behaved "weirdly".
 * - `toggleWithFeedback()` is the same logic for the Play/Pause button.
 *
 * Intentionally hook-only (no UI). Keep the chip rendering in each surface
 * so each panel can style it natively (status-pill on mobile, inline pill on
 * desktop), but the *meaning* lives here.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { timelineClock, type TimelineClockState } from '@/core/timeline/TimelineClock';
import { timelineTransport } from '@/core/transport/timelineTransport';
import { useExternalSyncDiagnostics, type ExternalSyncDiagnostics } from '@/hooks/useExternalSyncDiagnostics';

export type TransportChipTone = 'warning' | 'accent';

export interface TransportChip {
  /** Short label for the pill, e.g. "0×", "END", "EXT". */
  label: string;
  /** Visual tone — "warning" (yellow) for blockers, "accent" (cyan) for info. */
  tone: TransportChipTone;
  /** Long-form tooltip / a11y label explaining why the chip is showing. */
  reason: string;
}

const END_EPSILON = 0.001;

function deriveChip(state: TimelineClockState, ext?: ExternalSyncDiagnostics): TransportChip | null {
  if (state.source === 'external') {
    return {
      label: ext?.label ?? 'EXT',
      tone: 'accent',
      reason: ext?.description ?? 'Timeline driven by external sync. Local Play is overridden.',
    };
  }
  if (!Number.isFinite(state.speed) || state.speed < 0.05) {
    return {
      label: '0×',
      tone: 'warning',
      reason: 'Playback speed is 0×. Press Play to auto-restore the last valid speed.',
    };
  }
  if (state.duration > 0 && state.time >= state.duration - END_EPSILON) {
    return {
      label: 'END',
      tone: 'warning',
      reason: 'Timeline is at the end. Press Play to rewind to 00:00 and start over.',
    };
  }
  return null;
}

export function useTransportDiagnostics() {
  const ext = useExternalSyncDiagnostics();
  const [clockState, setClockState] = useState<TimelineClockState>(() => timelineClock.getState());

  useEffect(() => timelineClock.onChange(setClockState), []);

  const chip = useMemo(() => deriveChip(clockState, ext), [clockState, ext]);

  const flushAutoCorrection = useCallback(() => {
    const correction = timelineTransport.consumeLastAutoCorrection();
    if (correction === 'speed') {
      toast.message('▶ Speed restored', {
        description: `Playback was at 0×. Resumed at ${timelineTransport.getLastValidSpeed().toFixed(2)}×.`,
      });
    } else if (correction === 'rewind') {
      toast.message('▶ Rewound to start', {
        description: 'Timeline was at the end — playback restarted from 00:00.',
      });
    }
  }, []);

  const playWithFeedback = useCallback(() => {
    timelineTransport.play();
    flushAutoCorrection();
  }, [flushAutoCorrection]);

  const toggleWithFeedback = useCallback(() => {
    const wasPlaying = timelineClock.isPlaying();
    timelineTransport.toggle();
    if (!wasPlaying) flushAutoCorrection();
  }, [flushAutoCorrection]);

  return useMemo(() => ({
    chip,
    play: playWithFeedback,
    toggle: toggleWithFeedback,
  }), [chip, playWithFeedback, toggleWithFeedback]);
}
