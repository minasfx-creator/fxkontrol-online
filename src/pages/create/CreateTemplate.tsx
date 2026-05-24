/**
 * /create/template — pick a starter template.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import TemplateCard from '@/features/create-flow/components/TemplateCard';
import { TEMPLATES } from '@/features/create-flow/templates';
import { createShowPlan } from '@/features/create-flow/createShowPlan';

export default function CreateTemplate() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState<string | null>(null);

  const onPick = async (id: string) => {
    setBusy(id);
    try {
      const { showId } = await createShowPlan({ mode: 'template', templateId: id });
      navigate(`/editor/${showId}`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="min-h-[calc(100dvh-3rem)] w-full bg-background">
      <div className="max-w-5xl mx-auto px-6 py-10 space-y-6">
        <Button variant="ghost" size="sm" onClick={() => navigate('/create')} className="-ml-2 text-muted-foreground">
          <ArrowLeft className="size-4" /> Voltar
        </Button>
        <header className="space-y-2">
          <h1 className="text-2xl font-bold">Template Marketplace</h1>
          <p className="text-sm text-muted-foreground">Escolha um pacote para começar com posições e segmentos prontos.</p>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {TEMPLATES.map((tpl) => (
            <div key={tpl.id} className={busy === tpl.id ? 'opacity-50 pointer-events-none' : ''}>
              <TemplateCard template={tpl} onPick={onPick} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
