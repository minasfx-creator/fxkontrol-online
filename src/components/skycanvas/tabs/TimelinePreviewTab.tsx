/** TimelinePreviewTab — wraps legacy ShowPreviewPanel. */
import ShowPreviewPanel from '@/components/editor/ShowPreviewPanel';
export default function TimelinePreviewTab() {
  return (
    <div className="h-full overflow-hidden" data-tab-id="timeline-preview">
      <ShowPreviewPanel onClose={() => { /* tab host */ }} />
    </div>
  );
}
