import { CheckCircle2, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import type { FXK16Handshake } from '@/lib/fxk16BleHandshake';

interface Props {
  handshake: FXK16Handshake;
  deviceName: string;
  onPairAnother: () => void;
}

export function BleSuccessStep({ handshake, deviceName, onPairAnother }: Props) {
  const navigate = useNavigate();
  const ts = new Date(handshake.receivedAt);
  const tsStr = ts.toLocaleString('pt-BR');
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/15 to-transparent p-5 text-center space-y-3">
        <div className="h-14 w-14 mx-auto rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
          <CheckCircle2 className="w-8 h-8 text-emerald-400" />
        </div>
        <h2 className="text-base font-bold text-emerald-300">FXK16 pareado</h2>
        <p className="text-[11px] text-muted-foreground">
          Módulo identificado, registrado para reconexão automática.
        </p>
      </div>

      <div className="rounded-xl border border-border/40 bg-card/40 backdrop-blur p-4 space-y-3 text-xs">
        <Row label="Dispositivo" value={deviceName} mono />
        <Row label="Modelo" value={handshake.model} mono accent />
        <Row label="Canais" value={String(handshake.channels)} mono />
        {handshake.firmware && <Row label="Firmware" value={handshake.firmware} mono />}
        {handshake.deviceId && <Row label="ID" value={handshake.deviceId} mono />}
        <Row label="Latência" value={`${handshake.latencyMs} ms`} mono />
        <Row label="Hora" value={tsStr} />
        <div className="pt-2 border-t border-border/30">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Banner</p>
          <p className="text-[10px] font-mono text-foreground/80 break-all">{handshake.raw}</p>
        </div>
      </div>

      <div className="space-y-2">
        <Button
          className="w-full h-14 text-sm"
          onClick={() => navigate('/dev/fxk16-validate')}
        >
          Abrir console FXK Pyro (validate)
        </Button>
        <Button
          variant="outline"
          className="w-full h-12 gap-2"
          onClick={onPairAnother}
        >
          <RotateCcw className="w-4 h-4" /> Parear outro módulo
        </Button>
        <Button
          variant="ghost"
          className="w-full h-10 text-muted-foreground"
          onClick={() => navigate('/command?mode=hw_overview')}
        >
          Voltar ao Hardware Overview
        </Button>
      </div>
    </div>
  );
}

function Row({ label, value, mono, accent }: { label: string; value: string; mono?: boolean; accent?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground shrink-0">{label}</span>
      <span className={[mono ? 'font-mono' : '', accent ? 'text-primary font-semibold' : ''].join(' ').trim() + ' truncate'}>
        {value}
      </span>
    </div>
  );
}
