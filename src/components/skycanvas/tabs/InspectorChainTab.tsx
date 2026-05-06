/**
 * InspectorChainTab — legacy ChainEditorPanel surfaced as Inspector tab.
 */
import ChainEditorPanel from '@/components/editor/ChainEditorPanel';

export default function InspectorChainTab() {
  return (
    <div className="h-full overflow-hidden" data-tab-id="inspector-chain">
      <ChainEditorPanel onClose={() => { /* tab host */ }} />
    </div>
  );
}
