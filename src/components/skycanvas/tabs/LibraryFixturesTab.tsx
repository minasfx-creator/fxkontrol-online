import ShowvenEquipmentPanel from '@/components/editor/ShowvenEquipmentPanel';
export default function LibraryFixturesTab() {
  return (
    <div className="h-full">
      <ShowvenEquipmentPanel onClose={() => { /* tab host */ }} />
    </div>
  );
}
