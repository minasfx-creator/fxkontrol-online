/**
 * BLEDeviceScanner — Universal BLE device scanner panel for all consoles
 * Real Web Bluetooth only. Simulation paths removed.
 */
import { useState, useCallback } from 'react';
import {
  Bluetooth, Search, Loader2, Battery, CheckCircle2,
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
  type BLEConnectedDevice,
} from '@/lib/bluetoothEngine';

export type ConsoleContext = 'pyro' | 'dmx' | 'light' | 'drones' | 'general';

const CONSOLE_THEMES: Record<ConsoleContext, { accent: string; border: string; bg: string; label: string }> = {
  pyro:    { accent: 'text-red-400',    border: 'border-red-500/30',    bg: 'bg-red-500/5',    label: 'PYRO DEVICES' },
  dmx:     { accent: 'text-blue-400',   border: 'border-blue-500/30',   bg: 'bg-blue-500/5',   label: 'DMX DEVICES' },
  light:   { accent: 'text-indigo-400', border: 'border-indigo-500/30', bg: 'bg-indigo-500/5', label: 'LIGHTING FIXTURES' },
  drones:  { accent: 'text-teal-400',   border: 'border-teal-500/30',   bg: 'bg-teal-500/5',   label: 'DRONE FLEET' },
  general: { accent: 'text-purple-400', border: 'border-purple-500/30', bg: 'bg-purple-500/5', label: 'BLE DEVICES' },
};

interface BLEDeviceScannerProps {
  context: ConsoleContext;
  compact?: boolean;
  onDeviceConnected?: (device: BLEConnectedDevice) => void;
}

export default function BLEDeviceScanner({ context, compact = false, onDeviceConnected }: BLEDeviceScannerProps) {
  const theme = CONSOLE_THEMES[context];
  const [scanning, setScanning] = useState(false);
  const [realDevices, setRealDevices] = useState<BLEConnectedDevice[]>([]);
  const supported = isWebBluetoothSupported();

  const handleScan = useCallback(async () => {
    if (!supported) { toast.error('Web Bluetooth not supported in this browser'); return; }
    setScanning(true);
    try {
      const device = await scanBluetoothDevices();
      const profile = matchProfile(device.name || '');
      if (profile) {
        const conn = await connectBLEDevice(device, profile);
        setRealDevices(prev => [...prev.filter(d => d.id !== conn.id), conn]);
        onDeviceConnected?.(conn);
        toast.success(`🔗 ${conn.name} connected`);
      } else {
        toast.warning(`No matching profile for ${device.name || 'device'}`);
      }
    } catch (err: any) {
      if (err?.name !== 'NotFoundError') toast.error(err?.message || 'BLE scan failed');
    }
    setScanning(false);
  }, [supported, onDeviceConnected]);

  const connectedCount = realDevices.filter(d => d.connected).length;

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bluetooth className={cn('w-4 h-4', theme.accent)} />
          <span className="text-[10px] font-black font-mono uppercase tracking-wider text-foreground">
            {theme.label}
          </span>
        </div>
        <Badge variant="outline" className={cn('text-[7px] h-4', theme.border, theme.accent)}>
          {connectedCount} online
        </Badge>
      </div>

      {/* Scan button */}
      <Button
        variant="outline"
        className={cn('w-full gap-2 text-[10px]', theme.border, theme.accent, compact ? 'h-8' : 'h-10')}
        onClick={handleScan}
        disabled={scanning || !supported}
      >
        {scanning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
        {scanning ? 'Scanning…' : `Scan ${theme.label}`}
      </Button>

      {!supported && (
        <p className="text-[9px] text-amber-400/80 text-center py-1">
          Web Bluetooth unavailable. Use Chrome/Edge desktop or open outside an iframe.
        </p>
      )}

      {/* Real BLE devices */}
      <div className={cn('space-y-1.5', compact ? 'max-h-36' : 'max-h-56', 'overflow-y-auto')}>
        {realDevices.map(dev => (
          <div key={dev.id} className={cn(
            'rounded-lg border p-2 flex items-center gap-2.5',
            'border-green-500/40 bg-green-500/5',
          )}>
            <Bluetooth className="w-4 h-4 text-green-400" />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold font-mono text-foreground truncate">{dev.name}</p>
              <div className="flex items-center gap-2">
                <span className="text-[8px] font-mono text-muted-foreground">{dev.profile.type}</span>
                {dev.batteryLevel !== null && (
                  <div className="flex items-center gap-0.5">
                    <Battery className="w-2.5 h-2.5 text-emerald-400" />
                    <span className="text-[8px] font-mono text-muted-foreground">{dev.batteryLevel}%</span>
                  </div>
                )}
                {dev.connected && (
                  <Badge className="text-[6px] h-3 px-1 bg-emerald-600 text-primary-foreground border-0">
                    <CheckCircle2 className="w-1.5 h-1.5 mr-0.5" /> ONLINE
                  </Badge>
                )}
              </div>
            </div>
            <Button size="sm" variant="ghost" className="h-6 px-2 text-[8px] text-destructive"
              onClick={async () => {
                await disconnectBLE(dev);
                setRealDevices(prev => prev.filter(d => d.id !== dev.id));
              }}>
              Disconnect
            </Button>
          </div>
        ))}
      </div>

      {realDevices.length === 0 && !scanning && supported && (
        <p className="text-[9px] text-muted-foreground/50 text-center py-2">
          Press Scan to detect BLE devices
        </p>
      )}
    </div>
  );
}
