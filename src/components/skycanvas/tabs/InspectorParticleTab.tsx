/**
 * InspectorParticleTab — legacy ParticleEditorPanel surfaced as Inspector tab.
 */
import ParticleEditorPanel from '@/components/editor/ParticleEditorPanel';

export default function InspectorParticleTab() {
  return (
    <div className="h-full overflow-hidden" data-tab-id="inspector-particle">
      <ParticleEditorPanel onClose={() => { /* tab host */ }} />
    </div>
  );
}
