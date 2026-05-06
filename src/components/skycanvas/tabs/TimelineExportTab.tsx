/** TimelineExportTab — wraps legacy FiringExportPanel (script export). */
import FiringExportPanel from '@/components/editor/FiringExportPanel';
export default function TimelineExportTab() {
  return (
    <div className="h-full overflow-hidden" data-tab-id="timeline-export">
      <FiringExportPanel onClose={() => { /* tab host */ }} />
    </div>
  );
}
