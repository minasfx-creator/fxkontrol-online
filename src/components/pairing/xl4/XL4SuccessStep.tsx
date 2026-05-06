/**
 * XL4SuccessStep — final summary after a validated FireOne XL4+ handshake.
 * Shows firmware/address/igniter count and links to the FireOne console.
 */
import { CheckCircle2, ArrowRight, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import type { XL4Handshake } from '@/lib/fireoneXL4Handshake';

interface Props {
  handshake: XL4Handshake;
  onPairAnother: () => void;
}

export function XL4SuccessStep({ handshake, onPairAnother }: Props) {
  const navigate = useNavigate();
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/5 p-5 flex items-start gap-3">
        <CheckCircle2 className="w-7 h-7 text-emerald-400 shrink-0" />
        <div className="space-y-1">
          <h2 className="text-base font-bold text-emerald-300">XL4+ validado</h2>
          <p className="text-xs text-emerald-200/80">
            Handshake concluído em {handshake.latencyMs}ms · firmware {handshake.firmware}.
          </p>
        </div>
      </div>

      <dl className="rounded-xl border border-border/40 bg-card/40 backdrop-blur p-4 grid grid-cols-2 gap-y-3 text-xs">
        <dt className="text-muted-foreground">Baud</dt>
        <dd className="font-mono text-right">{handshake.baudRate} 8N1</dd>

        <dt className="text-muted-foreground">Endereço</dt>
        <dd className="font-mono text-right">{handshake.moduleAddress}</dd>

        <dt className="text-muted-foreground">Firmware</dt>
        <dd className="font-mono text-right">{handshake.firmware}</dd>

        <dt className="text-muted-foreground">Igniters conectados</dt>
        <dd className="font-mono text-right">{handshake.igniterCount} / 32</dd>

        <dt className="text-muted-foreground">Sinal</dt>
        <dd className="font-mono text-right">{handshake.signalStrength}%</dd>

        <dt className="text-muted-foreground">Latência IDENTIFY</dt>
        <dd className="font-mono text-right">{handshake.latencyMs}ms</dd>
      </dl>

      <div className="rounded-lg border border-border/40 bg-card/30 p-3 text-[11px] text-muted-foreground leading-relaxed">
        Operação real continua bloqueada até o operador armar pelo console com Hold-to-Confirm.
        Este pareamento apenas valida que o controlador responde e tem firmware suportado.
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" className="h-12 gap-2" onClick={onPairAnother}>
          <RefreshCcw className="w-4 h-4" /> Outro XL4
        </Button>
        <Button
          className="h-12 gap-2"
          onClick={() => navigate('/command?mode=hw_overview')}
        >
          Abrir console
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
