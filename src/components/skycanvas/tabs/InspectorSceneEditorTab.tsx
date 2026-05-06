/** InspectorSceneEditorTab — wraps legacy SceneEditorPanel. */
import SceneEditorPanel from '@/components/editor/SceneEditorPanel';
export default function InspectorSceneEditorTab() {
  return (
    <div className="h-full overflow-hidden" data-tab-id="inspector-scene-editor">
      <SceneEditorPanel onClose={() => { /* tab host */ }} />
    </div>
  );
}
