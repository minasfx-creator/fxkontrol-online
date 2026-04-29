import { useCallback, useState } from 'react';
import { Search, Loader2, ArrowLeft, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  scanForFXK16,
  HandshakeError,
  type ScanResult,
} from '@/lib/fxk16BleHandshake';

interface Props {
  onPicked: (result: ScanResult) => void;
  onBack: () => void;
  busy?: boolean;
}

export function BleScanStep({ onPicked, onBack, busy }: Props) {
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleScan = useCallback(async () => {
    setError(null);
    setScanning(true);
    try {
      const result = await scanForFXK16();
      onPicked(result);
    } catch (err) {
      if (err instanceof HandshakeError) {
        if (err.code === 'cancelled') {
          setError('Nenhum dispositivo selecionado. Toque em Buscar novamente.');
        } else {
          setError(err.message);
        }
      } else {
        setError('Falha inesperada ao iniciar a busca.');
      }
    } finally {
      setScanning(false);
    }
  }, [onPicked]);

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-primary/30 bg-card/40 p-5 space-y-3">
        <h2 className="text-base font-bold">Buscar módulo FXK16</h2>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Toque em <span className="text-primary font-semibold">Buscar FXK16</span> e selecione seu
          módulo na lista do navegador. Apenas dispositivos com nome iniciando em
          <span className="font-mono text-primary"> FXK16-</span> aparecerão.
        </p>
        <ol className="text-[11px] text-muted-foreground space-y-1 list-decimal list-inside">
          <li>Confirme que o ESP32-S3 está alimentado.</li>
          <li>Aproxime o telefone/laptop até ~3m do módulo.</li>
          <li>Aceite a permissão de Bluetooth quando solicitada.</li>
        </ol>
      </div>

      <Button
        className="w-full h-14 text-sm gap-2"
        onClick={handleScan}
        disabled={scanning || busy}
      >
        {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
        {scanning ? 'Aguardando seleção…' : 'Buscar FXK16'}
        {!scanning && <ArrowRight className="w-4 h-4 ml-auto" />}
      </Button>

      {error && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3">
          <p className="text-[11px] text-red-200 leading-relaxed">{error}</p>
        </div>
      )}

      <Button
        variant="ghost"
        className="w-full h-12 gap-2 text-muted-foreground"
        onClick={onBack}
        disabled={scanning}
      >
        <ArrowLeft className="w-4 h-4" /> Voltar
      </Button>
    </div>
  );
}
