import { Sparkles, Shield, Cpu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import StatusPill from './StatusPill';

interface CommanderHUDProps {
  validationStatus: 'idle' | 'ok' | 'warn';
  busy: boolean;
  operator: string;
  version?: string;
  onClose: () => void;
}

export default function CommanderHUD({
  validationStatus, busy, operator, version = 'v4.0', onClose,
}: CommanderHUDProps) {
  const validationLabel =
    validationStatus === 'ok'   ? 'Validated'  :
    validationStatus === 'warn' ? 'Issues'     : 'Awaiting';
  const validationVariant =
    validationStatus === 'ok'   ? 'ok'   :
    validationStatus === 'warn' ? 'warn' : 'neutral';

  return (
    <header className="sticky top-0 z-20 glass-premium border-b border-border/40">
      <div className="flex items-center gap-3 px-3 sm:px-5 h-14">
        {/* FX brand */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div
            className="h-9 w-9 rounded-lg flex items-center justify-center font-black text-[10px] tracking-[0.18em] text-white shadow-lg"
            style={{ background: 'linear-gradient(135deg, hsl(var(--fxk-cyan)) 0%, hsl(var(--fxk-violet)) 100%)' }}
          >
            FX
          </div>
          <div className="hidden sm:flex flex-col leading-tight">
            <span className="text-[10px] font-black tracking-[0.22em] uppercase text-foreground">
              SwarmGPT Commander
            </span>
            <span className="text-[9px] font-mono text-muted-foreground tracking-wider">
              AI Choreography Hub · {version}
            </span>
          </div>
          <Sparkles className="sm:hidden w-4 h-4 text-[hsl(var(--fxk-cyan))]" />
        </div>

        {/* Status pills */}
        <div className="flex-1 flex items-center justify-center gap-1.5 flex-wrap min-w-0">
          <StatusPill label="SwarmGPT Online" variant="ai" pulse />
          <StatusPill icon={Shield} label="Simulation Safe" variant="ok" />
          <StatusPill icon={Cpu} label={validationLabel} variant={validationVariant} pulse={busy} />
        </div>

        {/* Operator + close */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="hidden md:flex items-center gap-2 px-2.5 py-1 rounded-full bg-background/40 ring-1 ring-border backdrop-blur">
            <div className="w-5 h-5 rounded-full bg-[hsl(var(--fxk-cyan)/0.15)] flex items-center justify-center text-[9px] font-bold text-[hsl(var(--fxk-cyan))]">
              {operator.slice(0, 2).toUpperCase()}
            </div>
            <span className="text-[10px] font-mono text-muted-foreground">{operator}</span>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8" title="Voltar">
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
