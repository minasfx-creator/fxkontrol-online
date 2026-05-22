/**
 * AIShowCreationFlow — orquestrador do Assistente de Coreografia IA.
 *
 * Steps: site → prompt/preview → applied. Persiste site config por
 * projectId em localStorage.
 */
import { useEffect, useMemo, useState } from 'react';
import { Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import ShowSiteSetup from './ShowSiteSetup';
import AIShowBuilderPanel from './AIShowBuilderPanel';
import type { ShowSiteConfig } from '@/lib/aiShowBuilder/types';
import { loadSiteConfig, saveSiteConfig } from '@/lib/aiShowBuilder/siteConfigStorage';
import { useProjectStore } from '@/store/useProjectStore';

type Step = 'site' | 'builder' | 'applied';

interface AppliedSummary {
  positions: number;
  cues: number;
  duration: number;
}

interface Props {
  /** Mostra botão "Ver no mundo 3D" depois de aplicar. */
  onClose?: () => void;
}

export default function AIShowCreationFlow({ onClose }: Props) {
  const projectId = useProjectStore((s) => s.projectId);
  const initialSite = useMemo(() => loadSiteConfig(projectId), [projectId]);

  const [step, setStep] = useState<Step>(initialSite ? 'builder' : 'site');
  const [site, setSite] = useState<ShowSiteConfig | null>(initialSite);
  const [summary, setSummary] = useState<AppliedSummary | null>(null);

  useEffect(() => {
    // Se o projectId mudar (load de outro projeto), recarrega site
    const reloaded = loadSiteConfig(projectId);
    setSite(reloaded);
    setStep(reloaded ? 'builder' : 'site');
  }, [projectId]);

  const handleSiteConfirm = (cfg: ShowSiteConfig) => {
    saveSiteConfig(projectId, cfg);
    setSite(cfg);
    setStep('builder');
  };

  const handleApplied = (s: AppliedSummary) => {
    setSummary(s);
    setStep('applied');
  };

  return (
    <div className="space-y-4">
      {step === 'site' && (
        <ShowSiteSetup initial={site ?? undefined} onConfirm={handleSiteConfirm} />
      )}

      {step === 'builder' && site && (
        <AIShowBuilderPanel
          site={site}
          onApplied={handleApplied}
          onEditSite={() => setStep('site')}
        />
      )}

      {step === 'applied' && summary && (
        <Card className="border-emerald-500/30 bg-emerald-500/5">
          <CardContent className="space-y-3 pt-6">
            <h3 className="text-lg font-semibold text-foreground">Show aplicado com sucesso</h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• {summary.positions} posições criadas</li>
              <li>• {summary.cues} efeitos adicionados</li>
              <li>• Duração configurada para {summary.duration.toFixed(0)}s</li>
            </ul>
            <div className="flex flex-wrap gap-2 pt-2">
              <Button onClick={() => { setStep('builder'); setSummary(null); }} variant="secondary">
                Gerar mais
              </Button>
              {onClose && (
                <Button onClick={onClose} className="gap-2">
                  <Eye className="h-4 w-4" /> Ver no mundo 3D
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
