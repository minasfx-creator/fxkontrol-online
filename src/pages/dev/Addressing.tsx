import AddressingPanel from '@/components/editor/AddressingPanel';
import { useNavigate } from 'react-router-dom';

export default function AddressingPage() {
  const nav = useNavigate();
  return (
    <main className="min-h-dvh bg-background text-foreground p-4">
      <div className="max-w-6xl mx-auto h-[85dvh] border border-border/10 rounded overflow-hidden">
        <AddressingPanel onClose={() => nav(-1)} />
      </div>
    </main>
  );
}
