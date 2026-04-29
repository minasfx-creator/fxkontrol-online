/**
 * StudioPromptModal — entry point oficial do Assistente de Coreografia IA
 * dentro do editor /studio.
 *
 * Substituiu a chamada anterior ao edge function `studio-ai-compose`
 * por um gerador determinístico local (sem API externa). O modal apenas
 * embrulha `<AIShowCreationFlow />` num Dialog para abrir/fechar a
 * partir do header do Studio.
 */
import { Sparkles } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import AIShowCreationFlow from '@/components/ai-show-builder/AIShowCreationFlow';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function StudioPromptModal({ open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Sparkles className="h-5 w-5 text-primary" />
            Assistente de Coreografia IA
          </DialogTitle>
          <DialogDescription>
            Descreva sua ideia. A IA cria posições, trajetórias, efeitos e timeline no mundo 3D.
          </DialogDescription>
        </DialogHeader>
        <AIShowCreationFlow onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}
