import { CueConflictsConsole } from '@/components/safety/CueConflictsConsole';

export default function CueConflictsPage() {
  return (
    <main className="min-h-dvh bg-background text-foreground p-4">
      <div className="max-w-5xl mx-auto h-[80dvh] border border-border/10 rounded">
        <CueConflictsConsole />
      </div>
    </main>
  );
}
