/**
 * InspectorLaserTab — legacy LaserControlPanel surfaced as Inspector tab.
 */
import LaserControlPanel from '@/components/editor/LaserControlPanel';

export default function InspectorLaserTab() {
  return (
    <div className="h-full overflow-hidden" data-tab-id="inspector-laser">
      <LaserControlPanel onClose={() => { /* tab host */ }} />
    </div>
  );
}
