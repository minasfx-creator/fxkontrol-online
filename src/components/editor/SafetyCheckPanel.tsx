/**
 * ─── Safety Check Panel ─────────────────────────────────────────
 * Skybrush-style trajectory safety validation with real-time
 * violation display, flight envelope graphs, and safety report export.
 */

import { useState, useMemo, useCallback } from 'react';
import { useProjectStore } from '@/store/useProjectStore';
import { Shield, AlertTriangle, CheckCircle, XCircle, Play, Download, Settings, ChevronDown, ChevronRight, Radio, Wifi, Battery } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useFireOneHardware } from '@/hooks/useFireOneHardware';
import { usePBusHardware } from '@/hooks/usePBusHardware';
import {
  type SafetyCheckParams,
  type SafetyCheckResult,
  type SafetyViolation,
  DEFAULT_SAFETY_PARAMS,
  runSafetyCheck,
  formatSafetyReport,
} from '@/lib/skybrushSafetyCheck';

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-red-500/20 text-red-400 border-red-500/40',
  error: 'bg-orange-500/20 text-orange-400 border-orange-500/40',
  warning: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40',
};

const SEVERITY_ICONS: Record<string, typeof AlertTriangle> = {
  critical: XCircle,
  error: AlertTriangle,
  warning: AlertTriangle,
};

