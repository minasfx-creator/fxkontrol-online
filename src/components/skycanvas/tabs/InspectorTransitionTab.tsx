/** InspectorTransitionTab — wraps legacy TransitionPlannerPanel. */
import TransitionPlannerPanel from '@/components/editor/TransitionPlannerPanel';
export default function InspectorTransitionTab() {
  return (
    <div className="h-full overflow-hidden" data-tab-id="inspector-transition">
      <TransitionPlannerPanel onClose={() => { /* tab host */ }} />
    </div>
  );
}
