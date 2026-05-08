/**
 * M1SuccessStep — final summary after a validated Showven M1 handshake.
 * Shows firmware/master/slaves and links to the FX Commander console.
 */
import { CheckCircle2, ArrowRight, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import type { ShowvenM1HandshakeResult } from '@/lib/showvenM1Handshake';
import { M1_TOTAL_CUES } from '@/lib/showvenM1CueMap';

interface Props {
  handshake: ShowvenM1HandshakeResult;
  onPairAnother: () => void;
}

export function M1SuccessStep({ handshake, onPairAnother }: Props) {
  const navigate = useNavigate();
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/5 p-5 flex items-start gap-3">
        <CheckCircle2 className="w-7 h-7 text-emerald-400 shrink-0" />
        <div className="space-y-1">
          <h2 className="text-base font-bold text-emerald-300">Showven M1 validado</h2>
          <p className="text-xs text-emerald-200/80">
            Handshake em {handshake.latencyMs}ms · firmware {handshake.firmware} ·
            {' '}{handshake.slavesOnline} slave(s) no barramento.
          </p>
        </div>
      </div>

      <dl className="rounded-xl border border-border/40 bg-card/40 backdrop-blur p-4 grid grid-cols-2 gap-y-3 text-xs">
        <dt className="text-muted-foreground">Modelo</dt>
        <dd className="font-mono text-right">{handshake.model}</dd>

        <dt className="text-muted-foreground">Baud</dt>
        <dd className="font-mono text-right">{handshake.baudRate} 8N1</dd>

        <dt className="text-muted-foreground">Master address</dt>
        <dd className="font-mono text-right">{handshake.masterAddress}</dd>

        <dt className="text-muted-foreground">Firmware</dt>
        <dd className="font-mono text-right">{handshake.firmware}</dd>

        <dt className="text-muted-foreground">Slaves online</dt>
        <dd className="font-mono text-right">{handshake.slavesOnline}</dd>

        <dt className="text-muted-foreground">Cues mapeáveis</dt>
        <dd className="font-mono text-right">{M1_TOTAL_CUES}</dd>

        <dt className="text-muted-foreground">Latência STATUS</dt>
        <dd className="font-mono text-right">{handshake.latencyMs}ms</dd>
      </dl>

      <div className="rounded-lg border border-border/40 bg-card/30 p-3 text-[11px] text-muted-foreground leading-relaxed">
        Operação real continua bloqueada até o operador armar pelo console com Hold-to-Confirm.
        Este pareamento apenas valida que o master responde PBus e tem firmware suportado.
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" className="h-12 gap-2" onClick={onPairAnother}>
          <RefreshCcw className="w-4 h-4" /> Outro M1
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
