/**
 * LibraryCatalogTab — wraps the legacy SupplierCatalogPanel as a Library tab.
 * onClose is a no-op: panel is owned by the DockPanel, not floating.
 */
import SupplierCatalogPanel from '@/components/editor/SupplierCatalogPanel';

export default function LibraryCatalogTab() {
  return (
    <div className="h-full overflow-hidden" data-tab-id="library-catalog">
      <SupplierCatalogPanel onClose={() => { /* tab host */ }} />
    </div>
  );
}
