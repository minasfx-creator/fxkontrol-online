/**
 * ─── Engine Provider ────────────────────────────────────────────────
 * React bridge that boots the deterministic kernel:
 *   DeterministicClock → LockstepEngine (60Hz fixed step)
 *   CommandBus drain → CommandLog recording → SnapshotManager capture
 *   CommandRelay (outgoing broadcast to peers)
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
import { ReplayOverlay } from '@/components/editor/ReplayOverlay';

export default function EngineProvider() {
  useEffect(() => {
    // Register ROLLBACK handler
    const unsubRollback = commandBus.on('ROLLBACK', (cmd) => {
      if (cmd.type === 'ROLLBACK') {
        replayEngine.rollback(cmd.targetTick);
      }
    });

    // Register REPLAY handlers
    const unsubReplayStart = commandBus.on('REPLAY_START', (cmd) => {
      if (cmd.type === 'REPLAY_START') {
        replayEngine.startReplay(cmd.fromTick, cmd.toTick);
      }
    });
    const unsubReplayStop = commandBus.on('REPLAY_STOP', () => {
      replayEngine.stop();
    });

    // Register command processing as highest-priority subsystem
    lockstep.register('commandBus', (_time: number, _dt: number) => {
      const cmds = commandBus.drain();
      if (cmds.length > 0) {
        commandBus.applyAll(cmds);
        // Record to log (skip ROLLBACK/REPLAY commands to avoid recursion)
        const tick = lockstep.getTickCount();
        const SKIP = new Set(['ROLLBACK', 'REPLAY_START', 'REPLAY_STOP', 'REPLAY_SPEED']);
        for (let i = 0; i < cmds.length; i++) {
          if (!SKIP.has(cmds[i].type)) {
            commandLog.record(tick, cmds[i]);
          }
        }
        // Relay outgoing commands to peers
        for (let i = 0; i < cmds.length; i++) {
          commandRelay.relayOutgoing(cmds[i]);
        }
      }
    }, 0); // priority 0 = runs first

    // Register snapshot subsystem (low priority, runs after everything)
    lockstep.register('snapshotManager', (_time: number, _dt: number) => {
      snapshotManager.maybeCapture(lockstep.getTickCount());
    }, 200);

    // Connect clock → lockstep
    const unsub = deterministicClock.onTick((_time: number, delta: number) => {
      lockstep.tick(delta);
    });

    // Boot
    deterministicClock.start();
    lockstep.start();

    return () => {
      lockstep.stop();
      deterministicClock.pause();
      unsub();
      unsubRollback();
      unsubReplayStart();
      unsubReplayStop();
      lockstep.unregister('commandBus');
      lockstep.unregister('snapshotManager');
      commandRelay.stop();
    };
  }, []);

  return <ReplayOverlay />;
}
