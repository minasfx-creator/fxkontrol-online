/**
 * LibraryMarketplaceTab — wraps TemplateMarketplace as a Library tab.
 */
import TemplateMarketplace from '@/components/editor/TemplateMarketplace';

export default function LibraryMarketplaceTab() {
  return (
    <div className="h-full overflow-hidden" data-tab-id="library-marketplace">
      <TemplateMarketplace onClose={() => { /* tab host */ }} />
    </div>
  );
}
