/**
 * TimelineWaveformTab — legacy AudioWaveform surfaced as Timeline tab.
 * pixelsPerSecond is a sensible default; AudioWaveform binds to useProjectStore
 * for time/duration/audio metadata. Pure presentation, zero command dispatch.
 */
import AudioWaveform from '@/components/editor/AudioWaveform';

const DEFAULT_PPS = 80;

export default function TimelineWaveformTab() {
  return (
    <div className="h-full overflow-hidden" data-tab-id="timeline-waveform">
      <AudioWaveform pixelsPerSecond={DEFAULT_PPS} />
    </div>
  );
}
