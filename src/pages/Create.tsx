/**
 * /create — Action Layer hub.
 *
 * Asks the central question: "What do you want to do?" and routes to one
 * of four sub-flows. Per the Blueprint UX spec.
 */
import { useNavigate } from 'react-router-dom';
import { Plus, LayoutTemplate, Sparkles, Upload, ArrowLeft } from 'lucide-react';
import ActionCard from '@/features/create-flow/components/ActionCard';
import { Button } from '@/components/ui/button';

export default function Create() {
  const navigate = useNavigate();
  return (
    <div className="min-h-[calc(100dvh-3rem)] w-full bg-background">
      <div className="max-w-4xl mx-auto px-6 py-10 space-y-8">
        <header className="space-y-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => navigate('/office')}
            className="-ml-2 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Office
          </Button>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">O que você quer fazer?</h1>
          <p className="text-sm text-muted-foreground">
            Comece um show do zero, use um template, gere automaticamente com IA ou importe um projeto existente.
          </p>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ActionCard
            icon={Plus}
            title="Criar do zero"
            description="Escolha os segmentos (PYRO, SFX, DRONES, LIGHT, DMX) e abra o editor vazio."
            onClick={() => navigate('/create/blank')}
          />
          <ActionCard
            icon={LayoutTemplate}
            title="Usar Template"
            description="Pacotes prontos: Pyro Sequence, Drone Logo, Light Chase, Festival, Wedding."
            onClick={() => navigate('/create/template')}
          />
          <ActionCard
            icon={Sparkles}
            title="Gerar Automaticamente"
            description="Wizard com tipo de evento, escala, segmentos e duração — IA cria o esqueleto."
            onClick={() => navigate('/create/generate')}
          />
          <ActionCard
            icon={Upload}
            title="Importar Projeto"
            description="Carregue um VVIZ ou JSON existente — em breve."
            disabled
          />
        </div>
      </div>
    </div>
  );
}
