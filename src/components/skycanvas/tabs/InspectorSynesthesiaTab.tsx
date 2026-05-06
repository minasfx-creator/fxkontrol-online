/** InspectorSynesthesiaTab — wraps legacy SynesthesiaPanel (audio→visual coupling). */
import SynesthesiaPanel from '@/components/editor/SynesthesiaPanel';
export default function InspectorSynesthesiaTab() {
  return (
    <div className="h-full overflow-hidden" data-tab-id="inspector-synesthesia">
      <SynesthesiaPanel onClose={() => { /* tab host */ }} />
    </div>
  );
}
