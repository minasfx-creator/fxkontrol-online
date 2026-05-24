/**
 * InspectorLightTab — legacy LightProgramPanel surfaced as Inspector tab.
 * Note: LightProgramPanel takes no props (self-contained).
 */
import LightProgramPanel from '@/components/editor/LightProgramPanel';

export default function InspectorLightTab() {
  return (
    <div className="h-full overflow-hidden" data-tab-id="inspector-light">
      <LightProgramPanel />
    </div>
  );
}
