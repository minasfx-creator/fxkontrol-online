/**
 * ─── dmxQuickActions — DMX/Art-Net quick safety actions ────────────
 * Thin wrapper over `dmxUniverseManager` + `artNetBridge` that the
 * auto-controller card uses for one-shot operator gestures:
 *   • blackout(universe?)  — zero a universe (or all). Critical send.
 *   • holdOn100(universe, durationMs) — temporarily snap every channel
 *     to 255 then return to 0. Useful for "is the cable hot?" testing.
 *
 * Every action records a `blackbox` event for the 100ms incident log.
 * Honest-hardware: when no universe is registered yet, holdOn100 is a
 * no-op that returns `{ ok: false, code: 'NO_UNIVERSE' }` instead of
 * silently doing nothing.
 */
import { dmxUniverseManager } from '@/core/protocols/DMXUniverseManager';
import { blackbox } from '@/core/reliability/blackBoxRecorder';

export type DmxActionResult =
  | { ok: true }
  | { ok: false; code: 'NO_UNIVERSE'; message: string };

export const dmxQuickActions = {
  /** Blackout one universe, or all when `universe` is undefined. */
  blackout(universe?: number): DmxActionResult {
    const universes = dmxUniverseManager.getUniverses();
    if (universes.length === 0) {
      return {
        ok: false,
        code: 'NO_UNIVERSE',
        message: 'Nenhum universo DMX registrado',
      };
    }
    if (typeof universe === 'number') {
      dmxUniverseManager.blackout(universe);
      dmxUniverseManager.flush();
      blackbox.record('cmd', `dmxQuickActions: blackout universe ${universe}`);
    } else {
      dmxUniverseManager.blackoutAll();
      blackbox.record('cmd', 'dmxQuickActions: blackout ALL universes');
    }
    return { ok: true };
  },

  /**
   * Snap every channel of a universe to 255 for `durationMs` then
   * return to 0. Critical sends (bypass 33 PPS rate cap).
   */
  holdOn100(universe: number, durationMs = 1000): DmxActionResult {
    const buf = dmxUniverseManager.getBuffer(universe);
    if (!buf) {
      return {
        ok: false,
        code: 'NO_UNIVERSE',
        message: `Universo ${universe} não registrado`,
      };
    }
    const allOn = new Array(buf.length).fill(255);
    dmxUniverseManager.setChannels(universe, 1, allOn);
    dmxUniverseManager.blackout(universe); // marks critical so flush bypass
    // Re-write 255 because blackout zeroed the buffer:
    dmxUniverseManager.setChannels(universe, 1, allOn);
    dmxUniverseManager.flush();
    blackbox.record('cmd', `dmxQuickActions: holdOn100 universe ${universe} (${durationMs}ms)`);

    setTimeout(() => {
      dmxUniverseManager.blackout(universe);
      dmxUniverseManager.flush();
      blackbox.record('cmd', `dmxQuickActions: holdOn100 release universe ${universe}`);
    }, durationMs);

    return { ok: true };
  },

  /** List universes currently registered (for the card's selector). */
  listUniverses(): Array<{ id: number; label: string }> {
    return dmxUniverseManager.getUniverses().map((u) => ({ id: u.id, label: u.label }));
  },
};
