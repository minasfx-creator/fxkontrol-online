/**
 * RadioControlPanel — USB radio antenna dashboard
 * Antenna config, device scanning, range testing, direct fire-from-radio.
 */
import { useState, useCallback } from 'react';
import { Radio, Wifi, WifiOff, Zap, Battery, Signal, Search, Activity, AlertTriangle, Settings, BarChart3, Power } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { useIsMobile } from '@/hooks/use-mobile';
import { useRadioLink } from '@/hooks/useRadioLink';
import { dbmToMw, TX_POWER_LIMITS, type RadioBand } from '@/lib/radioProtocol';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface RadioControlPanelProps {
  fs?: boolean;
  onClose?: () => void;
}

const BAND_OPTIONS: { value: RadioBand; label: string; freq: string }[] = [
  { value: '433M', label: '433 MHz', freq: '433.92' },
  { value: '868M', label: '868 MHz', freq: '868.35' },
  { value: 'auto', label: 'Auto', freq: 'dual' },
  { value: 'lora', label: 'LoRa', freq: '868.10' },
];

export default function RadioControlPanel({ fs = false }: RadioControlPanelProps) {
  const isMobile = useIsMobile();
  const radio = useRadioLink();
  const [rangeTestTarget, setRangeTestTarget] = useState<number | null>(null);
  const [showConfig, setShowConfig] = useState(false);

  const handleConnect = useCallback(async () => {
    try {
      await radio.connectAntenna();
      toast.success('📡 Antena rádio conectada');
    } catch (err: any) {
      toast.error(`Falha: ${err.message}`);
    }
  }, [radio]);

  const handleDisconnect = useCallback(async () => {
    await radio.disconnectAntenna();
    toast.info('Antena desconectada');
  }, [radio]);

  const handleScan = useCallback(async () => {
    toast.info('Escaneando dispositivos via rádio...');
    await radio.scanDevices();
    toast.success(`${radio.devices.size} dispositivos encontrados`);
  }, [radio]);

  const handleRangeTest = useCallback((addr: number) => {
    if (radio.rangeTestActive) {
      radio.stopRangeTest();
      setRangeTestTarget(null);
    } else {
      setRangeTestTarget(addr);
      radio.startRangeTest(addr);
    }
  }, [radio]);

  const currentLimits = TX_POWER_LIMITS[radio.config.band] || TX_POWER_LIMITS['433M'];
  const maxLegalPower = currentLimits?.[0]?.maxDbm ?? 10;

  return (
    <div className={cn("space-y-3", fs ? "p-4" : "p-2")}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className={cn("font-black uppercase tracking-wider text-foreground", fs ? "text-sm" : "text-[10px]")}>
            📡 Controle Rádio
          </h3>
          <p className={cn("text-muted-foreground/50", fs ? "text-[10px]" : "text-[8px]")}>
            {radio.isConnected
              ? `${radio.dongleProfile?.label || 'Conectado'} · ${radio.config.band}`
              : 'Conecte uma antena USB'}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {radio.isConnected ? (
            <>
              <Badge variant="outline" className="text-[7px] h-4 px-1.5 border-green-500/30 text-green-400">
                <Radio className="w-2.5 h-2.5 mr-0.5" />
                {radio.config.frequency} MHz
              </Badge>
              <Button size="sm" variant="ghost" className="h-6 text-[9px] text-red-400" onClick={handleDisconnect}>
                Off
              </Button>
            </>
          ) : (
            <Button size="sm" className="h-7 text-[9px]" onClick={handleConnect}>
              <Radio className="w-3 h-3 mr-1" /> Conectar Antena
            </Button>
          )}
        </div>
      </div>

      {radio.isConnected && (
        <ScrollArea className={cn(fs ? "max-h-[500px]" : "max-h-[400px]")}>
          <div className="space-y-3">

            {/* Band selector */}
            <div className="rounded-lg border border-border/15 bg-card/30 p-2.5">
              <div className="flex items-center gap-1.5 mb-2">
                <Signal className="w-3 h-3 text-muted-foreground/50" />
                <span className={cn("font-bold text-foreground/80", fs ? "text-[10px]" : "text-[9px]")}>Banda</span>
              </div>
              <div className={cn("grid gap-1", isMobile ? "grid-cols-2" : "grid-cols-4")}>
                {BAND_OPTIONS.map(opt => {
                  const supported = radio.dongleProfile?.bands.includes(opt.value);
                  return (
                    <button
                      key={opt.value}
                      disabled={!supported}
                      onClick={() => radio.setBand(opt.value)}
                      className={cn(
                        "rounded-md px-2 py-1.5 text-center transition-all",
                        radio.config.band === opt.value
                          ? "bg-primary/20 border border-primary/30 text-primary"
                          : supported
                            ? "bg-muted/10 border border-border/10 text-muted-foreground/60 hover:bg-muted/20"
                            : "bg-muted/5 border border-border/5 text-muted-foreground/20 cursor-not-allowed"
                      )}
                    >
                      <div className={cn("font-bold", fs ? "text-[10px]" : "text-[9px]")}>{opt.label}</div>
                      <div className="text-[7px] opacity-60">{opt.freq}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* TX Power */}
            <div className="rounded-lg border border-border/15 bg-card/30 p-2.5">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <Zap className="w-3 h-3 text-amber-400/60" />
                  <span className={cn("font-bold text-foreground/80", fs ? "text-[10px]" : "text-[9px]")}>Potência TX</span>
                </div>
                <span className="text-[8px] font-mono text-foreground/60">
                  {radio.config.txPowerDbm} dBm ({dbmToMw(radio.config.txPowerDbm)} mW)
                </span>
              </div>
              <Slider
                value={[radio.config.txPowerDbm]}
                min={-10}
                max={20}
                step={1}
                onValueChange={([v]) => radio.setTxPower(v)}
                className="mb-1"
              />
              {radio.config.txPowerDbm > maxLegalPower && (
                <div className="flex items-center gap-1 text-amber-400/80 mt-1">
                  <AlertTriangle className="w-3 h-3" />
                  <span className="text-[8px]">Excede limite legal ({maxLegalPower} dBm / {currentLimits?.[0]?.region})</span>
                </div>
              )}
            </div>

            {/* Scanner */}
            <div className="rounded-lg border border-border/15 bg-card/30 p-2.5">
              <div className="flex items-center justify-between mb-2">
                <span className={cn("font-bold text-foreground/80", fs ? "text-[10px]" : "text-[9px]")}>
                  Dispositivos ({radio.devices.size})
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 text-[9px]"
                  onClick={handleScan}
                  disabled={radio.isScanning}
                >
                  <Search className={cn("w-3 h-3 mr-1", radio.isScanning && "animate-spin")} />
                  {radio.isScanning ? 'Escaneando...' : 'Escanear'}
                </Button>
              </div>

              {radio.isScanning && <Progress value={undefined} className="h-1 mb-2" />}

              <div className="space-y-1.5">
                {Array.from(radio.devices.values()).map(dev => (
                  <div
                    key={dev.address}
                    className={cn(
                      "rounded-md border border-border/10 bg-muted/5 flex items-center gap-2",
                      isMobile ? "p-3" : "p-2"
                    )}
                  >
                    <div className={cn(
                      "rounded-full flex items-center justify-center w-7 h-7",
                      dev.armed ? "bg-red-500/20" : "bg-green-500/10"
                    )}>
                      <Radio className={cn("w-3.5 h-3.5", dev.armed ? "text-red-400" : "text-green-400/60")} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className={cn("font-bold text-foreground/80 truncate", fs ? "text-[10px]" : "text-[9px]")}>
                          {dev.type} #{dev.address}
                        </span>
                        {dev.armed && <Badge variant="outline" className="text-[6px] h-3 px-1 border-red-500/30 text-red-400">ARM</Badge>}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={cn("text-[7px] font-mono", dev.rssi > -60 ? "text-green-400/60" : dev.rssi > -80 ? "text-amber-400/60" : "text-red-400/60")}>
                          {dev.rssi} dBm
                        </span>
                        {dev.batteryV !== undefined && (
                          <span className="text-[7px] font-mono text-muted-foreground/40">
                            <Battery className="w-2.5 h-2.5 inline mr-0.5" />{dev.batteryV.toFixed(1)}V
                          </span>
                        )}
                        {dev.cueCount !== undefined && (
                          <span className="text-[7px] text-muted-foreground/40">{dev.cueCount} cues</span>
                        )}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className={cn("h-6 text-[8px] px-2", rangeTestTarget === dev.address && radio.rangeTestActive ? "text-amber-400" : "")}
                      onClick={() => handleRangeTest(dev.address)}
                    >
                      <BarChart3 className="w-3 h-3 mr-0.5" />
                      {rangeTestTarget === dev.address && radio.rangeTestActive ? 'Stop' : 'Range'}
                    </Button>
                  </div>
                ))}

                {radio.devices.size === 0 && !radio.isScanning && (
                  <div className="text-center py-4 text-muted-foreground/30 text-[9px]">
                    Nenhum dispositivo — clique Escanear
                  </div>
                )}
              </div>
            </div>

            {/* Range test graph */}
            {radio.rangeTestActive && rangeTestTarget !== null && (
              <div className="rounded-lg border border-border/15 bg-card/30 p-2.5">
                <div className="flex items-center justify-between mb-2">
                  <span className={cn("font-bold text-foreground/80", fs ? "text-[10px]" : "text-[9px]")}>
                    Range Test → #{rangeTestTarget}
                  </span>
                  <Badge variant="outline" className="text-[7px] h-3.5 px-1 animate-pulse">
                    <Activity className="w-2.5 h-2.5 mr-0.5" /> LIVE
                  </Badge>
                </div>
                {/* Mini RSSI bar chart */}
                <div className="flex items-end gap-px h-12">
                  {radio.rangeTestRssiHistory.map((rssi, i) => {
                    const normalized = Math.max(0, Math.min(100, (rssi + 100) * 2));
                    return (
                      <div
                        key={i}
                        className={cn(
                          "flex-1 min-w-[2px] rounded-t-sm transition-all",
                          rssi > -60 ? "bg-green-500/60" : rssi > -80 ? "bg-amber-500/60" : "bg-red-500/60"
                        )}
                        style={{ height: `${normalized}%` }}
                      />
                    );
                  })}
                </div>
                <div className="flex items-center justify-between mt-1 text-[7px] font-mono text-muted-foreground/30">
                  <span>Loss: {((radio.packetStats.ackFailed / Math.max(1, radio.packetStats.totalTx)) * 100).toFixed(1)}%</span>
                  <span>Avg: {radio.rangeTestRssiHistory.length > 0 ? Math.round(radio.rangeTestRssiHistory.reduce((a, b) => a + b, 0) / radio.rangeTestRssiHistory.length) : '--'} dBm</span>
                </div>
              </div>
            )}

            {/* Packet stats */}
            <div className={cn("flex items-center justify-between text-muted-foreground/30 border-t border-border/10 pt-2", "text-[8px] font-mono")}>
              <span>TX: {radio.packetStats.totalTx}</span>
              <span>RX: {radio.packetStats.totalRx}</span>
              <span>ACK: {radio.packetStats.ackSuccess}/{radio.packetStats.totalTx}</span>
              <span>{radio.devices.size} devs</span>
            </div>
          </div>
        </ScrollArea>
      )}

      {/* Disconnected state */}
      {!radio.isConnected && (
        <div className="text-center py-8 space-y-3">
          <Radio className="w-10 h-10 mx-auto text-muted-foreground/20" />
          <p className="text-[10px] text-muted-foreground/40 max-w-[200px] mx-auto">
            Conecte um dongle USB rádio (CC1101, SX1276, nRF24) para controle direto de módulos em campo
          </p>
          <Button size="sm" onClick={handleConnect} className="text-[10px]">
            <Radio className="w-3.5 h-3.5 mr-1.5" /> Conectar Antena
          </Button>
          {radio.error && (
            <p className="text-[9px] text-red-400/60">{radio.error}</p>
          )}
        </div>
      )}
    </div>
  );
}
