/**
 * M1LinkStep — operator confirms PBus link (cable or TNC dock) before
 * we request the WebSerial port. Pure presentational, also lets the
 * operator pick the master address (defaults to 1).
 */
import { useState } from 'react';
import { ArrowLeft, ArrowRight, Cable, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { M1_BAUD, M1_DEFAULT_MASTER_ADDR } from '@/lib/showvenM1Handshake';

interface Props {
  initialAddress?: number;
  onBack: () => void;
  onContinue: (masterAddress: number) => void;
}

export function M1LinkStep({ initialAddress = M1_DEFAULT_MASTER_ADDR, onBack, onContinue }: Props) {
  const [addr, setAddr] = useState<number>(initialAddress);

  const valid = Number.isInteger(addr) && addr >= 1 && addr <= 16;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold tracking-tight flex items-center gap-2">
          <Cable className="w-5 h-5 text-primary" /> Confirmar enlace PBus
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Cabo direto ou TNC USB → master M1/FXcommander. Baud fixo
          <span className="font-mono"> {M1_BAUD} 8N1</span>.
        </p>
      </div>

      <ul className="text-xs text-muted-foreground space-y-2 pl-4 list-disc">
        <li>Master M1 / FXcommander Pro alimentado e em modo <span className="font-mono">RUN</span></li>
        <li>Cabo PBus ou TNC dual-band conectado ao USB do operador</li>
        <li>Slaves C16/X4 no mesmo barramento (não obrigatório p/ pareamento)</li>
        <li>Antenas 433 MHz / 868 MHz roscadas no master (se TNC)</li>
      </ul>

      <div className="rounded-xl border border-border/40 bg-card/40 p-4 space-y-2">
        <Label htmlFor="m1-master-addr" className="text-xs uppercase tracking-wider text-muted-foreground">
          Endereço do master (1..16)
        </Label>
        <Input
          id="m1-master-addr"
          type="number"
          min={1}
          max={16}
          value={addr}
          onChange={(e) => setAddr(Number(e.target.value) || 0)}
          className="font-mono text-base h-12"
          inputMode="numeric"
        />
        <p className="text-[11px] text-muted-foreground">
          Default <span className="font-mono">1</span>. Mude apenas se o master estiver re-endereçado.
        </p>
      </div>

      <div className="rounded-lg border border-border/40 bg-card/30 p-3 flex gap-2 text-[11px] text-muted-foreground">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        <p>O wizard envia <span className="font-mono">STATUS</span> ao endereço escolhido. Resposta inválida = handshake falha (zero síntese).</p>
      </div>

      <div className="flex gap-2">
        <Button variant="outline" onClick={onBack} className="min-h-[56px] flex-shrink-0 gap-1">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <Button
          onClick={() => onContinue(addr)}
          disabled={!valid}
          className="min-h-[56px] flex-1 gap-2"
        >
          Autorizar porta
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
