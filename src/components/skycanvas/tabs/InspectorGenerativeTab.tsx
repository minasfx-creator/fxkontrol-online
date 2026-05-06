/** InspectorGenerativeTab — wraps GenerativeEffectsPanel (AI-driven effect synthesis). */
import GenerativeEffectsPanel from '@/components/editor/GenerativeEffectsPanel';
export default function InspectorGenerativeTab() {
  return (
    <div className="h-full overflow-hidden" data-tab-id="inspector-generative">
      <GenerativeEffectsPanel onClose={() => { /* tab host */ }} />
    </div>
  );
}
