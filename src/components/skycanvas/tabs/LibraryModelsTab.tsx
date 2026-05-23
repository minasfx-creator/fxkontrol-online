/** LibraryModelsTab — wraps legacy ModelImportPanel as Library tab. */
import ModelImportPanel from '@/components/editor/ModelImportPanel';
export default function LibraryModelsTab() {
  return (
    <div className="h-full overflow-hidden" data-tab-id="library-models">
      <ModelImportPanel onClose={() => { /* tab host */ }} />
    </div>
  );
}
