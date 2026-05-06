/**
 * InspectorEffectTab — legacy EffectEditor surfaced as Inspector tab.
 */
import EffectEditor from '@/components/editor/EffectEditor';

export default function InspectorEffectTab() {
  return (
    <div className="h-full overflow-hidden" data-tab-id="inspector-effect">
      <EffectEditor onClose={() => { /* tab host */ }} />
    </div>
  );
}
