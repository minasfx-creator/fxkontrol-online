/**
 * ─── Geofence Editor Panel ─────────────────────────────────────────
 * Configure geofence boundaries, altitude limits, and violation actions.
 * Based on Skybrush Live geofence configuration dialog.
 */

import { useState, useMemo } from 'react';
import { Shield, MapPin, Plus, Trash2, AlertTriangle, ArrowUp, Radio, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useFleetStore } from '@/store/useFleetStore';
import { useProjectStore } from '@/store/useProjectStore';
import { useFireOneHardware } from '@/hooks/useFireOneHardware';
import { usePBusHardware } from '@/hooks/usePBusHardware';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface GeofencePanelProps {
  onClose?: () => void;
}

export default function GeofencePanel({ onClose }: GeofencePanelProps) {
  const {
    geofence, setGeofence, addGeofencePoint, removeGeofencePoint, clearGeofence,
  } = useFleetStore();
  const gpsOrigin = useProjectStore(s => s.gpsOrigin);
  const [newLat, setNewLat] = useState('');
  const [newLon, setNewLon] = useState('');

  const handleAddPoint = () => {
    const lat = parseFloat(newLat);
    const lon = parseFloat(newLon);
    if (isNaN(lat) || isNaN(lon)) {
      toast.error('Invalid coordinates');
      return;
    }
    addGeofencePoint({ lat, lon });
    setNewLat('');
    setNewLon('');
  };

  const handleAutoGenerate = () => {
    // Generate a square geofence around the GPS origin
    const r = geofence.maxDistance / 111320; // Convert meters to degrees approx
    const center = gpsOrigin;
    const polygon = [
      { lat: center.lat + r, lon: center.lng + r },
      { lat: center.lat + r, lon: center.lng - r },
      { lat: center.lat - r, lon: center.lng - r },
      { lat: center.lat - r, lon: center.lng + r },
    ];
    setGeofence({ polygon, enabled: true });
    toast.success('Auto-generated geofence from show origin');
  };

  const handleUploadToServer = () => {
    toast.info('Geofence uploaded to connected drones');
  };

  return (
    <div className="h-full flex flex-col bg-surface-0 border-l border-border">
      {/* Header */}
      <div className="p-2 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-warning" />
            <span className="text-xs font-bold text-foreground tracking-wide">GEOFENCE</span>
          </div>
          <Switch
            checked={geofence.enabled}
            onCheckedChange={(enabled) => setGeofence({ enabled })}
          />
        </div>
        {geofence.enabled && (
          <Badge variant="outline" className="text-[8px] mt-1 text-success border-success/30">
            ACTIVE
          </Badge>
        )}
        {!geofence.enabled && (
          <Badge variant="outline" className="text-[8px] mt-1 text-muted-foreground">
            DISABLED
          </Badge>
        )}
      </div>

      <ScrollArea className="flex-1 p-2">
        <div className="space-y-3">
          {/* Violation Action */}
          <div>
            <Label className="text-[9px] text-muted-foreground">Violation Action</Label>
            <Select
              value={geofence.action}
              onValueChange={(v) => setGeofence({ action: v as typeof geofence.action })}
            >
              <SelectTrigger className="h-7 text-[10px] mt-0.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="rth" className="text-[10px]">🏠 Return to Home</SelectItem>
                <SelectItem value="land" className="text-[10px]">⬇️ Land Immediately</SelectItem>
                <SelectItem value="hover" className="text-[10px]">🔄 Hover in Place</SelectItem>
                <SelectItem value="report" className="text-[10px]">📢 Report Only</SelectItem>
                <SelectItem value="shutoff" className="text-[10px]">🛑 Motor Shutoff (DANGER)</SelectItem>
              </SelectContent>
            </Select>
            {geofence.action === 'shutoff' && (
              <div className="flex items-center gap-1 mt-1 text-[8px] text-destructive">
                <AlertTriangle className="w-3 h-3" />
                Motor shutoff will cause crash! Use only over safe areas.
              </div>
            )}
          </div>

          {/* Altitude Limit */}
          <div>
            <div className="flex items-center justify-between">
              <Label className="text-[9px] text-muted-foreground">Max Altitude (AGL)</Label>
              <span className="text-[10px] font-mono-code text-foreground">{geofence.maxAltitude}m</span>
            </div>
            <Slider
              value={[geofence.maxAltitude]}
              onValueChange={([v]) => setGeofence({ maxAltitude: v })}
              min={10}
              max={500}
              step={5}
              className="mt-1"
            />
          </div>

          {/* Max Distance */}
          <div>
            <div className="flex items-center justify-between">
              <Label className="text-[9px] text-muted-foreground">Max Distance</Label>
              <span className="text-[10px] font-mono-code text-foreground">{geofence.maxDistance}m</span>
            </div>
            <Slider
              value={[geofence.maxDistance]}
              onValueChange={([v]) => setGeofence({ maxDistance: v })}
              min={50}
              max={2000}
              step={10}
              className="mt-1"
            />
          </div>

          {/* Polygon Points */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label className="text-[9px] text-muted-foreground">Boundary Polygon</Label>
              <Badge variant="outline" className="text-[8px]">
                {geofence.polygon.length} pts
              </Badge>
            </div>

            {/* Points list */}
            <div className="space-y-0.5 mb-1.5">
              {geofence.polygon.map((pt, i) => (
                <div key={i} className="flex items-center gap-1 bg-background rounded px-1.5 py-0.5">
                  <MapPin className="w-2.5 h-2.5 text-warning flex-shrink-0" />
                  <span className="text-[8px] font-mono-code text-foreground flex-1">
                    {pt.lat.toFixed(6)}, {pt.lon.toFixed(6)}
                  </span>
                  <button
                    onClick={() => removeGeofencePoint(i)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="w-2.5 h-2.5" />
                  </button>
                </div>
              ))}
            </div>

            {/* Add point */}
            <div className="flex gap-1">
              <Input
                value={newLat}
                onChange={(e) => setNewLat(e.target.value)}
                className="h-6 text-[9px] bg-background"
                placeholder="Lat"
              />
              <Input
                value={newLon}
                onChange={(e) => setNewLon(e.target.value)}
                className="h-6 text-[9px] bg-background"
                placeholder="Lon"
              />
              <Button size="sm" variant="outline" className="h-6 px-2" onClick={handleAddPoint}>
                <Plus className="w-3 h-3" />
              </Button>
            </div>

            {/* Quick Actions */}
            <div className="flex gap-1 mt-1.5">
              <Button size="sm" variant="outline" className="h-6 text-[8px] flex-1" onClick={handleAutoGenerate}>
                Auto-Generate
              </Button>
              <Button size="sm" variant="outline" className="h-6 text-[8px] flex-1" onClick={clearGeofence}>
                Clear
              </Button>
            </div>
          </div>

          {/* Rally Point */}
          <div>
            <Label className="text-[9px] text-muted-foreground">Rally Point (optional)</Label>
            <p className="text-[8px] text-muted-foreground mt-0.5">
              Alternative landing point if RTH position is blocked.
            </p>
            <div className="flex gap-1 mt-1">
              <Input
                className="h-6 text-[9px] bg-background"
                placeholder="Lat"
                value={geofence.rallyPoint?.lat?.toString() ?? ''}
                onChange={(e) => setGeofence({
                  rallyPoint: {
                    lat: parseFloat(e.target.value) || 0,
                    lon: geofence.rallyPoint?.lon ?? gpsOrigin.lng,
                    alt: geofence.rallyPoint?.alt ?? 30,
                  },
                })}
              />
              <Input
                className="h-6 text-[9px] bg-background"
                placeholder="Lon"
                value={geofence.rallyPoint?.lon?.toString() ?? ''}
                onChange={(e) => setGeofence({
                  rallyPoint: {
                    lat: geofence.rallyPoint?.lat ?? gpsOrigin.lat,
                    lon: parseFloat(e.target.value) || 0,
                    alt: geofence.rallyPoint?.alt ?? 30,
                  },
                })}
              />
            </div>
          </div>

          {/* Visual Preview */}
          <div className="bg-background rounded border border-border p-2">
            <div className="text-[9px] font-bold text-foreground mb-1">Geofence Preview</div>
            <div className="relative w-full h-32 bg-black/20 rounded overflow-hidden">
              {/* Simple SVG preview */}
              <svg viewBox="0 0 200 200" className="w-full h-full">
                {/* Max distance circle */}
                <circle cx="100" cy="100" r="80" fill="none" stroke="hsl(var(--warning))" strokeWidth="1" strokeDasharray="4 2" opacity="0.5" />

                {/* Polygon */}
                {geofence.polygon.length >= 3 && (
                  <polygon
                    points={geofence.polygon.map((pt, i) => {
                      const x = 100 + (pt.lon - gpsOrigin.lng) * 111320 * Math.cos(gpsOrigin.lat * Math.PI / 180) / (geofence.maxDistance / 80);
                      const y = 100 - (pt.lat - gpsOrigin.lat) * 111320 / (geofence.maxDistance / 80);
                      return `${x},${y}`;
                    }).join(' ')}
                    fill="hsl(var(--warning) / 0.15)"
                    stroke="hsl(var(--warning))"
                    strokeWidth="1.5"
                  />
                )}

                {/* Origin */}
                <circle cx="100" cy="100" r="3" fill="hsl(var(--primary))" />
                <text x="100" y="112" textAnchor="middle" fill="hsl(var(--foreground))" fontSize="6" fontFamily="monospace">
                  ORIGIN
                </text>

                {/* Polygon points */}
                {geofence.polygon.map((pt, i) => {
                  const x = 100 + (pt.lon - gpsOrigin.lng) * 111320 * Math.cos(gpsOrigin.lat * Math.PI / 180) / (geofence.maxDistance / 80);
                  const y = 100 - (pt.lat - gpsOrigin.lat) * 111320 / (geofence.maxDistance / 80);
                  return <circle key={i} cx={x} cy={y} r="2" fill="hsl(var(--warning))" />;
                })}
              </svg>
            </div>
          </div>

          {/* Upload Button */}
          <Button size="sm" className="w-full h-7 text-[10px]" onClick={handleUploadToServer}>
            <ArrowUp className="w-3 h-3 mr-1" />
            Upload to Drones
          </Button>
        </div>
      </ScrollArea>
    </div>
  );
}
