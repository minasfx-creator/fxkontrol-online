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
import { ReplayOverlay } from '@/components/editor/ReplayOverlay';
import { toast } from 'sonner';

const FLUSH_INTERVAL_TICKS = 1800; // ~30s at 60Hz

export default function EngineProvider() {
  useEffect(() => {
    let lastFlushTick = 0;

    // ── Boot: load persisted data ──
    (async () => {
      try {
        const [snapshots, logEntries] = await Promise.all([
          indexedDBPersistence.loadSnapshots(),
          indexedDBPersistence.loadCommandLog(),
        ]);
        if (snapshots.length > 0) {
          for (const snap of snapshots) {
            (snapshotManager as any)._snapshots.push(snap);
          }
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
    lockstep.register('snapshotManager', (_time: number, _dt: number) => {
      snapshotManager.maybeCapture(lockstep.getTickCount());
    }, 200);

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

    // ── Boot ──
    deterministicClock.start();
    lockstep.start();

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
      lockstep.stop();
      deterministicClock.pause();
      unsub();
      unsubRollback();
      unsubReplayStart();
      unsubReplayStop();
      unsubExport();
      unsubImport();
      lockstep.unregister('commandBus');
      lockstep.unregister('snapshotManager');
      lockstep.unregister('idbFlush');
      commandRelay.stop();
      safetyStateMachine.reset();
    };
  }, []);

  return <ReplayOverlay />;
}
