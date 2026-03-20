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
};
