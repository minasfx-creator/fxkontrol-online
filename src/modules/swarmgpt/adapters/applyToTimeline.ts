/**
 * SwarmGPT 2.0 — Generic timeline adapter.
 * Intentionally decoupled from the project store. Caller provides the bridge.
 */
import type { TimelineCue } from '../types';

export interface ExistingTimelineAdapter {
  clearGeneratedCues?: () => void;
  addCue: (cue: TimelineCue) => void;
}

export function applySwarmGPTCuesToTimeline(
  cues: TimelineCue[],
  timeline: ExistingTimelineAdapter,
  options?: { replaceGenerated?: boolean },
): void {
  if (options?.replaceGenerated && timeline.clearGeneratedCues) {
    timeline.clearGeneratedCues();
  }
  for (const cue of cues) {
    timeline.addCue(cue);
  }
}
