/**
 * SMPTE / LTC Timecode Engine — Legacy re-export shim.
 * All logic has been modularized into src/lib/smpte/*.
 * This file exists for backward compatibility.
 */

export {
  type SMPTEFrameRate,
  type SMPTETimecode,
  secondsToTimecode,
  secondsToTimecodeFast,
  timecodeToSeconds,
  formatTimecode,
  parseTimecode,
  copyTimecode,
} from './smpte/timecodeCore';

export {
  type LTCSignal,
  type MTCQuarterFrame,
  encodeTimecodeToLTC,
  generateMTCQuarterFrames,
} from './smpte/ltcEncoder';

export {
  type SMPTESyncState,
  DEFAULT_SYNC_STATE,
  updateSyncState,
  updateSyncStateInPlace,
  calculateDrift,
} from './smpte/syncEngine';

// Legacy compat — simulateSyncJitter
export function simulateSyncJitter(): number {
  return (Math.random() - 0.5) * 1.0;
}
