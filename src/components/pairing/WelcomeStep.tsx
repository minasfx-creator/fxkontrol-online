import { Smartphone, AlertTriangle, CheckCircle2, ArrowRight, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useHardwareDiagnostics } from '@/hooks/useHardwareDiagnostics';

interface Props {
  onContinue: () => void;
}

export function WelcomeStep({ onContinue }: Props) {
  const navigate = useNavigate();
  const diag = useHardwareDiagnostics();
  const { capabilities } = diag;

  const isBlockedIOS = capabilities.platform === 'ios-safari-pwa';
  const isMissingPlugin =
    (capabilities.platform === 'ios-capacitor' || capabilities.platform === 'android-capacitor') &&
    !capabilities.capacitorSerial;
  const ready = !isBlockedIOS && (capabilities.recommendedTransports.length > 0 || isMissingPlugin);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center">
          <Smartphone className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight">Parear Dispositivo USB</h1>
          <p className="text-sm text-muted-foreground">Wizard guiado iOS-first</p>
        </div>
      </div>

      <div className="rounded-xl border border-border/40 bg-card/40 backdrop-blur p-4 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Plataforma detectada</span>
          <span className="font-mono text-foreground">{diag.platformDisplay}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Transporte recomendado</span>
          <span className="font-mono text-primary">
            {capabilities.recommendedTransports.join(', ') || '—'}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Portas autorizadas</span>
          <span className="font-mono">{diag.authorizedCount}</span>
        </div>
      </div>

      {isBlockedIOS && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4 space-y-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-amber-300">iOS Safari bloqueia USB</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{diag.rootCause}</p>
            </div>
          </div>
          <Button
            onClick={() => navigate('/install')}
            className="w-full min-h-[56px] gap-2"
            variant="default"
          >
            <Download className="w-4 h-4" />
            Instalar App Nativo
          </Button>
        </div>
      )}

      {isMissingPlugin && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4 space-y-2">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm font-semibold text-amber-300">Plugin serial não instalado</p>
          </div>
          <ul className="text-xs text-muted-foreground space-y-1 pl-7 list-disc">
            {diag.fixSteps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      )}

      {ready && !isBlockedIOS && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-emerald-300">Ambiente compatível</p>
              <p className="text-xs text-muted-foreground">{capabilities.hint}</p>
            </div>
          </div>
        </div>
      )}

      <Button
        onClick={onContinue}
        disabled={isBlockedIOS}
        className="w-full min-h-[56px] gap-2 text-base"
        variant="default"
      >
        Começar pareamento
        <ArrowRight className="w-4 h-4" />
      </Button>
      {isBlockedIOS && (
        <button
          type="button"
          onClick={onContinue}
          className="w-full text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground transition-colors"
        >
          Continuar mesmo assim (estou em desktop testando)
        </button>
      )}
    </div>
  );
}
