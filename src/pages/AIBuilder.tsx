/**
 * Página dedicada do Assistente de Coreografia IA.
 * Disponível em /ai-builder.
 */
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import AIShowCreationFlow from '@/components/ai-show-builder/AIShowCreationFlow';

export default function AIBuilder() {
  const navigate = useNavigate();
  return (
    <div className="min-h-[100dvh] bg-background">
      <header className="sticky top-0 z-10 border-b border-border/40 bg-background/80 backdrop-blur">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/studio')} className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Studio
          </Button>
          <h1 className="text-base font-semibold text-foreground">Assistente de Coreografia IA</h1>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-6">
        <AIShowCreationFlow onClose={() => navigate('/studio')} />
      </main>
    </div>
  );
}
