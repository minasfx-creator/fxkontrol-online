/**
 * ─── Engine Provider ────────────────────────────────────────────────
 * React bridge that boots the deterministic kernel:
 *   DeterministicClock → LockstepEngine (60Hz fixed step)
 *   CommandBus drain → SafetyValidator gate → CommandLog recording
 *   SnapshotManager capture → CommandRelay broadcast
 *   IndexedDB persistence (boot load + periodic flush)
 *   SafetyAuditTrail (boot load + flush alongside snapshots)
 *
 * Mount once at app root. Renders ReplayOverlay when active.
 */

import { useEffect } from 'react';
import { useShowPlanSync } from '@/hooks/useShowPlanSync';
import { deterministicClock } from '@/core/time/deterministicClock';
import { lockstep } from '@/core/reliability/lockstepEngine';
import { commandBus } from '@/core/command/CommandBus';
import { commandLog } from '@/core/command/CommandLog';
import { snapshotManager } from '@/core/state/SnapshotManager';
import { replayEngine } from '@/core/engine/ReplayEngine';
import { commandRelay } from '@/core/sync/CommandRelay';
import { indexedDBPersistence } from '@/core/persistence/IndexedDBPersistence';
import { safetyValidator } from '@/core/safety/SafetyValidator';
import { safetyAuditTrail } from '@/core/safety/SafetyAuditTrail';
import { continuityCheckService } from '@/core/safety/ContinuityCheckService';
import { safetyStateMachine } from '@/core/safety/SafetyStateMachine';
import { startProfiler, stopProfiler } from '@/core/performance/PerformanceProfilerService';
import { networkHealthService } from '@/core/network/NetworkHealthService';
import { clusterHealthService } from '@/core/cluster/ClusterHealthService';
import { healthPersistenceService } from '@/core/cluster/HealthPersistenceService';
import { timelineClock } from '@/core/timeline/TimelineClock';
import { executionBridge } from '@/core/execution/executionBridge';
import { showPlanManager } from '@/core/showplan/ShowPlanManager';
import { pyroSchedulerBridge } from '@/hardware/integrations/pyroSchedulerBridge';
import '@/core/cluster/reporters/SafetyHealthReporter';
import '@/core/cluster/reporters/PerformanceHealthReporter';
import '@/core/cluster/reporters/NetworkHealthReporter';
import { autoRecoveryService } from '@/core/reliability/AutoRecoveryService';
import { ReplayOverlay } from '@/components/editor/ReplayOverlay';
import { useProjectStore } from '@/store/useProjectStore';
import { toast } from 'sonner';

const FLUSH_INTERVAL_TICKS = 1800; // ~30s at 60Hz

function safeBoot(label: string, fn: () => void): boolean {
  try { fn(); return true; }
  catch (e) {
    console.error(`[EngineProvider] ${label} failed:`, e);
    clusterHealthService.reportBootFailure(label, String(e));
    toast.error(`⚠ ${label} falhou no boot — sistema degradado`);
    return false;
  }
}

