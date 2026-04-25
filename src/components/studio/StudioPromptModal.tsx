/**
 * StudioPromptModal — entry point for AI-first show creation.
 *
 * Designer types a prompt, AI composes a full ShowPlan (positions +
 * timeline), and the result is applied directly to the project store.
 * No diff/preview: prompt = apply. Manual tweaks happen afterwards in
 * the timeline. One prompt = one undo step.
 */
import { useEffect, useRef, useState } from 'react';
import { Sparkles, Loader2, Wand2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { composePromptToPlan, applyPlanToStore } from '@/lib/studioAICompose';

const QUICK_PROMPTS = [
  '8 pontos de pyro espaçados 20m, vai-e-volta 10s, 5 disparos para cima e fecha com 4 leques cometa',
  'Abertura impactante: 6 mortars em leque, 8 segundos, finale com chrysanthemums',
  'Show curto de 30 segundos, 12 posições em arco, ondas de cometas e mines',
  'Finale 15 segundos: mortars 6", comet fans laterais e wall de peonies coloridas',
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function StudioPromptModal({ open, onOpenChange }: Props) {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      // Focus shortly after open animation
      const t = setTimeout(() => textareaRef.current?.focus(), 80);
      return () => clearTimeout(t);
    }
  }, [open]);

  const handleCompose = async (text?: string) => {
    const value = (text ?? prompt).trim();
    if (value.length < 4) {
      toast.error('Descreva o show com mais detalhes (mínimo 4 caracteres).');
      return;
    }
    setLoading(true);
    try {
      const result = await composePromptToPlan(value);
      const counts = applyPlanToStore(result.plan);
      toast.success(
        `Show criado: ${counts.positions} posições · ${counts.timelineItems} cues · ${counts.duration.toFixed(0)}s`,
        {
          description: result.plan.assumptions?.length
            ? `Premissas: ${result.plan.assumptions.slice(0, 2).join(' · ')}`
            : 'Ajuste manualmente o que quiser. Ctrl+Z desfaz tudo.',
          duration: 6000,
        },
      );
      setPrompt('');
      onOpenChange(false);
    } catch (e: any) {
      const msg = e?.message ?? 'Falha ao gerar o show';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !loading) {
      e.preventDefault();
      handleCompose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !loading && onOpenChange(v)}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Sparkles className="h-5 w-5 text-primary" />
            Studio AI — criar show por prompt
          </DialogTitle>
          <DialogDescription>
            Descreva o show em linguagem natural. A AI gera as posições e a timeline diretamente no editor 3D — sem etapa de aprovação. Use Ctrl+Z para desfazer.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Textarea
            ref={textareaRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Ex: 8 pontos de pyro espaçados 20m, vai-e-volta 10s, 5 disparos para cima, fecha com 4 leques cometa"
            className="min-h-[140px] resize-none font-mono text-sm"
            disabled={loading}
            maxLength={4000}
          />

          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Sugestões rápidas:</p>
            <div className="flex flex-wrap gap-2">
              {QUICK_PROMPTS.map((q) => (
                <Badge
                  key={q}
                  variant="outline"
                  className="cursor-pointer hover:bg-accent hover:text-accent-foreground transition-colors text-xs font-normal py-1.5"
                  onClick={() => !loading && setPrompt(q)}
                >
                  {q.length > 60 ? q.slice(0, 60) + '…' : q}
                </Badge>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 pt-2">
            <span className="text-xs text-muted-foreground">
              ⌘/Ctrl + Enter para gerar
            </span>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                onClick={() => onOpenChange(false)}
                disabled={loading}
              >
                Cancelar
              </Button>
              <Button
                onClick={() => handleCompose()}
                disabled={loading || prompt.trim().length < 4}
                className="gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Compondo…
                  </>
                ) : (
                  <>
                    <Wand2 className="h-4 w-4" />
                    Gerar show
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
