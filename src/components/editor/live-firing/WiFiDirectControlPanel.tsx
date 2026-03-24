/**
 * WiFiDirectControlPanel — Real Hardware Control via Wi-Fi Direct
 * 
 * 3 sections:
 * 1. Discovery: auto-scan for XL4/XL2/FM-i32Q devices
 * 2. XL4 Gateway: ARM/DISARM/E-STOP for real hardware
 * 3. FM-i32Q Direct: 32-igniter grid with real continuity
 * 
 * Safety: AlertDialog before ARM/FIRE on real hardware
 */
import { useState, useCallback, useEffect } from 'react';
import { Antenna, Wifi, Radio, Zap, Shield, ShieldAlert, AlertTriangle, RefreshCw, Signal, Activity, Power } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useFireOneHardware } from '@/hooks/useFireOneHardware';
import { WiFiDirectTransport, type WiFiDirectDeviceInfo } from '@/lib/fireoneWifiDirectTransport';

interface WiFiDirectControlPanelProps {
  fs?: boolean;
  onClose?: () => void;
}

export default function WiFiDirectControlPanel({ fs = false, onClose }: WiFiDirectControlPanelProps) {
  const fireone = useFireOneHardware();
  const [scanning, setScanning] = useState(false);
  const [devices, setDevices] = useState<WiFiDirectDeviceInfo[]>([]);
  const [connectedDevice, setConnectedDevice] = useState<WiFiDirectDeviceInfo | null>(null);

  const scanDevices = useCallback(async () => {
    setScanning(true);
    toast.info('Escaneando dispositivos Wi-Fi Direct...');
    try {
      const found = await WiFiDirectTransport.scanDevices();
      setDevices(found);
      if (found.length === 0) {
        toast.warning('Nenhum dispositivo encontrado. Verifique se o ESP32 está ligado.');
      } else {
        toast.success(`${found.length} dispositivo(s) encontrado(s)`);
      }
    } catch {
      toast.error('Falha no scan');
    } finally {
      setScanning(false);
    }
  }, []);

  // Auto-scan on mount
  useEffect(() => {
    scanDevices();
  }, [scanDevices]);

  const handleConnect = useCallback(async (device: WiFiDirectDeviceInfo) => {
    try {
      await fireone.connectWiFiDirect(`${device.host}:${device.port}`);
      setConnectedDevice(device);
      toast.success(`Conectado a ${device.label} (${device.deviceType})`);
    } catch (err: any) {
      toast.error(`Falha: ${err.message}`);
    }
  }, [fireone]);

  const isConnectedWiFiDirect = fireone.connectionPath === 'wifi_direct';

  const getDeviceIcon = (type: string) => {
    switch (type) {
      case 'XL4':
      case 'XL2':
        return Zap;
      case 'FM-i32Q':
        return Activity;
      default:
        return Antenna;
    }
  };

  return (
    <div className={cn("space-y-3", fs ? "p-4" : "p-2")}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Antenna className="w-4 h-4 text-primary" />
          <h3 className={cn("font-black uppercase tracking-wider text-foreground", fs ? "text-sm" : "text-[10px]")}>
            Wi-Fi Direct — Controle Real
          </h3>
        </div>
        <div className="flex items-center gap-1.5">
          {isConnectedWiFiDirect && (
            <Badge className="text-[8px] h-4 px-1.5 bg-red-600/80 animate-pulse border-transparent">
              REAL
            </Badge>
          )}
          {onClose && (
            <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={onClose}>
              <span className="sr-only">Fechar</span>
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
            </Button>
          )}
        </div>
      </div>

      {/* Safety Warning */}
      {isConnectedWiFiDirect && (
        <div className="rounded-lg border-2 border-red-500/40 bg-red-950/20 p-2 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
          <span className="text-[9px] text-red-300 font-bold">
            ⚠️ MODO REAL — Comandos serão enviados para hardware físico. Verifique a área de segurança.
          </span>
        </div>
      )}

      <ScrollArea className={cn(fs ? "max-h-[450px]" : "max-h-[350px]")}>
        <div className="space-y-3">
          {/* ─── DISCOVERY SECTION ─── */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-bold uppercase text-muted-foreground/60">Discovery</span>
              <Button
                size="sm"
                variant="outline"
                className="h-5 text-[8px] px-2"
                onClick={scanDevices}
                disabled={scanning}
              >
                <RefreshCw className={cn("w-2.5 h-2.5 mr-1", scanning && "animate-spin")} />
                {scanning ? 'Escaneando...' : 'Scan'}
              </Button>
            </div>

            {devices.length === 0 && !scanning && (
              <div className="text-[8px] text-muted-foreground/40 text-center py-4">
                Nenhum dispositivo encontrado. Clique em Scan.
              </div>
            )}

            <div className="space-y-1">
              {devices.map((device, i) => {
                const DevIcon = getDeviceIcon(device.deviceType);
                const isThisConnected = connectedDevice?.host === device.host && isConnectedWiFiDirect;
                return (
                  <button
                    key={`${device.host}-${i}`}
                    onClick={() => !isThisConnected && handleConnect(device)}
                    className={cn(
                      "w-full text-left rounded-lg border p-2 transition-all",
                      isThisConnected
                        ? "border-primary/30 bg-primary/5"
                        : "border-border/15 bg-card/30 hover:border-primary/20"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <DevIcon className={cn("w-4 h-4", isThisConnected ? "text-primary" : "text-muted-foreground/50")} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] font-bold text-foreground">{device.label}</span>
                          <Badge variant="outline" className="text-[8px] h-3 px-1">{device.deviceType}</Badge>
                          {isThisConnected && (
                            <Badge className="text-[8px] h-3 px-1 bg-emerald-600/80 border-transparent">CONECTADO</Badge>
                          )}
                        </div>
                        <span className="text-[8px] text-muted-foreground/40">{device.host}:{device.port}</span>
                      </div>
                      {device.rssi != null && (
                        <div className="flex gap-px items-end h-3">
                          {[0, 1, 2, 3].map(j => {
                            const strength = Math.max(0, Math.min(4, Math.floor(((device.rssi ?? -100) + 100) / 15)));
                            return (
                              <div
                                key={j}
                                className={cn("w-1 rounded-sm", j < strength ? "bg-emerald-400" : "bg-muted-foreground/20")}
                                style={{ height: `${(j + 1) * 25}%` }}
                              />
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ─── XL4 GATEWAY SECTION ─── */}
          {isConnectedWiFiDirect && connectedDevice && (connectedDevice.deviceType === 'XL4' || connectedDevice.deviceType === 'XL2') && (
            <div className="space-y-1.5">
              <span className="text-[9px] font-bold uppercase text-red-400/80">
                {connectedDevice.deviceType} Gateway — Hardware Real
              </span>

              <div className="rounded-lg border border-red-500/20 bg-red-950/10 p-2 space-y-2">
                <div className="flex items-center gap-2 text-[8px] text-muted-foreground/60">
                  <span>Módulos: {fireone.modules.size}</span>
                  <span>·</span>
                  <span>TX: {fireone.txBytes}B</span>
                  {fireone.worstRssi != null && (
                    <>
                      <span>·</span>
                      <span className={fireone.worstRssi > -70 ? 'text-emerald-400' : 'text-amber-400'}>
                        RSSI: {fireone.worstRssi}dBm
                      </span>
                    </>
                  )}
                </div>

                <div className="flex gap-1.5">
                  {/* ARM with safety dialog */}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        size="sm"
                        className={cn(
                          "flex-1 font-black uppercase text-[9px]",
                          "bg-emerald-700 hover:bg-emerald-600"
                        )}
                      >
                        <Shield className="w-3 h-3 mr-1" /> ARM ALL
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle className="text-red-400 flex items-center gap-2">
                          <AlertTriangle className="w-5 h-5" />
                          HARDWARE REAL — Confirmar ARM?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          Você está prestes a ARMAR módulos de hardware REAL via Wi-Fi Direct.
                          Isso habilitará disparo de ignitores pirotécnicos reais.
                          Certifique-se de que a área de segurança está limpa.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-red-600 hover:bg-red-700"
                          onClick={() => {
                            fireone.armAll();
                            toast.warning('⚠️ ARM ALL enviado — HARDWARE REAL');
                          }}
                        >
                          Confirmar ARM
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>

                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 font-black uppercase text-[9px]"
                    onClick={() => {
                      fireone.disarmAll();
                      toast.info('DISARM ALL enviado');
                    }}
                  >
                    <ShieldAlert className="w-3 h-3 mr-1" /> DISARM
                  </Button>

                  <Button
                    size="sm"
                    variant="destructive"
                    className="font-black uppercase text-[9px] px-3"
                    onClick={() => {
                      fireone.emergencyStop();
                      toast.error('🛑 E-STOP ENVIADO — TODOS OS TRANSPORTES');
                    }}
                  >
                    <AlertTriangle className="w-3 h-3 mr-1" /> E-STOP
                  </Button>
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  className="w-full text-[8px]"
                  onClick={() => fireone.discoverModules()}
                  disabled={fireone.scanning}
                >
                  <RefreshCw className={cn("w-3 h-3 mr-1", fireone.scanning && "animate-spin")} />
                  {fireone.scanning ? 'Descobrindo módulos...' : 'Descobrir Módulos'}
                </Button>
              </div>
            </div>
          )}

          {/* ─── FM-i32Q DIRECT SECTION ─── */}
          {isConnectedWiFiDirect && connectedDevice?.deviceType === 'FM-i32Q' && (
            <div className="space-y-1.5">
              <span className="text-[9px] font-bold uppercase text-orange-400/80">
                FM-i32Q Direto — 32 Ignitores
              </span>

              <div className="rounded-lg border border-orange-500/20 bg-orange-950/10 p-2 space-y-2">
                <div className="flex items-center gap-2 text-[8px] text-muted-foreground/60">
                  <span>Módulo conectado diretamente via Wi-Fi Direct</span>
                </div>

                <div className="flex gap-1.5">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" className="flex-1 font-black uppercase text-[9px] bg-emerald-700 hover:bg-emerald-600">
                        <Shield className="w-3 h-3 mr-1" /> ARM
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle className="text-red-400 flex items-center gap-2">
                          <AlertTriangle className="w-5 h-5" />
                          HARDWARE REAL — Confirmar ARM?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          Módulo FM-i32Q real será armado via Wi-Fi Direct.
                          Certifique-se de que a área de segurança está limpa.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-red-600 hover:bg-red-700"
                          onClick={() => {
                            fireone.armAll();
                            toast.warning('⚠️ ARM enviado — FM-i32Q REAL');
                          }}
                        >
                          Confirmar ARM
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>

                  <Button
                    size="sm"
                    variant="destructive"
                    className="font-black uppercase text-[9px] px-3"
                    onClick={() => {
                      fireone.emergencyStop();
                      toast.error('🛑 E-STOP ENVIADO');
                    }}
                  >
                    <AlertTriangle className="w-3 h-3 mr-1" /> E-STOP
                  </Button>
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  className="w-full text-[8px]"
                  onClick={() => {
                    fireone.modules.forEach((_, addr) => fireone.requestContinuity(addr));
                    toast.info('Verificando continuidade real...');
                  }}
                >
                  <Activity className="w-3 h-3 mr-1" /> Continuidade Real
                </Button>
              </div>
            </div>
          )}

          {/* ─── TELEMETRY ─── */}
          {isConnectedWiFiDirect && (
            <div className="space-y-1">
              <span className="text-[9px] font-bold uppercase text-muted-foreground/60">Telemetria</span>
              <div className="grid grid-cols-3 gap-1">
                {[
                  { label: 'Latência', value: `${fireone.transports.find(t => t.type === 'wifi_direct')?.latencyMs ?? '--'}ms` },
                  { label: 'TX', value: `${fireone.txBytes}B` },
                  { label: 'RX', value: `${fireone.rxBytes}B` },
                ].map(item => (
                  <div key={item.label} className="rounded-lg border border-border/10 bg-card/20 p-1.5 text-center">
                    <div className="text-[8px] text-muted-foreground/40 uppercase">{item.label}</div>
                    <div className="text-[9px] font-mono font-bold text-foreground">{item.value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
