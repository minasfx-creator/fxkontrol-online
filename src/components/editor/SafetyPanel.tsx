import { useMemo, useState } from 'react';
import { Shield, AlertTriangle, AlertOctagon, CheckCircle, Settings2, Fence } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useProjectStore } from '@/store/useProjectStore';
import {
  runDeconfliction,
  runGeofenceCheck,
  DEFAULT_GEOFENCE,
  type CollisionWarning,
  type Geofence,
} from '@/lib/safetyEngine';
import { cn } from '@/lib/utils';

export default function SafetyPanel() {
  const { trajectories, positions, timelineItems, duration } = useProjectStore();
  const [geofence, setGeofence] = useState<Geofence>(DEFAULT_GEOFENCE);
  const [showGeofenceSettings, setShowGeofenceSettings] = useState(false);

  const warnings = useMemo(() => {
    const deconflict = runDeconfliction(duration, trajectories, positions, timelineItems);
    const geofenceWarnings = runGeofenceCheck(geofence, duration, trajectories, positions, timelineItems);
    return [...deconflict, ...geofenceWarnings].sort((a, b) => a.time - b.time);
  }, [trajectories, positions, timelineItems, duration, geofence]);

  const criticalCount = warnings.filter((w) => w.severity === 'critical').length;
  const warningCount = warnings.filter((w) => w.severity === 'warning').length;

  return (
    <div className="space-y-3">
      {/* Header badge */}
      <div className="flex items-center gap-2">
        <Shield className="h-3.5 w-3.5 text-primary" />
        <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">Safety</h3>
        {warnings.length === 0 ? (
          <span className="ml-auto flex items-center gap-1 text-[10px] text-success font-mono-code">
            <CheckCircle className="h-3 w-3" /> Clear
          </span>
        ) : (
          <span className="ml-auto flex items-center gap-1.5 text-[10px] font-mono-code">
            {criticalCount > 0 && (
              <span className="text-destructive flex items-center gap-0.5">
                <AlertOctagon className="h-3 w-3" /> {criticalCount}
              </span>
            )}
            {warningCount > 0 && (
              <span className="text-warning flex items-center gap-0.5">
                <AlertTriangle className="h-3 w-3" /> {warningCount}
              </span>
            )}
          </span>
        )}
      </div>

      {/* Geofence toggle + settings */}
      <div className="bg-surface-2 rounded-sm p-2 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Fence className="h-3 w-3 text-muted-foreground" />
            <span className="text-[10px] font-medium text-muted-foreground">Geofence</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5"
              onClick={() => setShowGeofenceSettings(!showGeofenceSettings)}
            >
              <Settings2 className="h-3 w-3" />
            </Button>
            <Switch
              checked={geofence.enabled}
              onCheckedChange={(v) => setGeofence({ ...geofence, enabled: v })}
              className="h-4 w-7"
            />
          </div>
        </div>

        {showGeofenceSettings && geofence.enabled && (
          <div className="grid grid-cols-2 gap-1.5 text-[10px]">
            {(['X', 'Y', 'Z'] as const).map((axis) => {
              const minKey = `min${axis}` as keyof Geofence;
              const maxKey = `max${axis}` as keyof Geofence;
              return (
                <div key={axis} className="col-span-2 grid grid-cols-5 gap-1 items-center">
                  <span className="font-mono-code text-muted-foreground">{axis}</span>
                  <Input
                    type="number"
                    value={geofence[minKey] as number}
                    onChange={(e) => setGeofence({ ...geofence, [minKey]: parseFloat(e.target.value) || 0 })}
                    className="h-5 text-[10px] font-mono-code px-1 bg-surface-0 border-border col-span-2"
                    placeholder="min"
                  />
                  <Input
                    type="number"
                    value={geofence[maxKey] as number}
                    onChange={(e) => setGeofence({ ...geofence, [maxKey]: parseFloat(e.target.value) || 0 })}
                    className="h-5 text-[10px] font-mono-code px-1 bg-surface-0 border-border col-span-2"
                    placeholder="max"
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Warning list */}
      {warnings.length > 0 && (
        <div className="space-y-1 max-h-40 overflow-y-auto">
          {warnings.slice(0, 20).map((w, i) => (
            <div
              key={i}
              className={cn(
                "px-2 py-1 rounded-sm text-[9px] font-mono-code border-l-2",
                w.severity === 'critical'
                  ? "bg-destructive/10 text-destructive border-destructive"
                  : "bg-warning/10 text-warning border-warning"
              )}
            >
              <div className="flex items-center gap-1">
                {w.severity === 'critical' ? (
                  <AlertOctagon className="h-2.5 w-2.5 flex-shrink-0" />
                ) : (
                  <AlertTriangle className="h-2.5 w-2.5 flex-shrink-0" />
                )}
                <span>{w.type === 'geofence' ? 'GEOFENCE' : 'DECONFLICT'}</span>
              </div>
              <p className="mt-0.5 text-foreground/80">{w.message}</p>
            </div>
          ))}
          {warnings.length > 20 && (
            <p className="text-[9px] text-muted-foreground text-center">+{warnings.length - 20} more</p>
          )}
        </div>
      )}
    </div>
  );
}
