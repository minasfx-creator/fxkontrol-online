/**
 * NFCPairPanel — NFC instant pairing UI
 * Tap-to-scan, write config, scan history.
 */
import { useState, useCallback, useRef } from 'react';
import { Nfc, Smartphone, Upload, History, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { haptics } from '@/lib/haptics';
import {
  isWebNFCSupported,
  startNFCScan,
  writeNFCConfig,
  type NFCDeviceRecord,
  type NFCScanResult,
} from '@/lib/nfcEngine';

interface NFCPairPanelProps {
  onClose?: () => void;
}

export default function NFCPairPanel({ onClose }: NFCPairPanelProps) {
  const [scanning, setScanning] = useState(false);
  const [history, setHistory] = useState<NFCScanResult[]>([]);
  const [lastResult, setLastResult] = useState<NFCScanResult | null>(null);
  const [writeMode, setWriteMode] = useState(false);
  const [writeConfig, setWriteConfig] = useState<Partial<NFCDeviceRecord>>({
    deviceType: 'c16',
    address: 1,
    band: 'dual',
    channelMap: [],
  });
  const stopRef = useRef<(() => void) | null>(null);
  const supported = isWebNFCSupported();

  const handleStartScan = useCallback(async () => {
    if (!supported) {
      toast.error('Web NFC não disponível. Use Chrome no Android ou o app nativo iOS.');
      return;
    }
    try {
      setScanning(true);
      const { stop } = await startNFCScan(
        (result) => {
          setLastResult(result);
          setHistory(prev => [result, ...prev].slice(0, 20));
          haptics.success();
          toast.success(`📱 Tag NFC lida: ${result.records.length} registro(s)`);
        },
        (err) => toast.error(err.message)
      );
      stopRef.current = stop;
    } catch (err: any) {
      toast.error(`NFC: ${err.message}`);
      setScanning(false);
    }
  }, [supported]);

  const handleStopScan = useCallback(() => {
    stopRef.current?.();
    stopRef.current = null;
    setScanning(false);
  }, []);

  const handleWrite = useCallback(async () => {
    try {
      await writeNFCConfig(writeConfig as NFCDeviceRecord);
      haptics.success();
      toast.success('✅ Configuração escrita na tag NFC');
    } catch (err: any) {
      toast.error(`Escrita NFC falhou: ${err.message}`);
    }
  }, [writeConfig]);

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Nfc className="w-4 h-4 text-primary" />
          <h3 className="text-xs font-black uppercase tracking-wider text-foreground">NFC Pairing</h3>
        </div>
        <Badge variant={scanning ? 'default' : 'secondary'} className="text-[8px]">
          {scanning ? 'Escaneando' : 'Inativo'}
        </Badge>
      </div>

      {!supported && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-2 flex items-start gap-2">
          <AlertCircle className="w-3 h-3 text-yellow-500 mt-0.5 shrink-0" />
          <p className="text-[9px] text-yellow-200/80">Web NFC só funciona em Chrome (Android). Para iOS, use o app nativo com Capacitor.</p>
        </div>
      )}

      {/* Scan button */}
      <Button
        onClick={scanning ? handleStopScan : handleStartScan}
        disabled={!supported}
        className={cn("w-full h-16 text-sm font-bold", scanning && "bg-destructive hover:bg-destructive/90")}
      >
        <Smartphone className="w-5 h-5 mr-2" />
        {scanning ? 'Parar Scan' : 'Toque para Escanear'}
      </Button>

      {/* Last scanned */}
      {lastResult && (
        <div className="bg-muted/20 rounded-lg p-2 border border-primary/30">
          <p className="text-[9px] font-semibold text-foreground mb-1">Último lido:</p>
          <div className="space-y-0.5">
            <p className="text-[8px] text-muted-foreground font-mono">SN: {lastResult.serialNumber || 'N/A'}</p>
            {lastResult.records.map((rec, i) => (
              <div key={i} className="text-[8px] text-muted-foreground">
                <span className="text-foreground font-semibold">{rec.deviceType}</span> · Addr: {rec.address} · Band: {rec.band}
              </div>
            ))}
            {lastResult.records.length === 0 && (
              <p className="text-[8px] text-muted-foreground">Dados: {lastResult.raw.slice(0, 100)}</p>
            )}
          </div>
        </div>
      )}

      {/* Write mode */}
      <div className="space-y-2">
        <Button size="sm" variant={writeMode ? 'default' : 'outline'} className="w-full h-7 text-[9px]" onClick={() => setWriteMode(!writeMode)}>
          <Upload className="w-3 h-3 mr-1" /> {writeMode ? 'Ocultar Escrita' : 'Escrever Configuração'}
        </Button>

        {writeMode && (
          <div className="space-y-2 bg-muted/10 rounded-lg p-2 border border-border/30">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[8px] text-muted-foreground">Tipo</label>
                <select
                  className="w-full h-7 bg-background border border-border rounded text-[9px] px-1"
                  value={writeConfig.deviceType}
                  onChange={(e) => setWriteConfig(prev => ({ ...prev, deviceType: e.target.value as any }))}
                >
                  <option value="c16">PyroSlave C16</option>
                  <option value="x4">PyroSlave X4</option>
                  <option value="pyromote">PyroMote</option>
                  <option value="cflamer">cFlamer</option>
                  <option value="dmx-node">DMX Node</option>
                </select>
              </div>
              <div>
                <label className="text-[8px] text-muted-foreground">Endereço</label>
                <Input
                  type="number" min={1} max={255}
                  value={writeConfig.address}
                  onChange={(e) => setWriteConfig(prev => ({ ...prev, address: Number(e.target.value) }))}
                  className="h-7 text-[9px]"
                />
              </div>
            </div>
            <div>
              <label className="text-[8px] text-muted-foreground">Banda</label>
              <select
                className="w-full h-7 bg-background border border-border rounded text-[9px] px-1"
                value={writeConfig.band}
                onChange={(e) => setWriteConfig(prev => ({ ...prev, band: e.target.value as any }))}
              >
                <option value="433M">433 MHz</option>
                <option value="868M">868 MHz</option>
                <option value="dual">Dual (433+868)</option>
              </select>
            </div>
            <Button size="sm" className="w-full h-8 text-[9px]" onClick={handleWrite} disabled={!supported}>
              Escrever na Tag NFC
            </Button>
          </div>
        )}
      </div>

      {/* History */}
      {history.length > 0 && (
        <div className="space-y-1">
          <div className="flex items-center gap-1">
            <History className="w-3 h-3 text-muted-foreground" />
            <p className="text-[8px] font-semibold text-muted-foreground uppercase">Histórico</p>
          </div>
          <ScrollArea className="max-h-32">
            {history.map((h, i) => (
              <div key={i} className="text-[7px] text-muted-foreground/60 flex justify-between py-0.5 border-b border-border/10">
                <span>{h.records[0]?.deviceType || 'unknown'} · Addr {h.records[0]?.address || '?'}</span>
                <span>{new Date(h.timestamp).toLocaleTimeString()}</span>
              </div>
            ))}
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
