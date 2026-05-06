/** InspectorTrajectoryTab — wraps legacy TrajectoryOptimizerPanel. */
import TrajectoryOptimizerPanel from '@/components/editor/TrajectoryOptimizerPanel';
export default function InspectorTrajectoryTab() {
  return (
    <div className="h-full overflow-hidden" data-tab-id="inspector-trajectory">
      <TrajectoryOptimizerPanel onClose={() => { /* tab host */ }} />
    </div>
  );
}
