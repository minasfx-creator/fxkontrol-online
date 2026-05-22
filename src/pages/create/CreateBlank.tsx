/**
 * /create/blank — segment picker for an empty new show.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import SegmentChips from '@/features/create-flow/components/SegmentChips';
import { createShowPlan } from '@/features/create-flow/createShowPlan';
import type { SegmentType } from '@/features/viewport-tools/types';
import { useToast } from '@/hooks/use-toast';

export default function CreateBlank() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [name, setName] = useState('New Show');
  const [segments, setSegments] = useState<SegmentType[]>(['PYRO']);
  const [busy, setBusy] = useState(false);

  const onContinue = async () => {
    if (segments.length === 0) {
      toast({ title: 'Escolha pelo menos um segmento', variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      const { showId } = await createShowPlan({ mode: 'blank', name, segments });
      navigate(`/editor/${showId}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-[calc(100dvh-3rem)] w-full bg-background">
      <div className="max-w-2xl mx-auto px-6 py-10 space-y-6">
        <Button variant="ghost" size="sm" onClick={() => navigate('/create')} className="-ml-2 text-muted-foreground">
          <ArrowLeft className="size-4" /> Voltar
        </Button>
        <header className="space-y-2">
          <h1 className="text-2xl font-bold">Criar do zero</h1>
          <p className="text-sm text-muted-foreground">Defina o nome e selecione os segmentos do show.</p>
        </header>

        <Card className="p-5 space-y-5 bg-card/60 border-border/40">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Nome</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="New Show" />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Segmentos</label>
            <SegmentChips value={segments} onChange={setSegments} />
          </div>
        </Card>

        <div className="flex justify-end">
          <Button onClick={onContinue} disabled={busy || segments.length === 0} className="gap-2">
            Continuar para Editor <ArrowRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
