/**
 * BLEDeviceScanner — Universal BLE device scanner panel for all consoles
 * Shows discovered devices with signal strength, battery, type detection.
 * Reusable across DMX, Light, Drones, Pyro consoles.
 */
import { useState, useEffect, useCallback } from 'react';
import {
  Bluetooth, Search, Loader2, RefreshCw, Signal, Battery,
  CheckCircle2, Wifi, Radio, Zap, Cpu, Lightbulb, Layers
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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

export type ConsoleContext = 'pyro' | 'dmx' | 'light' | 'drones' | 'general';

interface SimulatedDevice {
  id: string;
  name: string;
  type: string;
  rssi: number;
  battery: number | null;
  connected: boolean;
  channels?: number;
}

const CONSOLE_THEMES: Record<ConsoleContext, { accent: string; border: string; bg: string; label: string }> = {
  pyro:    { accent: 'text-red-400',    border: 'border-red-500/30',    bg: 'bg-red-500/5',    label: 'PYRO DEVICES' },
  dmx:     { accent: 'text-blue-400',   border: 'border-blue-500/30',   bg: 'bg-blue-500/5',   label: 'DMX DEVICES' },
  light:   { accent: 'text-indigo-400', border: 'border-indigo-500/30', bg: 'bg-indigo-500/5', label: 'LIGHTING FIXTURES' },
  drones:  { accent: 'text-teal-400',   border: 'border-teal-500/30',   bg: 'bg-teal-500/5',   label: 'DRONE FLEET' },
  general: { accent: 'text-purple-400', border: 'border-purple-500/30', bg: 'bg-purple-500/5', label: 'BLE DEVICES' },
};

// Simulated devices per console context
function generateSimDevices(context: ConsoleContext): SimulatedDevice[] {
  const base: Record<ConsoleContext, SimulatedDevice[]> = {
    pyro: [
      { id: 'sim-m1-01', name: 'FXK-M1-A01', type: 'MOD', rssi: -52, battery: 94, connected: false, channels: 32 },
      { id: 'sim-m1-02', name: 'FXK-M1-A02', type: 'MOD', rssi: -68, battery: 78, connected: false, channels: 32 },
      { id: 'sim-ctrl', name: 'FXK-CTRL-XL4', type: 'CTRL', rssi: -45, battery: 100, connected: false },
      { id: 'sim-relay', name: 'FXK-RELAY-01', type: 'RLY', rssi: -82, battery: 56, connected: false },
    ],
    dmx: [
      { id: 'sim-crmx', name: 'CRMX-BLE-TX01', type: 'DMX', rssi: -48, battery: 92, connected: false, channels: 512 },
      { id: 'sim-showbaby', name: 'ShowBaby-6CH', type: 'DMX', rssi: -61, battery: 85, connected: false, channels: 512 },
      { id: 'sim-enttec', name: 'ENTTEC-ODE-02', type: 'NODE', rssi: -55, battery: null, connected: false, channels: 512 },
      { id: 'sim-dmxking', name: 'DMXking-eDMX1', type: 'NODE', rssi: -72, battery: null, connected: false, channels: 512 },
    ],
    light: [
      { id: 'sim-astera1', name: 'Astera-AX5-01', type: 'LED', rssi: -50, battery: 88, connected: false, channels: 16 },
      { id: 'sim-astera2', name: 'Astera-AX5-02', type: 'LED', rssi: -63, battery: 72, connected: false, channels: 16 },
      { id: 'sim-astera3', name: 'Astera-AX5-03', type: 'LED', rssi: -57, battery: 95, connected: false, channels: 16 },
      { id: 'sim-art7', name: 'AsteraBox-CRMX', type: 'TX', rssi: -44, battery: 100, connected: false, channels: 512 },
      { id: 'sim-lumen', name: 'LumenRadio-RX', type: 'RX', rssi: -66, battery: null, connected: false },
    ],
    drones: [
      { id: 'sim-drone1', name: 'FXK-UAV-001', type: 'UAV', rssi: -42, battery: 96, connected: false },
      { id: 'sim-drone2', name: 'FXK-UAV-002', type: 'UAV', rssi: -55, battery: 83, connected: false },
      { id: 'sim-drone3', name: 'FXK-UAV-003', type: 'UAV', rssi: -71, battery: 67, connected: false },
      { id: 'sim-gcs', name: 'FXK-GCS-BASE', type: 'GCS', rssi: -38, battery: 100, connected: false },
    ],
    general: [
      { id: 'sim-gen1', name: 'BLE-Device-01', type: 'DEV', rssi: -60, battery: 80, connected: false },
      { id: 'sim-gen2', name: 'BLE-Device-02', type: 'DEV', rssi: -75, battery: 45, connected: false },
    ],
  };
  return base[context] || base.general;
}

const TYPE_COLORS: Record<string, string> = {
  MOD: 'bg-amber-600', CTRL: 'bg-blue-600', RLY: 'bg-purple-600',
  DMX: 'bg-cyan-600', NODE: 'bg-emerald-600', LED: 'bg-yellow-600',
  TX: 'bg-orange-600', RX: 'bg-pink-600', UAV: 'bg-teal-600',
  GCS: 'bg-sky-600', DEV: 'bg-muted',
};

interface BLEDeviceScannerProps {
  context: ConsoleContext;
  compact?: boolean;
  simulation?: boolean;
  onDeviceConnected?: (device: SimulatedDevice) => void;
}

export default function BLEDeviceScanner({ context, compact = false, simulation = true, onDeviceConnected }: BLEDeviceScannerProps) {
  const theme = CONSOLE_THEMES[context];
  const [scanning, setScanning] = useState(false);
  const [simDevices, setSimDevices] = useState<SimulatedDevice[]>([]);
  const [realDevices, setRealDevices] = useState<BLEConnectedDevice[]>([]);
  const [simMode, setSimMode] = useState(true);
  const supported = isWebBluetoothSupported();

  const handleSimScan = useCallback(() => {
    setScanning(true);
    // Stagger device "discovery" for realism
    const devices = generateSimDevices(context);
    let idx = 0;
    const interval = setInterval(() => {
      if (idx >= devices.length) {
        clearInterval(interval);
        setScanning(false);
        toast.success(`${devices.length} dispositivos encontrados`);
        return;
      }
      // Randomize RSSI slightly
      const dev = { ...devices[idx], rssi: devices[idx].rssi + Math.floor(Math.random() * 10 - 5) };
      setSimDevices(prev => [...prev.filter(d => d.id !== dev.id), dev]);
      idx++;
    }, 300);
  }, [context]);

  const handleRealScan = useCallback(async () => {
    if (!supported) { toast.error('Web Bluetooth não suportado'); return; }
    setScanning(true);
    try {
      const device = await scanBluetoothDevices();
      const profile = matchProfile(device.name || '');
      if (profile) {
        const conn = await connectBLEDevice(device, profile);
        setRealDevices(prev => [...prev.filter(d => d.id !== conn.id), conn]);
        toast.success(`🔗 ${conn.name} conectado`);
      }
    } catch (err: any) {
      if (err.name !== 'NotFoundError') toast.error(err.message);
    }
    setScanning(false);
  }, [supported]);

  const handleScan = simMode ? handleSimScan : handleRealScan;

  const handleSimConnect = (dev: SimulatedDevice) => {
    setSimDevices(prev => prev.map(d => d.id === dev.id ? { ...d, connected: true } : d));
    toast.success(`🔗 ${dev.name} conectado`);
    onDeviceConnected?.({ ...dev, connected: true });
  };

  const handleSimDisconnect = (dev: SimulatedDevice) => {
    setSimDevices(prev => prev.map(d => d.id === dev.id ? { ...d, connected: false } : d));
    toast.info(`${dev.name} desconectado`);
  };

  const getRssiStrength = (rssi: number): { bars: number; color: string } => {
    if (rssi > -50) return { bars: 4, color: 'bg-green-400' };
    if (rssi > -65) return { bars: 3, color: 'bg-green-400' };
    if (rssi > -80) return { bars: 2, color: 'bg-amber-400' };
    return { bars: 1, color: 'bg-red-400' };
  };

  const allDevices = simMode ? simDevices : [];
  const connectedCount = allDevices.filter(d => d.connected).length + realDevices.filter(d => d.connected).length;

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bluetooth className={cn("w-4 h-4", theme.accent)} />
          <span className="text-[10px] font-black font-mono uppercase tracking-wider text-foreground">
            {theme.label}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {simulation && (
            <button
              className={cn(
                "text-[7px] px-1.5 py-0.5 rounded font-mono uppercase",
                simMode ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" : "text-muted-foreground border border-border/30"
              )}
              onClick={() => { setSimMode(!simMode); setSimDevices([]); setRealDevices([]); }}
            >
              {simMode ? '⚡ SIM' : '📡 REAL'}
            </button>
          )}
          <Badge variant="outline" className={cn("text-[7px] h-4", theme.border, theme.accent)}>
            {connectedCount} online
          </Badge>
        </div>
      </div>

      {/* Scan button */}
      <Button
        variant="outline"
        className={cn("w-full gap-2 text-[10px]", theme.border, theme.accent, compact ? "h-8" : "h-10")}
        onClick={handleScan}
        disabled={scanning}
      >
        {scanning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
        {scanning ? 'Escaneando...' : `Scan ${theme.label}`}
      </Button>

      {/* Device list */}
      <div className={cn("space-y-1.5", compact ? "max-h-36" : "max-h-56", "overflow-y-auto")}>
        {allDevices.map(dev => {
          const signal = getRssiStrength(dev.rssi);
          return (
            <div key={dev.id} className={cn(
              "rounded-lg border p-2 flex items-center gap-2.5 transition-all",
              dev.connected
                ? "border-green-500/40 bg-green-500/5"
                : cn(theme.border, theme.bg, "hover:border-opacity-60")
            )}>
              {/* Type badge */}
              <div className="relative">
                <div className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center",
                  dev.connected ? "bg-green-500/20" : theme.bg
                )}>
                  <Bluetooth className={cn("w-4 h-4", dev.connected ? "text-green-400" : theme.accent)} />
                </div>
                <span className={cn(
                  "absolute -bottom-1 -right-1 text-[6px] font-bold px-1 rounded text-white",
                  TYPE_COLORS[dev.type] || 'bg-muted'
                )}>
                  {dev.type}
                </span>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold font-mono text-foreground truncate">{dev.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  {/* Signal bars */}
                  <div className="flex items-end gap-[2px] h-2.5">
                    {[1, 2, 3, 4].map(bar => (
                      <div key={bar} className={cn(
                        "w-[2px] rounded-sm",
                        bar <= signal.bars ? signal.color : 'bg-muted-foreground/20'
                      )} style={{ height: `${bar * 25}%` }} />
                    ))}
                  </div>
                  <span className="text-[8px] font-mono text-muted-foreground">{dev.rssi}dBm</span>

                  {dev.battery !== null && (
                    <div className="flex items-center gap-0.5">
                      <Battery className={cn("w-2.5 h-2.5", dev.battery > 20 ? "text-green-400" : "text-red-400")} />
                      <span className="text-[8px] font-mono text-muted-foreground">{dev.battery}%</span>
                    </div>
                  )}

                  {dev.channels && (
                    <span className="text-[7px] font-mono text-muted-foreground/60">{dev.channels}ch</span>
                  )}

                  {dev.connected && (
                    <Badge className="text-[6px] h-3 px-1 bg-green-600 text-white border-0">
                      <CheckCircle2 className="w-1.5 h-1.5 mr-0.5" /> ONLINE
                    </Badge>
                  )}
                </div>
              </div>

              {/* Action */}
              {dev.connected ? (
                <Button size="sm" variant="ghost" className="h-6 px-2 text-[8px] text-destructive"
                  onClick={() => handleSimDisconnect(dev)}>
                  Desconectar
                </Button>
              ) : (
                <Button size="sm" className={cn("h-6 px-2 text-[8px] text-white",
                  context === 'pyro' ? 'bg-red-600 hover:bg-red-500' :
                  context === 'dmx' ? 'bg-blue-600 hover:bg-blue-500' :
                  context === 'light' ? 'bg-indigo-600 hover:bg-indigo-500' :
                  context === 'drones' ? 'bg-teal-600 hover:bg-teal-500' :
                  'bg-purple-600 hover:bg-purple-500'
                )} onClick={() => handleSimConnect(dev)}>
                  Conectar
                </Button>
              )}
            </div>
          );
        })}

        {/* Real BLE devices */}
        {!simMode && realDevices.map(dev => (
          <div key={dev.id} className={cn(
            "rounded-lg border p-2 flex items-center gap-2.5",
            "border-green-500/40 bg-green-500/5"
          )}>
            <Bluetooth className="w-4 h-4 text-green-400" />
            <div className="flex-1">
              <p className="text-[10px] font-bold font-mono text-foreground">{dev.name}</p>
              <div className="flex items-center gap-2">
                <span className="text-[8px] font-mono text-muted-foreground">{dev.profile.type}</span>
                {dev.batteryLevel !== null && (
                  <span className="text-[8px] text-muted-foreground">🔋 {dev.batteryLevel}%</span>
                )}
              </div>
            </div>
            <Button size="sm" variant="ghost" className="h-6 px-2 text-[8px] text-destructive"
              onClick={async () => {
                await disconnectBLE(dev);
                setRealDevices(prev => prev.filter(d => d.id !== dev.id));
              }}>
              Desconectar
            </Button>
          </div>
        ))}
      </div>

      {allDevices.length === 0 && realDevices.length === 0 && !scanning && (
        <p className="text-[9px] text-muted-foreground/50 text-center py-2">
          {simMode ? 'Pressione Scan para simular dispositivos' : 'Pressione Scan para detectar dispositivos BLE'}
        </p>
      )}
    </div>
  );
}