export default function SafetyCheckPanel() {
  const { trajectories, droneFormations, duration, setCurrentTime } = useProjectStore();
  const fireone = useFireOneHardware();
  const pbus = usePBusHardware();
  const [params, setParams] = useState<SafetyCheckParams>(DEFAULT_SAFETY_PARAMS);
  const [result, setResult] = useState<SafetyCheckResult | null>(null);
  const [running, setRunning] = useState(false);
  const [showParams, setShowParams] = useState(false);
  const [filterSeverity, setFilterSeverity] = useState<string | null>(null);

  // Hardware safety gates
  const hwChecks = useMemo(() => {
    const checks: { label: string; status: 'pass' | 'fail' | 'warn' | 'na'; detail: string }[] = [];

    // FireOne checks
    if (fireone.isConnected) {
      const modules = Array.from(fireone.modules.values());
      const lowBatt = modules.filter(m => (m.batteryVoltage ?? 12) < 11.0);
      checks.push({
        label: 'FireOne Link',
        status: 'pass',
        detail: `${modules.length} modules on RS-485`,
      });
      checks.push({
        label: 'FireOne Battery',
        status: lowBatt.length > 0 ? 'fail' : 'pass',
        detail: lowBatt.length > 0 ? `${lowBatt.length} modules < 11.0V` : 'All modules OK',
      });
      const weakSignal = modules.filter(m => m.rssiDbm !== undefined && m.rssiDbm < -75);
      if (weakSignal.length > 0) {
        checks.push({ label: 'FireOne Signal', status: 'warn', detail: `${weakSignal.length} modules weak RSSI` });
      }
    } else {
      checks.push({ label: 'FireOne', status: 'na', detail: 'Not connected' });
    }

    // PBUS checks
    if (pbus.isConnected) {
      const devices = Array.from(pbus.devices.values());
      const lowBatt = devices.filter(d => d.batteryV < 11.0);
      checks.push({
        label: 'PBUS Link',
        status: 'pass',
        detail: `${devices.length} Showven devices`,
      });
      checks.push({
        label: 'PBUS Battery',
        status: lowBatt.length > 0 ? 'fail' : 'pass',
        detail: lowBatt.length > 0 ? `${lowBatt.length} devices < 11.0V` : 'All devices OK',
      });
      const openCues = devices.reduce((sum, d) => sum + d.cueStates.filter(c => !c.connected && !c.fired).length, 0);
      if (openCues > 0) {
        checks.push({ label: 'PBUS Continuity', status: 'warn', detail: `${openCues} open cues` });
      }
    } else {
      checks.push({ label: 'PBUS', status: 'na', detail: 'Not connected' });
    }

    return checks;
  }, [fireone.isConnected, fireone.modules, pbus.isConnected, pbus.devices]);

  const hwBlocksFiring = useMemo(() => hwChecks.some(c => c.status === 'fail'), [hwChecks]);

  // Build trajectories from drone formations for checking
  const droneTrajectories = useMemo(() => {
    if (trajectories.length > 0) {
      return trajectories.map(t => ({
        id: t.positionId,
        waypoints: t.waypoints.map(wp => ({ time: wp.time, position: wp.position })),
      }));
    }

    // Generate from formations
    if (droneFormations.length === 0) return [];
    const droneCount = droneFormations[0].droneCount;
    const result: { id: string; waypoints: { time: number; position: { x: number; y: number; z: number } }[] }[] = [];

    for (let i = 0; i < droneCount; i++) {
      const waypoints: { time: number; position: { x: number; y: number; z: number } }[] = [];
      // Ground position
      const cols = Math.ceil(Math.sqrt(droneCount));
      const row = Math.floor(i / cols);
      const col = i % cols;
      const spacing = 2.5;
      const gx = (col - (cols - 1) / 2) * spacing;
      const gz = (row - (Math.ceil(droneCount / cols) - 1) / 2) * spacing;
      waypoints.push({ time: 0, position: { x: gx, y: 0.1, z: gz } });

      for (const f of droneFormations) {
        const point = f.points[i];
        if (point) {
          waypoints.push({
            time: f.startTime,
            position: { x: point.x, y: f.height + point.z, z: 0 },
          });
          waypoints.push({
            time: f.startTime + f.transitionDuration + f.holdDuration,
            position: { x: point.x, y: f.height + point.z, z: 0 },
          });
        }
      }
      // Landing
      waypoints.push({ time: duration, position: { x: gx, y: 0.1, z: gz } });
      result.push({ id: `drone-${i}`, waypoints });
    }
    return result;
  }, [trajectories, droneFormations, duration]);

  const handleRunCheck = useCallback(() => {
    if (droneTrajectories.length === 0) {
      toast.error('No drone trajectories to validate');
      return;
    }
    setRunning(true);
    setTimeout(() => {
      const checkResult = runSafetyCheck(droneTrajectories, params, duration, 10);
      setResult(checkResult);
      setRunning(false);
      if (checkResult.passed) {
        toast.success(`Safety check PASSED — ${checkResult.violations.length} warnings`);
      } else {
        toast.error(`Safety check FAILED — ${checkResult.violations.filter(v => v.severity !== 'warning').length} violations`);
      }
    }, 100);
  }, [droneTrajectories, params, duration]);

  const handleExportReport = useCallback(() => {
    if (!result) return;
    const report = formatSafetyReport(result);
    const blob = new Blob([report], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'safety_report.txt';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Safety report exported');
  }, [result]);

  const filteredViolations = useMemo(() => {
    if (!result) return [];
    if (!filterSeverity) return result.violations;
    return result.violations.filter(v => v.severity === filterSeverity);
  }, [result, filterSeverity]);

  const updateParam = (key: keyof SafetyCheckParams, value: number) => {
    setParams(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="space-y-3 p-1">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-primary" />
          <span className="text-xs font-semibold text-foreground">Safety Check</span>
          <Badge variant="outline" className="text-[9px]">Skybrush</Badge>
        </div>
      </div>

      {/* Run button */}
      <Button
        size="sm"
        className="w-full h-8 text-[10px]"
        onClick={handleRunCheck}
        disabled={running || droneTrajectories.length === 0}
      >
        {running ? (
          <div className="w-3 h-3 border border-primary-foreground border-t-transparent rounded-full animate-spin mr-1" />
        ) : (
          <Play className="w-3 h-3 mr-1" />
        )}
        {running ? 'Checking...' : `Run Safety Check (${droneTrajectories.length} drones)`}
      </Button>

      {/* Parameters toggle */}
      <button className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground w-full" onClick={() => setShowParams(!showParams)}>
        {showParams ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        <Settings className="w-3 h-3" /> Flight Envelope Parameters
      </button>

      {showParams && (
        <div className="grid grid-cols-2 gap-2 p-2 bg-surface-1 rounded border border-border/40">
          {([
            ['maxAltitude', 'Max Alt (m)', 10, 500],
            ['maxVelocityXY', 'Max Vel XY (m/s)', 1, 30],
            ['maxVelocityZ', 'Max Vel Z↓ (m/s)', 1, 15],
            ['maxVelocityZUp', 'Max Vel Z↑ (m/s)', 1, 15],
            ['maxAcceleration', 'Max Acc (m/s²)', 1, 20],
            ['minDistance', 'Min Distance (m)', 0.5, 20],
            ['minNavAltitude', 'Min Nav Alt (m)', 0.5, 10],
            ['maxYawRate', 'Max Yaw (°/s)', 10, 180],
            ['geofenceRadius', 'Geofence R (m)', 50, 2000],
            ['geofenceHeight', 'Geofence H (m)', 50, 500],
          ] as const).map(([key, label, min, max]) => (
            <div key={key}>
              <label className="text-[9px] text-muted-foreground">{label}</label>
              <Input
                type="number"
                step={key === 'minDistance' || key === 'minNavAltitude' ? 0.5 : 1}
                min={min}
                max={max}
                value={params[key]}
                onChange={e => updateParam(key, +e.target.value)}
                className="h-6 text-[10px]"
              />
            </div>
          ))}
        </div>
      )}

      {/* Results */}
      {result && (
        <>
          {/* Status banner */}
          <div className={`p-2 rounded border ${result.passed ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
            <div className="flex items-center gap-2">
              {result.passed ? <CheckCircle className="w-4 h-4 text-green-400" /> : <XCircle className="w-4 h-4 text-red-400" />}
              <span className="text-xs font-semibold">{result.passed ? 'PASSED' : 'FAILED'}</span>
              <span className="text-[10px] text-muted-foreground ml-auto">{result.violations.length} issues</span>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-1.5">
            {[
              ['Max Alt', `${result.stats.maxAltitudeReached.toFixed(1)}m`, result.stats.maxAltitudeReached > params.maxAltitude],
              ['Max Vel XY', `${result.stats.maxVelocityXYReached.toFixed(1)}m/s`, result.stats.maxVelocityXYReached > params.maxVelocityXY],
              ['Max Vel Z', `${result.stats.maxVelocityZReached.toFixed(1)}m/s`, result.stats.maxVelocityZReached > params.maxVelocityZ],
              ['Min Prox', `${result.stats.minProximityReached.toFixed(2)}m`, result.stats.minProximityReached < params.minDistance],
              ['Max Acc', `${result.stats.maxAccelerationReached.toFixed(1)}m/s²`, result.stats.maxAccelerationReached > params.maxAcceleration],
              ['Dist/Drone', `${result.stats.totalDistance.toFixed(0)}m`, false],
            ].map(([label, value, exceeded]) => (
              <div key={label as string} className={`p-1.5 rounded border text-[9px] ${exceeded ? 'border-red-500/40 bg-red-500/5' : 'border-border/30 bg-surface-1'}`}>
                <div className="text-muted-foreground">{label as string}</div>
                <div className={`font-mono-code font-bold ${exceeded ? 'text-red-400' : 'text-foreground'}`}>{value as string}</div>
              </div>
            ))}
          </div>

          {/* Profile charts (SVG mini-charts) */}
          <div className="space-y-1">
            {(['altitude', 'velocityXY', 'proximity'] as const).map(profileKey => {
              const profile = result.profiles[profileKey];
              if (!profile || profile.length === 0) return null;
              const maxVal = Math.max(...profile.map(p => 'max' in p ? (p as any).max : (p as any).min));
              const label = profileKey === 'altitude' ? 'Altitude' : profileKey === 'velocityXY' ? 'Velocity XY' : 'Proximity';
              const limit = profileKey === 'altitude' ? params.maxAltitude : profileKey === 'velocityXY' ? params.maxVelocityXY : params.minDistance;

              return (
                <div key={profileKey} className="p-1.5 bg-surface-1 rounded border border-border/30">
                  <div className="text-[9px] text-muted-foreground mb-1">{label}</div>
                  <svg viewBox="0 0 200 30" className="w-full h-6">
                    {/* Limit line */}
                    {maxVal > 0 && (
                      <line x1="0" y1={30 - (limit / Math.max(maxVal * 1.2, 1)) * 30} x2="200" y2={30 - (limit / Math.max(maxVal * 1.2, 1)) * 30} stroke="hsl(var(--destructive))" strokeWidth="0.5" strokeDasharray="3,2" opacity="0.6" />
                    )}
                    {/* Data line */}
                    <polyline
                      fill="none"
                      stroke="hsl(var(--primary))"
                      strokeWidth="1"
                      points={profile.map((p, i) => {
                        const x = (i / Math.max(profile.length - 1, 1)) * 200;
                        const val = 'max' in p ? (p as any).max : (p as any).min;
                        const y = 30 - (val / Math.max(maxVal * 1.2, 1)) * 30;
                        return `${x},${y}`;
                      }).join(' ')}
                    />
                  </svg>
                </div>
              );
            })}
          </div>

          {/* Violation filter */}
          <div className="flex gap-1">
            <Button size="sm" variant={filterSeverity === null ? 'default' : 'outline'} className="h-5 text-[9px] px-2" onClick={() => setFilterSeverity(null)}>All ({result.violations.length})</Button>
            {(['critical', 'error', 'warning'] as const).map(sev => {
              const count = result.violations.filter(v => v.severity === sev).length;
              if (count === 0) return null;
              return (
                <Button key={sev} size="sm" variant={filterSeverity === sev ? 'default' : 'outline'} className="h-5 text-[9px] px-2" onClick={() => setFilterSeverity(sev)}>
                  {sev === 'critical' ? '🔴' : sev === 'error' ? '🟠' : '🟡'} {count}
                </Button>
              );
            })}
          </div>

          {/* Violation list */}
          <ScrollArea className="h-[200px]">
            <div className="space-y-1 pr-2">
              {filteredViolations.slice(0, 100).map((v, i) => {
                const Icon = SEVERITY_ICONS[v.severity] || AlertTriangle;
                return (
                  <button
                    key={i}
                    className={`w-full text-left p-1.5 rounded border text-[9px] ${SEVERITY_COLORS[v.severity]}`}
                    onClick={() => setCurrentTime(v.time)}
                  >
                    <div className="flex items-center gap-1">
                      <Icon className="w-3 h-3 shrink-0" />
                      <span className="font-mono-code">{v.time.toFixed(1)}s</span>
                      <span className="truncate flex-1">{v.message}</span>
                    </div>
                  </button>
                );
              })}
              {filteredViolations.length > 100 && (
                <div className="text-[9px] text-muted-foreground text-center py-1">...and {filteredViolations.length - 100} more</div>
              )}
            </div>
          </ScrollArea>

          {/* Export */}
          <Button size="sm" variant="outline" className="w-full h-7 text-[10px]" onClick={handleExportReport}>
            <Download className="w-3 h-3 mr-1" /> Export Safety Report
          </Button>
        </>
      )}
    </div>
  );
}
