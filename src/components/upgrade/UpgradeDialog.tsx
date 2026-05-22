/**
 * UpgradeDialog — Global modal mounted once at the app root. Listens to
 * `fxk:upgrade-prompt` events (via lib/upgradePrompt) so any module can
 * surface an upgrade CTA without prop-drilling.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Sparkles, Lock, ArrowRight } from 'lucide-react';
import { onUpgradePrompt, type UpgradeReason } from '@/lib/upgradePrompt';

const COPY: Record<UpgradeReason, { title: string; description: string }> = {
  export: {
    title: 'Exportações são recurso Pro',
    description: 'Exportar para Finale 3D, FireOne, VVIZ, MAVLink, ILDA e demais sistemas de disparo requer uma assinatura Pro ou Enterprise ativa.',
  },
  hardware: {
    title: 'Conexão de hardware é recurso Pro',
    description: 'Conectar e disparar hardware físico (FireOne, Art-Net, FXK Relay, módulos de campo) requer uma assinatura Pro ou Enterprise ativa.',
  },
  'joi-quota': {
    title: 'Limite diário do JOI atingido',
    description: 'Você atingiu o limite gratuito de gerações do JOI hoje. Faça upgrade para Pro e gere shows ilimitados.',
  },
  'joi-unlimited': {
    title: 'JOI ilimitado é recurso Pro',
    description: 'Geração ilimitada de shows com o JOI requer uma assinatura Pro ou Enterprise ativa.',
  },
  generic: {
    title: 'Recurso Pro',
    description: 'Esta funcionalidade requer uma assinatura Pro ou Enterprise ativa.',
  },
};

export default function UpgradeDialog() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<UpgradeReason>('generic');
  const [feature, setFeature] = useState<string | undefined>(undefined);

  useEffect(() => {
    return onUpgradePrompt((detail) => {
      setReason(detail.reason);
      setFeature(detail.feature);
      setOpen(true);
    });
  }, []);

  const copy = COPY[reason] ?? COPY.generic;

  const goToPricing = () => {
    setOpen(false);
    navigate('/pricing');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div
            className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full"
            style={{ background: 'hsl(32 100% 50% / 0.15)' }}
          >
            <Lock className="h-5 w-5" style={{ color: 'hsl(32 100% 50%)' }} />
          </div>
          <DialogTitle className="text-center">{copy.title}</DialogTitle>
          <DialogDescription className="text-center">
            {feature ? `${copy.description} (${feature})` : copy.description}
          </DialogDescription>
        </DialogHeader>

        <div
          className="rounded-lg border p-3 text-xs space-y-1.5"
          style={{ background: 'hsl(var(--surface-0))', borderColor: 'hsl(32 100% 50% / 0.2)' }}
        >
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Plano Pro inclui:
          </p>
          <ul className="space-y-1 text-muted-foreground">
            <li className="flex items-start gap-2"><Sparkles className="h-3 w-3 mt-0.5 shrink-0 text-primary" /> Exportações ilimitadas para todos os sistemas de disparo</li>
            <li className="flex items-start gap-2"><Sparkles className="h-3 w-3 mt-0.5 shrink-0 text-primary" /> Conexão com hardware físico (FireOne, Art-Net, FXK)</li>
            <li className="flex items-start gap-2"><Sparkles className="h-3 w-3 mt-0.5 shrink-0 text-primary" /> Gerações ilimitadas com o JOI AI</li>
          </ul>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
            Agora não
          </Button>
          <Button
            size="sm"
            onClick={goToPricing}
            className="gap-2"
            style={{ background: 'hsl(32 100% 50%)', color: 'hsl(220 30% 6%)' }}
          >
            Ver planos <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
