/**
 * Unified Haptic Feedback Service
 * Uses Capacitor Haptics on native iOS/Android, falls back to navigator.vibrate on web.
 */
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

const isNative = () => Capacitor.isNativePlatform();

const webVibrate = (pattern: number | number[]) => {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate(pattern);
  }
};

export const haptics = {
  /** Light tap — UI button press */
  tap: async () => {
    if (isNative()) {
      await Haptics.impact({ style: ImpactStyle.Light });
    } else {
      webVibrate(10);
    }
  },

  /** Selection change — list items, filters */
  select: async () => {
    if (isNative()) {
      await Haptics.selectionChanged();
    } else {
      webVibrate(15);
    }
  },

  /** Heavy impact — cue fire, trigger */
  fire: async () => {
    if (isNative()) {
      await Haptics.impact({ style: ImpactStyle.Heavy });
    } else {
      webVibrate(30);
    }
  },

  /** Medium impact — toggle, key switch */
  toggle: async () => {
    if (isNative()) {
      await Haptics.impact({ style: ImpactStyle.Medium });
    } else {
      webVibrate(20);
    }
  },

  /** Warning pattern — system arm */
  arm: async () => {
    if (isNative()) {
      await Haptics.notification({ type: NotificationType.Warning });
      setTimeout(() => Haptics.impact({ style: ImpactStyle.Heavy }), 80);
    } else {
      webVibrate([50, 30, 50]);
    }
  },

  /** Error pattern — emergency stop / panic */
  panic: async () => {
    if (isNative()) {
      await Haptics.notification({ type: NotificationType.Error });
      setTimeout(() => Haptics.impact({ style: ImpactStyle.Heavy }), 100);
      setTimeout(() => Haptics.impact({ style: ImpactStyle.Heavy }), 200);
    } else {
      webVibrate([100, 50, 100, 50, 200]);
    }
  },

  /** Double medium — safety unlock */
  unlock: async () => {
    if (isNative()) {
      await Haptics.impact({ style: ImpactStyle.Medium });
      setTimeout(() => Haptics.impact({ style: ImpactStyle.Medium }), 60);
    } else {
      webVibrate([50, 20, 50]);
    }
  },

  /** Success notification — connection established */
  success: async () => {
    if (isNative()) {
      await Haptics.notification({ type: NotificationType.Success });
    } else {
      webVibrate(50);
    }
  },

  /** Disarm — light confirmation */
  disarm: async () => {
    if (isNative()) {
      await Haptics.impact({ style: ImpactStyle.Light });
    } else {
      webVibrate(20);
    }
  },

  /** Show mode toggle pattern */
  showMode: async (entering: boolean) => {
    if (isNative()) {
      if (entering) {
        await Haptics.notification({ type: NotificationType.Warning });
      } else {
        await Haptics.impact({ style: ImpactStyle.Light });
      }
    } else {
      webVibrate(entering ? [50, 30, 50] : [30]);
    }
  },

  /** Deadman held */
  deadman: async () => {
    if (isNative()) {
      await Haptics.impact({ style: ImpactStyle.Heavy });
    } else {
      webVibrate([100]);
    }
  },

  /** Arm all pattern (stronger) */
  armAll: async () => {
    if (isNative()) {
      await Haptics.notification({ type: NotificationType.Warning });
      setTimeout(() => Haptics.impact({ style: ImpactStyle.Heavy }), 80);
      setTimeout(() => Haptics.impact({ style: ImpactStyle.Heavy }), 180);
    } else {
      webVibrate([50, 30, 50, 30, 100]);
    }
  },

  /** Drag start — subtle hold feedback */
  dragStart: async () => {
    if (isNative()) {
      await Haptics.impact({ style: ImpactStyle.Light });
    } else {
      webVibrate(8);
    }
  },

  /** Drag end — snap confirmation */
  dragEnd: async () => {
    if (isNative()) {
      await Haptics.impact({ style: ImpactStyle.Medium });
    } else {
      webVibrate(15);
    }
  },

  /** AR mode toggle */
  arToggle: async (entering: boolean) => {
    if (isNative()) {
      if (entering) {
        await Haptics.notification({ type: NotificationType.Success });
        setTimeout(() => Haptics.impact({ style: ImpactStyle.Light }), 60);
      } else {
        await Haptics.impact({ style: ImpactStyle.Light });
      }
    } else {
      webVibrate(entering ? [30, 20, 30] : [20]);
    }
  },

  /** Panel minimize/maximize */
  panelToggle: async () => {
    if (isNative()) {
      await Haptics.impact({ style: ImpactStyle.Light });
    } else {
      webVibrate(10);
    }
  },

  /** Calibration complete ping */
  calibrationPing: async () => {
    if (isNative()) {
      await Haptics.notification({ type: NotificationType.Success });
    } else {
      webVibrate([20, 10, 20]);
    }
  },

  // ═══ New Gamification Feedbacks ═══════════════════════════════════

  /** Safety lock achieved — NFPA 1123 clearance validated */
  safetyLock: async () => {
    if (isNative()) {
      await Haptics.notification({ type: NotificationType.Success });
      setTimeout(() => Haptics.impact({ style: ImpactStyle.Light }), 40);
      setTimeout(() => Haptics.impact({ style: ImpactStyle.Light }), 100);
    } else {
      webVibrate([15, 10, 15, 10, 30]);
    }
  },

  /** Collision warning — drone/position overlap detected */
  collisionWarn: async () => {
    if (isNative()) {
      await Haptics.notification({ type: NotificationType.Warning });
      setTimeout(() => Haptics.impact({ style: ImpactStyle.Medium }), 60);
    } else {
      webVibrate([40, 20, 40]);
    }
  },

  /** Magnetic snap — item snapped to beat/edge */
  magneticSnap: async () => {
    if (isNative()) {
      await Haptics.impact({ style: ImpactStyle.Light });
    } else {
      webVibrate(6);
    }
  },

  /** Repulsion — invalid placement rejected */
  repulsion: async () => {
    if (isNative()) {
      await Haptics.impact({ style: ImpactStyle.Medium });
      setTimeout(() => Haptics.impact({ style: ImpactStyle.Light }), 40);
    } else {
      webVibrate([25, 15, 10]);
    }
  },

  /** Track lock toggled */
  trackLock: async () => {
    if (isNative()) {
      await Haptics.impact({ style: ImpactStyle.Medium });
    } else {
      webVibrate(12);
    }
  },

  /** Milestone achieved — 100% safety clearance, etc. */
  milestone: async () => {
    if (isNative()) {
      await Haptics.notification({ type: NotificationType.Success });
      setTimeout(() => Haptics.impact({ style: ImpactStyle.Medium }), 80);
      setTimeout(() => Haptics.impact({ style: ImpactStyle.Light }), 160);
    } else {
      webVibrate([30, 20, 30, 20, 50]);
    }
  },
};