export default function EngineProvider() {
  const projectId = useProjectStore((s) => s.projectId);

  // ── ShowPlan ↔ ProjectStore live sync ──
  useShowPlanSync();

  useEffect(() => {
    healthPersistenceService.setProjectId(projectId);
  }, [projectId]);

  useEffect(() => {
    let lastFlushTick = 0;
    let lastShowPlanSignature = '';

    // ── Boot: load persisted data ──
    (async () => {
      try {
        const [snapshots, logEntries] = await Promise.all([
          indexedDBPersistence.loadSnapshots(),
          indexedDBPersistence.loadCommandLog(),
        ]);
        if (snapshots.length > 0) {
          snapshotManager.importSnapshots(snapshots);
          console.log(`[EngineProvider] Restored ${snapshots.length} snapshots from IndexedDB`);
        }
        if (logEntries.length > 0) {
          commandLog.importJSON(JSON.stringify(logEntries));
          console.log(`[EngineProvider] Restored ${logEntries.length} command log entries from IndexedDB`);
        }
        // Load safety audit trail
        await safetyAuditTrail.load();
      } catch (e) {
        console.warn('[EngineProvider] Failed to load persisted data:', e);
        clusterHealthService.reportBootFailure('IndexedDB', String(e));
      }
    })();

    // ── Register ROLLBACK handler ──
    const unsubRollback = commandBus.on('ROLLBACK', (cmd) => {
      if (cmd.type === 'ROLLBACK') {
        replayEngine.rollback(cmd.targetTick);
      }
    });

    // ── Register REPLAY handlers ──
    const unsubReplayStart = commandBus.on('REPLAY_START', (cmd) => {
      if (cmd.type === 'REPLAY_START') {
        replayEngine.startReplay(cmd.fromTick, cmd.toTick);
      }
    });
    const unsubReplayStop = commandBus.on('REPLAY_STOP', () => {
      replayEngine.stop();
    });

    // ── Register EXPORT/IMPORT handlers ──
    const unsubExport = commandBus.on('EXPORT_LOG', () => {
      const json = commandLog.exportJSON();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fxk-session-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });

    const unsubImport = commandBus.on('IMPORT_LOG', (cmd) => {
      if (cmd.type === 'IMPORT_LOG') {
        commandLog.importJSON(cmd.json);
      }
    });

    // ── Register CONTINUITY_CHECK handler ──
    const unsubContinuity = commandBus.on('CONTINUITY_CHECK', () => {
      continuityCheckService.runFullCheck();
    });

    // ── Command processing subsystem (priority 0) ──
    // Safety validator gates commands before they reach handlers
    lockstep.register('commandBus', (_time: number, _dt: number) => {
      const cmds = commandBus.drain();
      if (cmds.length > 0) {
        const tick = lockstep.getTickCount();
        const SKIP = new Set(['ROLLBACK', 'REPLAY_START', 'REPLAY_STOP', 'REPLAY_SPEED', 'EXPORT_LOG', 'IMPORT_LOG']);

        // Filter through safety validator
        const allowed: typeof cmds = [];
        for (let i = 0; i < cmds.length; i++) {
          const result = safetyValidator.validate(cmds[i], tick);
          if (result.allowed) {
            allowed.push(cmds[i]);
          } else {
            console.warn(`[SafetyValidator] DENIED: ${cmds[i].type} — ${result.reason}`);
            toast.error(`⛔ ${cmds[i].type} bloqueado: ${result.reason}`, { duration: 4000 });
          }
        }

        // Apply allowed commands
        if (allowed.length > 0) {
          commandBus.applyAll(allowed);
          for (let i = 0; i < allowed.length; i++) {
            if (!SKIP.has(allowed[i].type)) {
              commandLog.record(tick, allowed[i]);
            }
          }
          for (let i = 0; i < allowed.length; i++) {
            commandRelay.relayOutgoing(allowed[i]);
          }
        }
      }
    }, 0);

    // ── Snapshot subsystem (priority 200) ──
    lockstep.register('timelineClock', (_time: number, dt: number) => {
      timelineClock.tick(dt);
    }, 100);

    // SOLE owner of the 'executionBridge' lockstep system. SkyCanvas used to
    // register a second one — do not re-introduce that. Keep registration
    // here so it follows the EngineProvider lifecycle (mount/unmount).
    lockstep.register('executionBridge', (_time: number, _dt: number) => {
      const plan = showPlanManager.current;
      const signature = `${plan.metadata.id}:${plan.metadata.updatedAt}:${plan.pyroCues.length}:${plan.dmxCues.length}:${plan.dronePaths.length}`;
      if (signature !== lastShowPlanSignature) {
        executionBridge.loadShowPlan(plan);
        lastShowPlanSignature = signature;
      }

      executionBridge.tick(timelineClock.getTime());
    }, 150);

    lockstep.register('pyroSchedulerBridge', (_time: number, _dt: number) => {
      pyroSchedulerBridge.tick(timelineClock.getState());
    }, 160);

    lockstep.register('snapshotManager', (_time: number, _dt: number) => {
      snapshotManager.maybeCapture(lockstep.getTickCount());
    }, 200);

    lockstep.setEnabled('timelineClock', true);

    // ── IndexedDB flush subsystem (priority 300) ──
    lockstep.register('idbFlush', (_time: number, _dt: number) => {
      const tick = lockstep.getTickCount();
      if (tick - lastFlushTick >= FLUSH_INTERVAL_TICKS) {
        lastFlushTick = tick;
        indexedDBPersistence.persistSnapshots(snapshotManager.getAll());
        indexedDBPersistence.persistCommandLog(commandLog.getLog());
        safetyAuditTrail.persist();
      }
    }, 300);

    // ── Connect clock → lockstep ──
    const unsub = deterministicClock.onTick((_time: number, delta: number) => {
      lockstep.tick(delta);
    });

    // ── RAF pump (independent of R3F) ──
    // Drives deterministicClock even when no <Canvas> is mounted/visible,
    // so timeline play works on every route and survives WebGL context loss.
    let rafId = 0;
    const pump = () => {
      deterministicClock.tick();
      rafId = requestAnimationFrame(pump);
    };
    rafId = requestAnimationFrame(pump);

    // Pause pump when tab is hidden to save battery; resume on visible.
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        if (rafId) cancelAnimationFrame(rafId);
        rafId = 0;
      } else if (rafId === 0) {
        rafId = requestAnimationFrame(pump);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    // ── Register recoverable services ──
    const initialProjectId = useProjectStore.getState().projectId;
    const bootFns: Record<string, () => void> = {
      DeterministicClock: () => deterministicClock.start(),
      LockstepEngine: () => lockstep.start(),
      PerformanceProfiler: () => startProfiler(),
      NetworkHealth: () => networkHealthService.start(),
      HealthPersistence: () => healthPersistenceService.start(initialProjectId),
    };
    for (const [label, fn] of Object.entries(bootFns)) {
      autoRecoveryService.register(label, fn);
    }

    // ── Boot (isolated per service, auto-recovery on failure) ──
    const bootResults: Record<string, boolean> = {};
    for (const [label, fn] of Object.entries(bootFns)) {
      const ok = safeBoot(label, fn);
      bootResults[label] = ok;
      if (!ok) autoRecoveryService.scheduleRecovery(label);
    }
    console.log('[EngineProvider] Boot complete —', Object.entries(bootResults).map(([k,v]) => `${k}:${v}`).join(' '));

    // ── Flush on page unload ──
    const handleBeforeUnload = () => {
      indexedDBPersistence.persistSnapshots(snapshotManager.getAll());
      indexedDBPersistence.persistCommandLog(commandLog.getLog());
      safetyAuditTrail.persist();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      handleBeforeUnload();
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibility);
      if (rafId) cancelAnimationFrame(rafId);
      autoRecoveryService.dispose();
      clusterHealthService.dispose();
      if (bootResults['HealthPersistence']) healthPersistenceService.stop();
      if (bootResults['NetworkHealth']) networkHealthService.stop();
      if (bootResults['PerformanceProfiler']) stopProfiler();
      if (bootResults['LockstepEngine']) lockstep.stop();
      if (bootResults['DeterministicClock']) deterministicClock.pause();
      unsub();
      unsubRollback();
      unsubReplayStart();
      unsubReplayStop();
      unsubExport();
      unsubImport();
      unsubContinuity();
      lockstep.unregister('commandBus');
      lockstep.unregister('timelineClock');
      lockstep.unregister('executionBridge');
      lockstep.unregister('pyroSchedulerBridge');
      lockstep.unregister('snapshotManager');
      lockstep.unregister('idbFlush');
      commandRelay.stop();
      pyroSchedulerBridge.reset();
      safetyStateMachine.reset();
      console.log('[EngineProvider] All services stopped');
    };
  }, []);

  return <ReplayOverlay />;
}
