/**
 * SMPTE Module — unified re-export for backward compatibility.
 * All sub-modules are tree-shakeable.
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
} from './timecodeCore';

export {
  type LTCSignal,
  type MTCQuarterFrame,
  encodeTimecodeToLTC,
  generateMTCQuarterFrames,
} from './ltcEncoder';

export {
  type SMPTESyncState,
  DEFAULT_SYNC_STATE,
  updateSyncState,
  updateSyncStateInPlace,
  calculateDrift,
} from './syncEngine';
