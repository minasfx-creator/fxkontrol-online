/**
 * XL4BaudStep — operator picks the baud rate the dock is configured for.
 * Defaults to 9600 (FireOne cable spec). 38400 = TNC radio dock.
 */
import { useState } from 'react';
import { ArrowLeft, ArrowRight, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { SUPPORTED_BAUDS, DEFAULT_XL4_BAUD, type XL4Baud } from '@/lib/fireoneXL4Handshake';

interface Props {
  initial?: XL4Baud;
  onBack: () => void;
  onContinue: (baud: XL4Baud) => void;
}

const BAUD_HINTS: Record<XL4Baud, string> = {
  9600: 'Cabo direto XLII+/XL4-3 (padrão FireOne)',
  19200: 'Variantes locais ou bridges 19200 8N1',
  38400: 'TNC USB → módulos wireless (38400 8N1)',
};

export function XL4BaudStep({ initial = DEFAULT_XL4_BAUD, onBack, onContinue }: Props) {
  const [baud, setBaud] = useState<XL4Baud>(initial);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold tracking-tight">Selecionar baud rate</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Use a mesma velocidade configurada no dock — caso errado, o handshake dá timeout.
        </p>
      </div>

      <ul className="space-y-2">
        {SUPPORTED_BAUDS.map((b) => {
          const selected = b === baud;
          return (
            <li key={b}>
              <button
                type="button"
                onClick={() => setBaud(b)}
                className={cn(
                  'w-full text-left rounded-xl border p-4 min-h-[64px] transition-colors',
                  selected
                    ? 'border-primary/60 bg-primary/10'
                    : 'border-border/40 bg-card/30 hover:border-border',
                )}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className={cn('text-base font-mono font-bold', selected && 'text-primary')}>
                    {b} 8N1
                  </span>
                  {b === DEFAULT_XL4_BAUD && (
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Padrão</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">{BAUD_HINTS[b]}</p>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="rounded-lg border border-border/40 bg-card/30 p-3 flex gap-2 text-[11px] text-muted-foreground">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        <p>Em caso de dúvida, mantenha 9600 — é o padrão de fábrica das placas XLII+ / XL4-3.</p>
      </div>

      <div className="flex gap-2">
        <Button variant="outline" onClick={onBack} className="min-h-[56px] flex-shrink-0 gap-1">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <Button onClick={() => onContinue(baud)} className="min-h-[56px] flex-1 gap-2">
          Autorizar porta
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
