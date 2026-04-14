import { useState } from 'react';
import { Warehouse, X, Radio, AlertTriangle, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import {
  VENUE_PRESETS, MICRO_DRONE_PRESETS, POSITIONING_MODES,
  type IndoorVenue, type IndoorDroneSpec, type PositioningMode,
} from '@/lib/indoorSimulation';
import { cn } from '@/lib/utils';

export default function IndoorSimPanel({ onClose }: { onClose: () => void }) {
  const [venue, setVenue] = useState<IndoorVenue>(VENUE_PRESETS[0]);
  const [drone, setDrone] = useState<IndoorDroneSpec>(MICRO_DRONE_PRESETS[0]);
  const [posMode, setPosMode] = useState<PositioningMode>(POSITIONING_MODES[0]);
  const [droneCount, setDroneCount] = useState(30);
  const [showUWB, setShowUWB] = useState(true);
  const [showObstacles, setShowObstacles] = useState(true);
  const [safetyMargin, setSafetyMargin] = useState(0.5);

  return (
    <div className="h-full flex flex-col bg-card border-l border-border">
      <div className="px-3 py-2 border-b border-border flex items-center gap-2">
        <Warehouse className="h-3.5 w-3.5 text-primary" />
        <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider flex-1">Indoor Sim</h2>
        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={onClose}>
          <X className="h-3 w-3" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-3">
        {/* Venue selector */}
        <div>
          <label className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">Venue</label>
          <div className="space-y-1 mt-1">
            {VENUE_PRESETS.map(v => (
              <button
                key={v.id}
                onClick={() => setVenue(v)}
                className={cn(
                  "w-full text-left px-2 py-1.5 rounded-sm text-[10px] transition-colors",
                  venue.id === v.id ? "bg-primary/15 text-primary border border-primary/30" : "bg-surface-2 text-muted-foreground hover:text-foreground"
                )}
              >
                <div className="font-semibold">{v.name}</div>
                <div className="text-[8px] text-muted-foreground font-mono-code mt-0.5">
                  {v.width}×{v.depth}m · H:{v.height}m · {v.uwbAnchors.length} UWB · {v.obstacles.length} obs
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Drone spec */}
        <div>
          <label className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">Micro-Drone</label>
          <div className="space-y-1 mt-1">
            {MICRO_DRONE_PRESETS.map(d => (
              <button
                key={d.name}
                onClick={() => setDrone(d)}
                className={cn(
                  "w-full text-left px-2 py-1.5 rounded-sm text-[10px] transition-colors",
                  drone.name === d.name ? "bg-primary/15 text-primary border border-primary/30" : "bg-surface-2 text-muted-foreground hover:text-foreground"
                )}
              >
                <div className="font-semibold">{d.name}</div>
                <div className="text-[8px] font-mono-code mt-0.5">
                  {d.weight}g · ⌀{d.diameter}cm · {d.batteryLife}min · {d.ledCount} LED
                  {d.propGuard && ' · 🛡️'}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Positioning mode */}
        <div>
          <label className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">Posicionamento</label>
          <div className="grid grid-cols-2 gap-1 mt-1">
            {POSITIONING_MODES.map(pm => (
              <button
                key={pm.type}
                onClick={() => setPosMode(pm)}
                className={cn(
                  "px-2 py-1.5 rounded-sm text-[9px] transition-colors text-left",
                  posMode.type === pm.type ? "bg-primary/15 text-primary" : "bg-surface-2 text-muted-foreground"
                )}
              >
                <div className="font-semibold uppercase">{pm.type}</div>
                <div className="text-[7px] font-mono-code mt-0.5">
                  ±{pm.accuracy}m · {pm.updateRate}Hz · {pm.latency}ms
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Config */}
        <div className="space-y-2">
          <div>
            <label className="text-[9px] text-muted-foreground uppercase">Drones: {droneCount}</label>
            <Slider value={[droneCount]} min={5} max={200} step={5} onValueChange={([v]) => setDroneCount(v)} />
          </div>
          <div>
            <label className="text-[9px] text-muted-foreground uppercase">Margem de segurança: {safetyMargin}m</label>
            <Slider value={[safetyMargin]} min={0.1} max={2} step={0.1} onValueChange={([v]) => setSafetyMargin(v)} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[9px] text-muted-foreground">Mostrar UWB Anchors</span>
            <Switch checked={showUWB} onCheckedChange={setShowUWB} className="h-4 w-7" />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[9px] text-muted-foreground">Mostrar Obstáculos</span>
            <Switch checked={showObstacles} onCheckedChange={setShowObstacles} className="h-4 w-7" />
          </div>
        </div>

        {/* Venue stats */}
        <div className="bg-surface-2 rounded-sm p-2 space-y-1">
          <span className="text-[9px] font-semibold text-muted-foreground uppercase">Análise do Venue</span>
          <div className="grid grid-cols-2 gap-1 text-[8px] font-mono-code">
            <div className="text-muted-foreground">Volume:</div>
            <div className="text-foreground">{(venue.width * venue.height * venue.depth).toFixed(0)} m³</div>
            <div className="text-muted-foreground">Área piso:</div>
            <div className="text-foreground">{(venue.width * venue.depth).toFixed(0)} m²</div>
            <div className="text-muted-foreground">Max drones:</div>
            <div className="text-foreground">{Math.floor((venue.width * venue.depth) / (safetyMargin * safetyMargin * 4))}</div>
            <div className="text-muted-foreground">Cobertura UWB:</div>
            <div className={venue.uwbAnchors.length >= 4 ? "text-green-400" : "text-yellow-400"}>
              {venue.uwbAnchors.length >= 4 ? '100% (3D)' : venue.uwbAnchors.length >= 3 ? '~90% (2.5D)' : 'Insuficiente'}
            </div>
            <div className="text-muted-foreground">Ruído drone:</div>
            <div className={drone.noiseLevel > 50 ? "text-yellow-400" : "text-green-400"}>
              {drone.noiseLevel} dB
            </div>
          </div>
          
          {droneCount > Math.floor((venue.width * venue.depth) / (safetyMargin * safetyMargin * 4)) && (
            <div className="flex items-center gap-1 text-[8px] text-yellow-400 mt-1">
              <AlertTriangle className="h-2.5 w-2.5" />
              Excede capacidade segura do venue
            </div>
          )}
        </div>

        {/* Obstacles list */}
        {venue.obstacles.length > 0 && (
          <div className="space-y-1">
            <span className="text-[9px] font-semibold text-muted-foreground uppercase">Obstáculos</span>
            {venue.obstacles.map(obs => (
              <div key={obs.id} className="flex items-center gap-1.5 text-[9px] bg-surface-2 rounded-sm px-2 py-1">
                <MapPin className="h-2.5 w-2.5 text-yellow-400" />
                <span className="text-foreground flex-1">{obs.label}</span>
                <span className="text-muted-foreground font-mono-code">{obs.type}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
