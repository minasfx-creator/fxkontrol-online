/** TimelineScriptingTab — wraps legacy ScriptingToolsPanel. */
import ScriptingToolsPanel from '@/components/editor/ScriptingToolsPanel';
export default function TimelineScriptingTab() {
  return (
    <div className="h-full overflow-hidden" data-tab-id="timeline-scripting">
      <ScriptingToolsPanel onClose={() => { /* tab host */ }} />
    </div>
  );
}
