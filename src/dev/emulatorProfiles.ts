/**
 * Pre-built failure profiles for the TransportEmulator.
 * Each profile models a real-world transport pathology observed in field.
 *
 * Usage:
 *   import { TransportEmulator } from '@/dev/transportEmulator';
 *   import { EMU_PROFILES } from '@/dev/emulatorProfiles';
 *   const emu = new TransportEmulator(EMU_PROFILES.BLE_BAD);
 */
import type { EmulatorConfig } from './transportEmulator';

export const EMU_PROFILES = {
  /** Clean baseline — no chaos. */
  CLEAN:           { mode: 'normal',     latencyMs: 0,   jitterMs: 0,  lossRate: 0,    duplicateRate: 0 } satisfies EmulatorConfig,
  /** BLE in a noisy 2.4GHz environment (microwave, WiFi crowd). */
  BLE_BAD:         { mode: 'jitter',     latencyMs: 120, jitterMs: 80, lossRate: 0.20, duplicateRate: 0.05 } satisfies EmulatorConfig,
  /** Saturated WiFi AP — high packet loss, moderate latency. */
  WIFI_NOISY:      { mode: 'packet_loss',latencyMs: 40,  jitterMs: 15, lossRate: 0.35 } satisfies EmulatorConfig,
  /** ESP32 buffer overflow — produces truncated frames. */
  ESP32_OVERFLOW:  { mode: 'parse_garbage', latencyMs: 20, jitterMs: 5 } satisfies EmulatorConfig,
  /** Firmware bug flooding the line — validates rate limiter. */
  RETRY_STORM:     { mode: 'burst',      latencyMs: 5,  jitterMs: 2 } satisfies EmulatorConfig,
  /** Long-range BLE Coded PHY — high latency, low loss. */
  BLE_LR:          { mode: 'latency',    latencyMs: 280, jitterMs: 30, lossRate: 0.02 } satisfies EmulatorConfig,
  /** Out-of-order delivery typical of multi-path radio. */
  REORDER:         { mode: 'out_of_order', latencyMs: 30, jitterMs: 20 } satisfies EmulatorConfig,
} as const;

export type EmuProfileName = keyof typeof EMU_PROFILES;

export const EMU_PROFILE_DESCRIPTIONS: Record<EmuProfileName, string> = {
  CLEAN:          'Baseline — no transport chaos',
  BLE_BAD:        'BLE in noisy 2.4GHz (jitter + 20% loss)',
  WIFI_NOISY:     'Saturated WiFi AP (35% packet loss)',
  ESP32_OVERFLOW: 'ESP32 buffer overflow (truncated frames)',
  RETRY_STORM:    'Firmware flood (10× burst per response)',
  BLE_LR:         'BLE Coded PHY long-range (high latency)',
  REORDER:        'Multi-path reorder (out-of-order frames)',
};
