/**
 * InspectorBoidsTab — legacy BoidsPanel surfaced as Inspector tab.
 */
import BoidsPanel from '@/components/editor/BoidsPanel';

export default function InspectorBoidsTab() {
  return (
    <div className="h-full overflow-hidden" data-tab-id="inspector-boids">
      <BoidsPanel onClose={() => { /* tab host */ }} />
    </div>
  );
}
