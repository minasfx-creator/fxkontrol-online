/**
 * ─── Engine Provider ────────────────────────────────────────────────
 * React bridge that boots the deterministic kernel:
 *   DeterministicClock → LockstepEngine (60Hz fixed step)
 *   CommandBus drain runs at the top of each tick.
 *
 * Mount once at app root. Renders nothing.
 */

import { useEffect } from 'react';
import { deterministicClock } from '@/core/time/deterministicClock';
import { lockstep } from '@/core/reliability/lockstepEngine';
import { commandBus } from '@/core/command/CommandBus';

export default function EngineProvider() {
  useEffect(() => {
    // Register command processing as highest-priority subsystem
    lockstep.register('commandBus', (_time: number, _dt: number) => {
      const cmds = commandBus.drain();
      if (cmds.length > 0) {
        commandBus.applyAll(cmds);
      }
    }, 0); // priority 0 = runs first

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
      lockstep.unregister('commandBus');
    };
  }, []);

  return null;
}
