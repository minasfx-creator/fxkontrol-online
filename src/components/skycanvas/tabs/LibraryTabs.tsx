/**
 * Library tabs — Effects · Fixtures · Templates · Assets · Geo.
 * Wrappers: render existing editor modules in observe/drag-only mode.
 * Inert (no fire/dispatch).
 */
import EffectLibrarySidebar from '@/components/editor/EffectLibrarySidebar';
import ShowvenEquipmentPanel from '@/components/editor/ShowvenEquipmentPanel';
import ShowTemplatesPanel from '@/components/editor/ShowTemplatesPanel';
import GeoSearchPanel from '@/components/editor/GeoSearchPanel';

export function LibraryEffectsTab() {
  return <div className="h-full"><EffectLibrarySidebar /></div>;
}

export function LibraryFixturesTab() {
  return (
    <div className="h-full">
      <ShowvenEquipmentPanel onClose={() => { /* hosted in a tab — close is a no-op */ }} />
    </div>
  );
}

export function LibraryTemplatesTab() {
  return (
    <div className="h-full">
      <ShowTemplatesPanel onClose={() => { /* tab host */ }} />
    </div>
  );
}

export function LibraryGeoTab() {
  return (
    <div className="h-full">
      <GeoSearchPanel />
    </div>
  );
}

export default LibraryEffectsTab;
