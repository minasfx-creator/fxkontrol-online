/**
 * ─── Engine Provider ────────────────────────────────────────────────
 * React bridge that boots the deterministic kernel:
 *   DeterministicClock → LockstepEngine (60Hz fixed step)
 *   CommandBus drain → CommandLog recording → SnapshotManager capture
 *   CommandRelay (outgoing broadcast to peers)
 *   IndexedDB persistence (boot load + periodic flush)
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
import { ReplayOverlay } from '@/components/editor/ReplayOverlay';

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
          // Restore snapshots into manager via internal access
          for (const snap of snapshots) {
            (snapshotManager as any)._snapshots.push(snap);
          }
          console.log(`[EngineProvider] Restored ${snapshots.length} snapshots from IndexedDB`);
        }
        if (logEntries.length > 0) {
          commandLog.importJSON(JSON.stringify(logEntries));
          console.log(`[EngineProvider] Restored ${logEntries.length} command log entries from IndexedDB`);
        }
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

    // ── Command processing subsystem (priority 0) ──
    lockstep.register('commandBus', (_time: number, _dt: number) => {
      const cmds = commandBus.drain();
      if (cmds.length > 0) {
        commandBus.applyAll(cmds);
        const tick = lockstep.getTickCount();
        const SKIP = new Set(['ROLLBACK', 'REPLAY_START', 'REPLAY_STOP', 'REPLAY_SPEED', 'EXPORT_LOG', 'IMPORT_LOG']);
        for (let i = 0; i < cmds.length; i++) {
          if (!SKIP.has(cmds[i].type)) {
            commandLog.record(tick, cmds[i]);
          }
        }
        for (let i = 0; i < cmds.length; i++) {
          commandRelay.relayOutgoing(cmds[i]);
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
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      // Final flush
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
    };
  }, []);

  return <ReplayOverlay />;
}
