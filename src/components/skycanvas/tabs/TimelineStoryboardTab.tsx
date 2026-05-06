/**
 * TimelineStoryboardTab — legacy StoryboardPanel surfaced as Timeline tab.
 */
import StoryboardPanel from '@/components/editor/StoryboardPanel';

export default function TimelineStoryboardTab() {
  return (
    <div className="h-full overflow-hidden" data-tab-id="timeline-storyboard">
      <StoryboardPanel onClose={() => { /* tab host */ }} />
    </div>
  );
}
