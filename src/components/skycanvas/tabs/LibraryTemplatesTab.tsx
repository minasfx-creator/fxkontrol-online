import ShowTemplatesPanel from '@/components/editor/ShowTemplatesPanel';
export default function LibraryTemplatesTab() {
  return (
    <div className="h-full">
      <ShowTemplatesPanel onClose={() => { /* tab host */ }} />
    </div>
  );
}
