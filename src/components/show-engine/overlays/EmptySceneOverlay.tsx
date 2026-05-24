import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function EmptySceneOverlay({ onGenerate }: { onGenerate?: () => void }) {
  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-background/60 backdrop-blur-sm pointer-events-auto">
      <div className="text-sm text-muted-foreground">Nenhuma cena carregada</div>
      {onGenerate && (
        <Button size="sm" variant="secondary" onClick={onGenerate} className="gap-2">
          <Sparkles className="h-4 w-4" /> Gerar com IA
        </Button>
      )}
    </div>
  );
}
