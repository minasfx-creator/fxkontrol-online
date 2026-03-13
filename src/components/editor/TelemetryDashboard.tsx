import { useState, useMemo, useRef } from 'react';
import { useProjectStore } from '@/store/useProjectStore';
import { useMAVLinkStore } from '@/store/useMAVLinkStore';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { X, Activity, Wifi, WifiOff, Battery, Gauge, Navigation, AlertTriangle, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DroneStatus {
  id: number;
  armed: boolean;
  mode: string;
  battery: number;
  voltage: number;
  gpsfix: number;
  satellites: number;
  altitude: number;
  speed: number;
  heading: number;
  pitch: number;
  roll: number;
  signal: number;
  alerts: string[];
}

export default function TelemetryDashboard({ onClose }: { onClose: () => void }) {
  const { droneFormations, currentTime } = useProjectStore();
  const { drones, connected } = useMAVLinkStore();
  const [selectedDrone, setSelectedDrone] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'detail'>('grid');

  const droneCount = droneFormations.length > 0 ? droneFormations[0].droneCount : 0;

  // Generate simulated telemetry for all drones
  const telemetry: DroneStatus[] = useMemo(() => {
    const statuses: DroneStatus[] = [];
    for (let i = 0; i < Math.min(droneCount, 200); i++) {
      const mavDrone = drones.get(i);
      const batteryBase = 95 - (currentTime / 60) * 8 - Math.random() * 5;
      const alerts: string[] = [];
      if (batteryBase < 30) alerts.push('LOW_BATTERY');
      if (Math.random() < 0.02) alerts.push('GPS_DRIFT');

      statuses.push({
        id: i,
        armed: currentTime > 0,
        mode: currentTime > 0 ? 'GUIDED' : 'STABILIZE',
        battery: Math.max(0, Math.min(100, batteryBase)),
        voltage: 11.1 + (batteryBase / 100) * 5.6,
        gpsfix: 3,
        satellites: 12 + Math.floor(Math.random() * 6),
        altitude: mavDrone?.altitude || 0,
        speed: mavDrone?.speed || Math.random() * 3,
        heading: mavDrone?.heading || Math.random() * 360,
        pitch: Math.random() * 10 - 5,
        roll: Math.random() * 10 - 5,
        signal: 85 + Math.random() * 15,
        alerts,
      });
    }
    return statuses;
  }, [droneCount, currentTime, drones]);

  const alertCount = telemetry.filter(d => d.alerts.length > 0).length;
  const avgBattery = telemetry.length > 0
    ? telemetry.reduce((sum, d) => sum + d.battery, 0) / telemetry.length
    : 0;

  const selected = selectedDrone !== null ? telemetry.find(d => d.id === selectedDrone) : null;

  return (
    <div className="h-full flex flex-col bg-surface-0 border-l border-border/50">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/40">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" />
          <span className="text-xs font-semibold text-foreground">Telemetry</span>
          {connected ? (
            <Badge variant="outline" className="text-[8px] px-1 py-0 text-green-400 border-green-400/30">
              <Wifi className="w-2.5 h-2.5 mr-0.5" /> LIVE
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[8px] px-1 py-0 text-muted-foreground">
              <WifiOff className="w-2.5 h-2.5 mr-0.5" /> SIM
            </Badge>
          )}
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Fleet Overview */}
      <div className="px-3 py-2 border-b border-border/30">
        <div className="grid grid-cols-3 gap-2 text-[10px]">
          <div className="bg-surface-1/60 rounded px-2 py-1.5 text-center">
            <div className="text-muted-foreground">Fleet</div>
            <div className="text-foreground font-bold text-sm">{droneCount}</div>
          </div>
          <div className="bg-surface-1/60 rounded px-2 py-1.5 text-center">
            <div className="text-muted-foreground">Avg Battery</div>
            <div className={cn("font-bold text-sm", avgBattery > 50 ? 'text-green-400' : avgBattery > 25 ? 'text-yellow-400' : 'text-red-400')}>
              {avgBattery.toFixed(0)}%
            </div>
          </div>
          <div className="bg-surface-1/60 rounded px-2 py-1.5 text-center">
            <div className="text-muted-foreground">Alerts</div>
            <div className={cn("font-bold text-sm", alertCount > 0 ? 'text-red-400' : 'text-green-400')}>
              {alertCount}
            </div>
          </div>
        </div>
      </div>

      {/* View toggle */}
      <div className="flex border-b border-border/30">
        {(['grid', 'detail'] as const).map(v => (
          <button
            key={v}
            onClick={() => setViewMode(v)}
            className={cn(
              "flex-1 text-[10px] py-1.5 font-medium",
              viewMode === v ? 'text-primary border-b border-primary' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {v === 'grid' ? 'Fleet Grid' : 'Detail View'}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {viewMode === 'grid' ? (
          <div className="grid grid-cols-4 gap-1">
            {telemetry.slice(0, 100).map(d => (
              <button
                key={d.id}
                onClick={() => { setSelectedDrone(d.id); setViewMode('detail'); }}
                className={cn(
                  "rounded p-1 text-[8px] font-mono transition-colors border",
                  d.alerts.length > 0
                    ? 'bg-red-500/10 border-red-500/30 text-red-400'
                    : d.battery < 40
                      ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400'
                      : 'bg-surface-1/60 border-border/30 text-foreground hover:bg-surface-2/60'
                )}
              >
                <div className="font-bold">#{d.id + 1}</div>
                <div>{d.battery.toFixed(0)}%</div>
              </button>
            ))}
          </div>
        ) : selected ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <button onClick={() => setViewMode('grid')} className="text-[10px] text-primary hover:underline">
                ← Back to grid
              </button>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" className="h-5 text-[9px] px-1.5"
                  disabled={selectedDrone === 0}
                  onClick={() => setSelectedDrone(prev => Math.max(0, (prev || 0) - 1))}
                >Prev</Button>
                <Button size="sm" variant="outline" className="h-5 text-[9px] px-1.5"
                  disabled={selectedDrone === telemetry.length - 1}
                  onClick={() => setSelectedDrone(prev => Math.min(telemetry.length - 1, (prev || 0) + 1))}
                >Next</Button>
              </div>
            </div>

            <div className="text-center">
              <div className="text-sm font-bold text-foreground">Drone #{selected.id + 1}</div>
              <Badge variant={selected.armed ? 'default' : 'outline'} className="text-[9px] mt-1">
                {selected.armed ? '🟢 ARMED' : '⚪ DISARMED'} · {selected.mode}
              </Badge>
            </div>

            {/* Battery detail */}
            <div className="bg-surface-1/60 rounded-md p-2 space-y-1">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground">
                <Battery className="w-3 h-3" /> Battery
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-3 bg-surface-2 rounded-full overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all", 
                      selected.battery > 50 ? 'bg-green-500' : selected.battery > 25 ? 'bg-yellow-500' : 'bg-red-500'
                    )}
                    style={{ width: `${selected.battery}%` }}
                  />
                </div>
                <span className="text-[11px] font-bold text-foreground">{selected.battery.toFixed(1)}%</span>
              </div>
              <div className="text-[9px] text-muted-foreground">{selected.voltage.toFixed(2)}V</div>
            </div>

            {/* Navigation */}
            <div className="bg-surface-1/60 rounded-md p-2 space-y-1">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground">
                <Navigation className="w-3 h-3" /> Navigation
              </div>
              <div className="grid grid-cols-2 gap-1 text-[9px]">
                <div><span className="text-muted-foreground">Alt:</span> <span className="text-foreground">{selected.altitude.toFixed(1)}m</span></div>
                <div><span className="text-muted-foreground">Spd:</span> <span className="text-foreground">{selected.speed.toFixed(1)}m/s</span></div>
                <div><span className="text-muted-foreground">Hdg:</span> <span className="text-foreground">{selected.heading.toFixed(0)}°</span></div>
                <div><span className="text-muted-foreground">GPS:</span> <span className="text-foreground">{selected.satellites} sats</span></div>
                <div><span className="text-muted-foreground">Pitch:</span> <span className="text-foreground">{selected.pitch.toFixed(1)}°</span></div>
                <div><span className="text-muted-foreground">Roll:</span> <span className="text-foreground">{selected.roll.toFixed(1)}°</span></div>
              </div>
            </div>

            {/* Signal */}
            <div className="bg-surface-1/60 rounded-md p-2 space-y-1">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground">
                <Wifi className="w-3 h-3" /> Signal
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 bg-surface-2 rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full" style={{ width: `${selected.signal}%` }} />
                </div>
                <span className="text-[9px] text-foreground">{selected.signal.toFixed(0)}%</span>
              </div>
            </div>

            {/* Alerts */}
            {selected.alerts.length > 0 && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-md p-2 space-y-1">
                <div className="flex items-center gap-1.5 text-[10px] font-semibold text-red-400">
                  <AlertTriangle className="w-3 h-3" /> Alerts
                </div>
                {selected.alerts.map((a, i) => (
                  <div key={i} className="text-[9px] text-red-300">{a}</div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="text-[10px] text-muted-foreground text-center py-8">
            Select a drone from the grid to view details
          </div>
        )}
      </div>
    </div>
  );
}
