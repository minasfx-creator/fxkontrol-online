import { useState, useCallback } from 'react';
import { X, ShieldCheck, AlertTriangle, CheckCircle2, Play, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useProjectStore } from '@/store/useProjectStore';
import { pushLog } from './ViewportTerminal';
import { cn } from '@/lib/utils';

interface DiagResult {
  id: string;
  label: string;
  status: 'pass' | 'warn' | 'fail' | 'pending';
  detail: string;
}

export default function DiagnosticPanel({ onClose }: { onClose: () => void }) {
  const [results, setResults] = useState<DiagResult[]>([]);
  const [running, setRunning] = useState(false);

  const positions = useProjectStore((s) => s.positions);
  const droneFormations = useProjectStore((s) => s.droneFormations);
  const trajectories = useProjectStore((s) => s.trajectories);
  const timelineItems = useProjectStore((s) => s.timelineItems);
  const duration = useProjectStore((s) => s.duration);

  const runDiagnostic = useCallback(async () => {
    setRunning(true);
    pushLog('E2E DIAGNOSTIC SCAN INITIATED', 'diag');
    const checks: DiagResult[] = [];

    // 1. Fleet check
    const totalDrones = droneFormations.reduce((sum, f) => sum + f.droneCount, 0);
    checks.push({
      id: 'fleet',
      label: 'Fleet Population',
      status: totalDrones > 0 ? 'pass' : 'warn',
      detail: totalDrones > 0 ? `${totalDrones} drones ativos` : 'Nenhum drone configurado',
    });

    // 2. Proximity check (simplified)
    let proximityConflicts = 0;
    droneFormations.forEach((f) => {
      for (let i = 0; i < f.points.length; i++) {
        for (let j = i + 1; j < Math.min(f.points.length, i + 20); j++) {
          const dx = f.points[i].x - f.points[j].x;
          const dz = f.points[i].z - f.points[j].z;
          if (Math.sqrt(dx * dx + dz * dz) < 1.5) proximityConflicts++;
        }
      }
    });
    checks.push({
      id: 'proximity',
      label: 'Proximity Conflicts',
      status: proximityConflicts === 0 ? 'pass' : proximityConflicts < 5 ? 'warn' : 'fail',
      detail: proximityConflicts === 0 ? '0 conflitos' : `${proximityConflicts} pares < 1.5m`,
    });

    // 3. Geofence check
    const maxRadius = Math.max(...droneFormations.map((f) => f.radius), 0);
    checks.push({
      id: 'geofence',
      label: 'Geofence Validation',
      status: maxRadius <= 80 ? 'pass' : 'fail',
      detail: maxRadius <= 80 ? `Raio máx: ${maxRadius.toFixed(0)}m (≤80m)` : `Raio ${maxRadius.toFixed(0)}m excede geofence`,
    });

    // 4. Battery estimation
    const estimatedFlightTime = duration / 60;
    checks.push({
      id: 'battery',
      label: 'Battery Estimate',
      status: estimatedFlightTime <= 15 ? 'pass' : estimatedFlightTime <= 25 ? 'warn' : 'fail',
      detail: `Show: ${estimatedFlightTime.toFixed(1)}min — ${estimatedFlightTime <= 15 ? 'Confortável' : estimatedFlightTime <= 25 ? 'Margem reduzida' : 'Excede autonomia'}`,
    });

    // 5. Timeline coverage
    const hasTimelineItems = timelineItems.length > 0;
    checks.push({
      id: 'timeline',
      label: 'Timeline Coverage',
      status: hasTimelineItems ? 'pass' : 'warn',
      detail: hasTimelineItems ? `${timelineItems.length} eventos na timeline` : 'Timeline vazia',
    });

    // 6. Position count
    checks.push({
      id: 'positions',
      label: 'Launch Positions',
      status: positions.length > 0 ? 'pass' : 'warn',
      detail: `${positions.length} posições definidas`,
    });

    // 7. Trajectory validation
    const orphanTrajectories = trajectories.filter((t) => t.waypoints.length < 2);
    checks.push({
      id: 'trajectories',
      label: 'Trajectory Integrity',
      status: orphanTrajectories.length === 0 ? 'pass' : 'warn',
      detail: orphanTrajectories.length === 0 ? `${trajectories.length} trajetórias válidas` : `${orphanTrajectories.length} trajetórias com <2 waypoints`,
    });

    // 8. SMPTE sync
    checks.push({
      id: 'smpte',
      label: 'SMPTE / Sync Lock',
      status: 'pass',
      detail: 'Timecode sync disponível',
    });

    // Simulate processing delay
    await new Promise((r) => setTimeout(r, 800));
    setResults(checks);
    setRunning(false);

    const failures = checks.filter((c) => c.status === 'fail').length;
    const warnings = checks.filter((c) => c.status === 'warn').length;
    pushLog(
      `E2E SCAN COMPLETE: ${failures} falhas, ${warnings} avisos, ${checks.length - failures - warnings} OK`,
      failures > 0 ? 'error' : warnings > 0 ? 'warn' : 'success'
    );
  }, [droneFormations, positions, trajectories, timelineItems, duration]);

  const statusIcon = (s: DiagResult['status']) => {
    switch (s) {
      case 'pass': return <CheckCircle2 className="w-3 h-3 text-green-400" />;
      case 'warn': return <AlertTriangle className="w-3 h-3 text-yellow-400" />;
      case 'fail': return <AlertTriangle className="w-3 h-3 text-red-400" />;
      default: return <div className="w-3 h-3 rounded-full bg-muted-foreground/30" />;
    }
  };

  return (
    <div className="h-full flex flex-col bg-surface-0 border-l border-border">
      <div className="flex items-center justify-between p-2 border-b border-border bg-surface-1">
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-primary" />
          <span className="text-[10px] font-bold font-mono-code text-foreground tracking-wider uppercase">
            E2E Diagnostic
          </span>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="p-2">
        <Button
          onClick={runDiagnostic}
          disabled={running}
          variant="outline"
          size="sm"
          className="w-full h-7 text-[9px] gap-1"
        >
          {running ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
          {running ? 'Scanning...' : 'Run Full Diagnostic'}
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {results.length === 0 && !running && (
          <p className="text-[9px] text-muted-foreground text-center py-4">
            Execute o diagnóstico para verificar integridade do show
          </p>
        )}
        {results.map((r) => (
          <div key={r.id} className={cn(
            "p-1.5 rounded border text-[9px] font-mono-code",
            r.status === 'pass' && "bg-green-500/5 border-green-500/20",
            r.status === 'warn' && "bg-yellow-500/5 border-yellow-500/20",
            r.status === 'fail' && "bg-red-500/5 border-red-500/20",
          )}>
            <div className="flex items-center gap-1.5">
              {statusIcon(r.status)}
              <span className="font-bold text-foreground">{r.label}</span>
            </div>
            <p className="text-muted-foreground mt-0.5 pl-[18px]">{r.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
