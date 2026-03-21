/**
 * BluetoothPanel — BLE device dashboard
 * Scan, connect, monitor RSSI, battery, DMX channels.
 */
import { useState, useCallback } from 'react';
import { Bluetooth, RefreshCw, Signal, Battery, Unplug, Plug } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  isWebBluetoothSupported,
  scanBluetoothDevices,
  connectBLEDevice,
  disconnectBLE,
  matchProfile,
  BLE_PROFILES,
  type BLEConnectedDevice,
  type BLEDeviceProfile,
} from '@/lib/bluetoothEngine';

interface BluetoothPanelProps {
  onClose?: () => void;
}

export default function BluetoothPanel({ onClose }: BluetoothPanelProps) {
  const [scanning, setScanning] = useState(false);
  const [devices, setDevices] = useState<BLEConnectedDevice[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<BLEDeviceProfile | undefined>();
  const supported = isWebBluetoothSupported();

  const handleScan = useCallback(async () => {
    if (!supported) {
      toast.error('Web Bluetooth não suportado. Use Chrome/Edge ou o app nativo iOS.');
      return;
    }
    setScanning(true);
    try {
      const device = await scanBluetoothDevices(selectedProfile);
      const profile = matchProfile(device.name || '');
      if (!profile) {
        toast.error('Perfil BLE não reconhecido');
        return;
      }
      const conn = await connectBLEDevice(device, profile);
      setDevices(prev => [...prev.filter(d => d.id !== conn.id), conn]);
      toast.success(`🔗 ${conn.name} conectado`);
    } catch (err: any) {
      if (err.name !== 'NotFoundError') {
        toast.error(`BLE: ${err.message}`);
      }
    } finally {
      setScanning(false);
    }
  }, [supported, selectedProfile]);

  const handleDisconnect = useCallback(async (dev: BLEConnectedDevice) => {
    await disconnectBLE(dev);
    setDevices(prev => prev.filter(d => d.id !== dev.id));
    toast.info(`${dev.name} desconectado`);
  }, []);

  const rssiBar = (rssi: number) => {
    const strength = Math.max(0, Math.min(4, Math.floor((rssi + 100) / 15)));
    return (
      <div className="flex gap-px items-end h-3">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className={cn("w-1 rounded-sm", i < strength ? "bg-green-400" : "bg-muted-foreground/20")} style={{ height: `${(i + 1) * 25}%` }} />
        ))}
      </div>
    );
  };

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bluetooth className="w-4 h-4 text-blue-400" />
          <h3 className="text-xs font-black uppercase tracking-wider text-foreground">Bluetooth BLE</h3>
        </div>
        <Badge variant="secondary" className="text-[8px]">
          {devices.filter(d => d.connected).length} conectado(s)
        </Badge>
      </div>

      {!supported && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-2">
          <p className="text-[9px] text-destructive">Web Bluetooth não disponível neste navegador. Use Chrome, Edge ou o app nativo para iOS.</p>
        </div>
      )}

      {/* Profile filter */}
      <div className="space-y-1">
        <p className="text-[8px] text-muted-foreground uppercase font-semibold">Filtrar por tipo:</p>
        <div className="flex flex-wrap gap-1">
          <button
            className={cn("text-[8px] px-2 py-0.5 rounded-full border", !selectedProfile ? "bg-primary text-primary-foreground" : "border-border/50")}
            onClick={() => setSelectedProfile(undefined)}
          >Todos</button>
          {BLE_PROFILES.map(p => (
            <button
              key={p.name}
              className={cn("text-[8px] px-2 py-0.5 rounded-full border", selectedProfile?.name === p.name ? "bg-primary text-primary-foreground" : "border-border/50")}
              onClick={() => setSelectedProfile(p)}
            >{p.name.split(' ')[0]}</button>
          ))}
        </div>
      </div>

      <Button onClick={handleScan} disabled={scanning || !supported} className="w-full h-9 text-[10px]">
        {scanning ? <RefreshCw className="w-3 h-3 mr-1 animate-spin" /> : <Bluetooth className="w-3 h-3 mr-1" />}
        {scanning ? 'Procurando...' : 'Scan Dispositivos BLE'}
      </Button>

      {/* Connected devices */}
      <ScrollArea className="max-h-60">
        <div className="space-y-2">
          {devices.map(dev => (
            <div key={dev.id} className="bg-muted/20 rounded-lg p-2 border border-border/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bluetooth className="w-3 h-3 text-blue-400" />
                  <div>
                    <p className="text-[10px] font-semibold text-foreground">{dev.name}</p>
                    <p className="text-[8px] text-muted-foreground">{dev.profile.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {rssiBar(dev.rssi)}
                  {dev.batteryLevel !== null && (
                    <div className="flex items-center gap-0.5">
                      <Battery className="w-3 h-3 text-green-400" />
                      <span className="text-[8px] text-muted-foreground">{dev.batteryLevel}%</span>
                    </div>
                  )}
                  <Button size="icon" variant="ghost" className="w-6 h-6" onClick={() => handleDisconnect(dev)}>
                    <Unplug className="w-3 h-3 text-destructive" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
          {devices.length === 0 && (
            <p className="text-[9px] text-muted-foreground/50 text-center py-4">Nenhum dispositivo BLE conectado</p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
