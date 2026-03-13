import { useMemo, useState } from 'react';
import { Shield, AlertTriangle, AlertOctagon, CheckCircle, Settings2, Fence, Zap, Activity, CircleDot } from 'lucide-react';
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
import {
  crossValidate,
  FAILSAFE_ACTIONS,
  type EscalationLevel,
  type CrossValidationResult,
} from '@/lib/hcaSafetyLayer';
import { cn } from '@/lib/utils';

const ESCALATION_COLORS: Record<EscalationLevel, string> = {
  nominal: 'text-green-400',
  advisory: 'text-blue-400',
  caution: 'text-yellow-400',
  warning: 'text-orange-400',
  abort: 'text-red-500',
};

const ESCALATION_BG: Record<EscalationLevel, string> = {
  nominal: 'bg-green-500/10 border-green-500/30',
  advisory: 'bg-blue-500/10 border-blue-500/30',
  caution: 'bg-yellow-500/10 border-yellow-500/30',
  warning: 'bg-orange-500/10 border-orange-500/30',
  abort: 'bg-red-500/10 border-red-500/30',
};

export default function SafetyPanel() {
  const { trajectories, positions, timelineItems, duration, droneFormations } = useProjectStore();
  const [geofence, setGeofence] = useState<Geofence>(DEFAULT_GEOFENCE);
  const [showGeofenceSettings, setShowGeofenceSettings] = useState(false);
  const [showHCA, setShowHCA] = useState(true);

  // Classic deconfliction warnings
  const warnings = useMemo(() => {
    const deconflict = runDeconfliction(duration, trajectories, positions, timelineItems);
    const geofenceWarnings = runGeofenceCheck(geofence, duration, trajectories, positions, timelineItems);
    return [...deconflict, ...geofenceWarnings].sort((a, b) => a.time - b.time);
  }, [trajectories, positions, timelineItems, duration, geofence]);

  // HCA Cross-Validation
  const hcaResult: CrossValidationResult | null = useMemo(() => {
    if (!showHCA) return null;
    return crossValidate(duration, positions, trajectories, timelineItems, droneFormations);
  }, [duration, positions, trajectories, timelineItems, droneFormations, showHCA]);

  const criticalCount = warnings.filter((w) => w.severity === 'critical').length;
  const warningCount = warnings.filter((w) => w.severity === 'warning').length;
  const failsafeAction = hcaResult ? FAILSAFE_ACTIONS.find(a => a.level === hcaResult.escalation) : null;

  return (
    <div className="space-y-3">
      {/* Header badge */}
      <div className="flex items-center gap-2">
        <Shield className="h-3.5 w-3.5 text-primary" />
        <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">Safety</h3>
        {warnings.length === 0 && (!hcaResult || hcaResult.valid) ? (
          <span className="ml-auto flex items-center gap-1 text-[10px] text-green-400 font-mono-code">
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
              <span className="text-yellow-400 flex items-center gap-0.5">
                <AlertTriangle className="h-3 w-3" /> {warningCount}
              </span>
            )}
          </span>
        )}
      </div>

      {/* HCA Status Panel */}
      <div className="bg-surface-2 rounded-sm p-2 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Zap className="h-3 w-3 text-muted-foreground" />
            <span className="text-[10px] font-medium text-muted-foreground">HCA Cross-Validator</span>
          </div>
          <Switch
            checked={showHCA}
            onCheckedChange={setShowHCA}
            className="h-4 w-7"
          />
        </div>

        {showHCA && hcaResult && (
          <div className="space-y-1.5">
            {/* Escalation level indicator */}
            <div className={cn(
              "rounded-sm p-1.5 border text-[10px]",
              ESCALATION_BG[hcaResult.escalation]
            )}>
              <div className="flex items-center gap-1.5">
                <Activity className="h-3 w-3" />
                <span className={cn("font-semibold uppercase", ESCALATION_COLORS[hcaResult.escalation])}>
                  {failsafeAction?.label}
                </span>
              </div>
              <p className="text-[9px] text-muted-foreground mt-0.5">{failsafeAction?.description}</p>
              {!failsafeAction?.automatic && (
                <span className="text-[8px] text-destructive font-semibold mt-1 block">⚠ Requer confirmação do operador</span>
              )}
            </div>

            {/* Risk volumes summary */}
            {hcaResult.riskVolumes.length > 0 && (
              <div className="space-y-0.5">
                <span className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wider">Risk Volumes</span>
                {hcaResult.riskVolumes.slice(0, 8).map(rv => (
                  <div key={rv.id} className={cn(
                    "flex items-center gap-1 text-[9px] px-1 py-0.5 rounded-sm",
                    rv.type === 'overlap-zone' ? "bg-red-500/10 text-red-400" :
                    rv.type === 'pyro-exclusion' ? "bg-orange-500/10 text-orange-400" :
                    "bg-blue-500/10 text-blue-400"
                  )}>
                    <CircleDot className="h-2.5 w-2.5 flex-shrink-0" />
                    <span className="truncate">{rv.label}</span>
                    <span className="ml-auto text-muted-foreground">{rv.radius.toFixed(0)}m</span>
                  </div>
                ))}
              </div>
            )}

            {/* HCA violations */}
            {hcaResult.violations.length > 0 && (
              <div className="space-y-0.5">
                <span className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wider">
                  Violations ({hcaResult.violations.length})
                </span>
                {hcaResult.violations.slice(0, 6).map((v, i) => (
                  <div key={i} className="text-[9px] bg-red-500/10 text-red-400 px-1.5 py-0.5 rounded-sm">
                    <span className="font-mono-code">{v.subsystem.toUpperCase()}</span>
                    <span className="text-muted-foreground"> · </span>
                    {v.message}
                  </div>
                ))}
                {hcaResult.violations.length > 6 && (
                  <p className="text-[8px] text-muted-foreground text-center">+{hcaResult.violations.length - 6} more</p>
                )}
              </div>
            )}
          </div>
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
                  : "bg-yellow-500/10 text-yellow-400 border-yellow-500"
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
