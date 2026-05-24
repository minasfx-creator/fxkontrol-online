import { useState } from 'react';
import { Cable, Zap, Plug, ArrowRight, ArrowLeft, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Props {
  onBack: () => void;
  onContinue: () => void;
}

const CHECKLIST = [
  {
    key: 'adapter',
    icon: Plug,
    label: 'Adaptador MFi conectado',
    detail: 'Lightning Camera Adapter ou USB-C OTG (certificado Apple).',
  },
  {
    key: 'powered',
    icon: Zap,
    label: 'Hardware ligado',
    detail: 'O LED de power do dispositivo deve estar aceso.',
  },
  {
    key: 'data',
    icon: Cable,
    label: 'Cabo de DADOS (não só carga)',
    detail: 'Cabos só de carga não funcionam — use o que veio com o equipamento.',
  },
];

export function CableCheckStep({ onBack, onContinue }: Props) {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const allChecked = CHECKLIST.every(c => checked[c.key]);

  const toggle = (key: string) =>
    setChecked(s => ({ ...s, [key]: !s[key] }));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold tracking-tight">Verificação física</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Confirme cada item antes de continuar.
        </p>
      </div>

      <div className="rounded-xl border border-border/40 bg-card/40 backdrop-blur p-4">
        <svg viewBox="0 0 280 90" className="w-full h-auto" aria-hidden="true">
          <defs>
            <linearGradient id="cable" x1="0" x2="1">
              <stop offset="0" stopColor="hsl(var(--primary))" stopOpacity="0.6" />
              <stop offset="1" stopColor="hsl(var(--primary))" stopOpacity="0.2" />
            </linearGradient>
          </defs>
          {/* iPhone */}
          <rect x="6" y="20" width="34" height="50" rx="6" fill="hsl(var(--card))" stroke="hsl(var(--border))" />
          <rect x="10" y="24" width="26" height="38" rx="2" fill="hsl(var(--background))" />
          <circle cx="23" cy="66" r="1.5" fill="hsl(var(--muted-foreground))" />
          {/* Lightning plug */}
          <rect x="40" y="40" width="14" height="10" fill="hsl(var(--muted))" />
          {/* Adapter */}
          <rect x="54" y="34" width="40" height="22" rx="3" fill="hsl(var(--muted))" stroke="hsl(var(--border))" />
          <text x="74" y="48" fontSize="6" textAnchor="middle" fill="hsl(var(--muted-foreground))">MFi</text>
          {/* USB cable */}
          <path d="M94 45 Q 130 30 170 45 T 230 45" stroke="url(#cable)" strokeWidth="3" fill="none" />
          {/* Hardware box */}
          <rect x="230" y="25" width="44" height="40" rx="4" fill="hsl(var(--card))" stroke="hsl(var(--primary)/0.5)" />
          <circle cx="242" cy="38" r="2" fill="hsl(var(--success, var(--primary)))" />
          <text x="252" y="55" fontSize="6" fill="hsl(var(--muted-foreground))">PYRO/DMX</text>
        </svg>
      </div>

      <ul className="space-y-2">
        {CHECKLIST.map(item => {
          const isChecked = !!checked[item.key];
          const Icon = item.icon;
          return (
            <li key={item.key}>
              <button
                type="button"
                onClick={() => toggle(item.key)}
                className={cn(
                  'w-full text-left rounded-xl border p-3 flex items-start gap-3 min-h-[64px] transition-colors',
                  isChecked
                    ? 'border-primary/50 bg-primary/10'
                    : 'border-border/40 bg-card/30 hover:border-border',
                )}
              >
                <div
                  className={cn(
                    'h-7 w-7 rounded-full border flex items-center justify-center flex-shrink-0 transition-colors',
                    isChecked
                      ? 'bg-primary border-primary text-primary-foreground'
                      : 'border-border bg-background',
                  )}
                >
                  {isChecked ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4 text-muted-foreground" />}
                </div>
                <div className="min-w-0">
                  <p className={cn('text-sm font-medium', isChecked && 'text-primary')}>
                    {item.label}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.detail}</p>
                </div>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="flex gap-2">
        <Button variant="outline" onClick={onBack} className="min-h-[56px] flex-shrink-0 gap-1">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <Button
          onClick={onContinue}
          disabled={!allChecked}
          className="min-h-[56px] flex-1 gap-2"
        >
          Tudo conectado
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
