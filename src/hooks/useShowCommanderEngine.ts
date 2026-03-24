/**
 * ShowCommander Engine — State Lockdown, Dry Run, Heartbeat & Drift Test
 * Mission-critical integration layer for live show execution.
 */

import { useEffect, useCallback, useRef, useState } from 'react';
import { useProjectStore } from '@/store/useProjectStore';
import { toast } from 'sonner';

// ── Types ──────────────────────────────────────────────────────────
export interface CommanderEngineState {
  /** Frozen snapshot of timeline items (read-only during show) */
  frozenCues: readonly any[];
  /** Commander is active (keyboard lockdown enabled) */
  isLocked: boolean;
  /** DRY RUN mode — visual only, no hardware output */
  isDryRun: boolean;
  /** Master ARM state */
  isArmed: boolean;
  /** Network heartbeat status */
  linkStatus: 'stable' | 'degraded' | 'lost';
  /** RTT in ms */
  rtt: number;
  /** Timecode drift test active */
  driftTestActive: boolean;
  /** Current injected drift (ms) */
  injectedDrift: number;
}

// ── Keyboard Lockdown ──────────────────────────────────────────────
function useKeyboardLockdown(isLocked: boolean) {
  useEffect(() => {
    if (!isLocked) return;

    const blocker = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      // Block destructive editing shortcuts
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      if (ctrl && ['c', 'v', 'x', 'z', 'y', 'a', 'd'].includes(e.key.toLowerCase())) {
        // Allow Ctrl+C for copy (might be needed), block rest
        if (e.key.toLowerCase() !== 'c') {
          e.preventDefault();
          e.stopPropagation();
        }
      }
    };

    // Capture phase to intercept before other handlers
    window.addEventListener('keydown', blocker, true);
    return () => window.removeEventListener('keydown', blocker, true);
  }, [isLocked]);
}

// ── Network Heartbeat Simulation ───────────────────────────────────
function useHeartbeat() {
  const [linkStatus, setLinkStatus] = useState<'stable' | 'degraded' | 'lost'>('stable');
  const [rtt, setRtt] = useState(2.1);
  const reconnectRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      // Simulate realistic RTT with occasional spikes
      const base = 1.5 + Math.random() * 3;
      const spike = Math.random() < 0.03 ? 40 + Math.random() * 60 : 0;
      const newRtt = base + spike;
      setRtt(parseFloat(newRtt.toFixed(1)));

      if (newRtt > 50) {
        setLinkStatus('lost');
      } else if (newRtt > 20) {
        setLinkStatus('degraded');
      } else {
        setLinkStatus('stable');
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Fast reconnect when link lost
  useEffect(() => {
    if (linkStatus === 'lost') {
      if (!reconnectRef.current) {
        reconnectRef.current = setInterval(() => {
          // Simulated reconnect attempt
          const recovered = Math.random() > 0.3;
          if (recovered) {
            setLinkStatus('stable');
            setRtt(2.5);
            toast.success('LINK RESTORED — Conexão reestabelecida', { duration: 3000 });
            if (reconnectRef.current) {
              clearInterval(reconnectRef.current);
              reconnectRef.current = null;
            }
          }
        }, 500);
      }
    }
    return () => {
      if (reconnectRef.current && linkStatus !== 'lost') {
        clearInterval(reconnectRef.current);
        reconnectRef.current = null;
      }
    };
  }, [linkStatus]);

  return { linkStatus, rtt };
}

// ── Timecode Drift Test ────────────────────────────────────────────
function useDriftTest() {
  const [active, setActive] = useState(false);
  const [drift, setDrift] = useState(0);
  const driftRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startDriftTest = useCallback(() => {
    setActive(true);
    toast.warning('⚠️ DRIFT TEST ACTIVE — Injetando ±15ms de flutuação', { duration: 4000 });

    driftRef.current = setInterval(() => {
      // Inject ±15ms random drift
      const d = (Math.random() - 0.5) * 30; // ±15ms
      setDrift(parseFloat(d.toFixed(1)));

      // Apply drift to project time (smoothed)
      const store = useProjectStore.getState();
      if (store.isPlaying) {
        const driftSeconds = d / 1000;
        store.setCurrentTime(store.currentTime + driftSeconds);
      }
    }, 100);
  }, []);

  const stopDriftTest = useCallback(() => {
    setActive(false);
    setDrift(0);
    if (driftRef.current) {
      clearInterval(driftRef.current);
      driftRef.current = null;
    }
    toast.info('Drift test desativado');
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      if (driftRef.current) clearInterval(driftRef.current);
    };
  }, []);

  return { active, drift, startDriftTest, stopDriftTest };
}

// ── Main Hook ──────────────────────────────────────────────────────
export function useShowCommanderEngine() {
  const timelineItems = useProjectStore(s => s.timelineItems);
  const [isLocked, setIsLocked] = useState(false);
  const [isDryRun, setIsDryRun] = useState(false);
  const [isArmed, setIsArmed] = useState(false);
  const frozenCuesRef = useRef<readonly any[]>([]);

  // Freeze cues on lock
  const lockState = useCallback(() => {
    frozenCuesRef.current = Object.freeze([...timelineItems]);
    setIsLocked(true);
    toast.success('🔒 STATE LOCKED — Guião congelado, edição bloqueada', { duration: 5000 });
  }, [timelineItems]);

  const unlockState = useCallback(() => {
    setIsLocked(false);
    setIsArmed(false);
    toast.info('🔓 State unlocked — Edição permitida');
  }, []);

  // ARM gate
  const arm = useCallback(() => {
    if (!isLocked) {
      toast.error('Bloqueie o estado antes de armar (LOCK primeiro)');
      return;
    }
    setIsArmed(true);
    toast.warning('⚠️ MASTER ARMED — Sistema quente', { duration: 5000 });
  }, [isLocked]);

  const disarm = useCallback(() => {
    setIsArmed(false);
    toast.info('Master DISARMED');
  }, []);

  // DRY RUN toggle
  const toggleDryRun = useCallback(() => {
    setIsDryRun(prev => {
      const next = !prev;
      if (next) {
        toast.info('🎭 DRY RUN — Ensaio virtual ativo (hardware bloqueado)', { duration: 4000 });
      } else {
        toast.warning('DRY RUN desativado — Hardware LIVE');
      }
      return next;
    });
  }, []);

  // Can fire check (ARM gate + not dry run)
  const canSendToHardware = isArmed && !isDryRun;

  useKeyboardLockdown(isLocked);
  const { linkStatus, rtt } = useHeartbeat();
  const driftTest = useDriftTest();

  // Debug shortcut Alt+Shift+D for drift test
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.altKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        if (driftTest.active) {
          driftTest.stopDriftTest();
        } else {
          driftTest.startDriftTest();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [driftTest]);

  return {
    frozenCues: frozenCuesRef.current,
    isLocked,
    isDryRun,
    isArmed,
    linkStatus,
    rtt,
    driftTestActive: driftTest.active,
    injectedDrift: driftTest.drift,
    canSendToHardware,
    lockState,
    unlockState,
    arm,
    disarm,
    toggleDryRun,
    startDriftTest: driftTest.startDriftTest,
    stopDriftTest: driftTest.stopDriftTest,
  };
}
