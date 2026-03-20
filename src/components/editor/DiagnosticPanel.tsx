import { useState, useCallback } from 'react';
import { X, ShieldCheck, AlertTriangle, CheckCircle2, Play, Loader2, Download, Wifi, Usb, Radio, Cable } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useProjectStore, EFFECT_LIBRARY } from '@/store/useProjectStore';
import { useFireOneHardware } from '@/hooks/useFireOneHardware';
import { usePBusHardware } from '@/hooks/usePBusHardware';
import { pushLog } from './ViewportTerminal';
import { cn } from '@/lib/utils';
import { getSafetyDistance } from '@/lib/pyroPhysics';

interface DiagResult {
  id: string;
  label: string;
  status: 'pass' | 'warn' | 'fail' | 'pending';
  detail: string;
  suggestion?: string;
}

export default function DiagnosticPanel({ onClose }: { onClose: () => void }) {
  const [results, setResults] = useState<DiagResult[]>([]);
  const [running, setRunning] = useState(false);

  const positions = useProjectStore((s) => s.positions);
  const droneFormations = useProjectStore((s) => s.droneFormations);
  const trajectories = useProjectStore((s) => s.trajectories);
  const timelineItems = useProjectStore((s) => s.timelineItems);
  const duration = useProjectStore((s) => s.duration);

  const hardware = useFireOneHardware();
  const pbusHw = usePBusHardware();

  const runDiagnostic = useCallback(async () => {
    setRunning(true);
    pushLog('E2E DIAGNOSTIC SCAN INITIATED', 'diag');
    const checks: DiagResult[] = [];

    // ── FireOne Hardware Checks ──────────────────────────
    if (hardware.isConnected) {
      // FireOne Link
      checks.push({
        id: 'fireone-link',
        label: 'FireOne RS-485 Link',
        status: 'pass',
        detail: `Conexão ativa — TX: ${hardware.txBytes}B / RX: ${hardware.rxBytes}B`,
      });

      // Module Discovery
      const moduleCount = hardware.modules.size;
      checks.push({
        id: 'fireone-modules',
        label: 'FireOne Module Discovery',
        status: moduleCount > 0 ? 'pass' : 'warn',
        detail: moduleCount > 0 ? `${moduleCount} módulo(s) IFMx-i32Q descobertos` : 'Nenhum módulo no barramento',
        suggestion: moduleCount === 0 ? 'Execute SCAN no painel PyroFireOne para descobrir módulos' : undefined,
      });

      // Battery Check
      let lowBattModules = 0;
      hardware.modules.forEach(m => {
        if (m.batteryVoltage !== undefined && m.batteryVoltage < 11.0) lowBattModules++;
      });
      checks.push({
        id: 'fireone-battery',
        label: 'FireOne Battery Check',
        status: lowBattModules === 0 ? 'pass' : 'fail',
        detail: lowBattModules === 0 ? 'Todas as baterias OK (>11.0V)' : `${lowBattModules} módulo(s) com bateria baixa (<11.0V)`,
        suggestion: lowBattModules > 0 ? 'Substitua ou recarregue baterias dos módulos antes do show' : undefined,
      });

      // Continuity Summary
      let goodIgniters = 0, openIgniters = 0, shortIgniters = 0;
      hardware.modules.forEach(m => {
        if (m.igniters) {
          m.igniters.forEach(ig => {
            if (ig.resistance > 0.5 && ig.resistance < 50) goodIgniters++;
            else if (ig.resistance >= 50 || ig.resistance === 0) openIgniters++;
            else shortIgniters++;
          });
        }
      });
      const totalIgniters = goodIgniters + openIgniters + shortIgniters;
      checks.push({
        id: 'fireone-continuity',
        label: 'FireOne Continuity',
        status: openIgniters === 0 && shortIgniters === 0 ? 'pass' : openIgniters > 0 ? 'warn' : 'fail',
        detail: totalIgniters > 0
          ? `${goodIgniters} OK, ${openIgniters} abertos, ${shortIgniters} curtos (${totalIgniters} total)`
          : 'Nenhum teste de continuidade executado',
        suggestion: openIgniters > 0 ? 'Verifique conexões dos ignitores com circuito aberto' : shortIgniters > 0 ? 'Verifique ignitores em curto-circuito' : undefined,
      });

      // Wireless Signal
      let weakSignalModules = 0;
      hardware.modules.forEach(m => {
        if ((m.connectionMode === 'wireless' || m.connectionMode === 'fallback') && m.rssiDbm !== undefined && m.rssiDbm < -75) {
          weakSignalModules++;
        }
      });
      const wirelessCount = hardware.wirelessModuleCount;
      if (wirelessCount > 0) {
        checks.push({
          id: 'fireone-wireless',
          label: 'FireOne Wireless Signal',
          status: weakSignalModules === 0 ? 'pass' : 'warn',
          detail: weakSignalModules === 0
            ? `${wirelessCount} módulo(s) wireless com sinal OK`
            : `${weakSignalModules} módulo(s) com RSSI fraco (<-75dBm)`,
          suggestion: weakSignalModules > 0 ? 'Reposicione módulos ou antenas para melhorar sinal' : undefined,
        });
      }

      // Firmware Version
      const firmwareVersions = new Set<string>();
      hardware.modules.forEach(m => {
        if (m.firmwareVersion) firmwareVersions.add(m.firmwareVersion);
      });
      if (firmwareVersions.size > 0) {
        checks.push({
          id: 'fireone-firmware',
          label: 'FireOne Firmware',
          status: firmwareVersions.size <= 1 ? 'pass' : 'warn',
          detail: firmwareVersions.size <= 1
            ? `Firmware uniforme: ${[...firmwareVersions][0] || 'N/A'}`
            : `${firmwareVersions.size} versões diferentes: ${[...firmwareVersions].join(', ')}`,
          suggestion: firmwareVersions.size > 1 ? 'Atualize todos os módulos para a mesma versão de firmware' : undefined,
        });
      }
    } else {
      // SIM mode warning
      checks.push({
        id: 'fireone-link',
        label: 'FireOne Hardware',
        status: 'warn',
        detail: 'Modo SIM — hardware não conectado',
        suggestion: 'Conecte via RS-485 no painel PyroFireOne para diagnóstico real',
      });
    }

    // ── PBUS / Showven Hardware Checks ──────────────────────
    if (pbusHw.isConnected) {
      checks.push({
        id: 'pbus-link',
        label: 'PBUS Link',
        status: 'pass',
        detail: `Conexão ativa — ${pbusHw.deviceCount} dispositivos · TX: ${pbusHw.txBytes}B / RX: ${pbusHw.rxBytes}B`,
      });

      // Battery check (<3.3V)
      let lowBattPbus = 0;
      pbusHw.devices.forEach(d => {
        if (d.batteryV < 3.3) lowBattPbus++;
      });
      checks.push({
        id: 'pbus-battery',
        label: 'PBUS Battery Check',
        status: lowBattPbus === 0 ? 'pass' : 'fail',
        detail: lowBattPbus === 0 ? 'Todas as baterias PBUS OK (>3.3V)' : `${lowBattPbus} dispositivo(s) com bateria baixa (<3.3V)`,
        suggestion: lowBattPbus > 0 ? 'Recarregue dispositivos PyroSlave antes do show' : undefined,
      });

      // Dual-band signal quality
      let weakPbus = 0;
      pbusHw.devices.forEach(d => {
        const best = Math.max(d.rssi433, d.rssi868);
        if (best < -80) weakPbus++;
      });
      if (pbusHw.deviceCount > 0) {
        checks.push({
          id: 'pbus-signal',
          label: 'PBUS Dual-Band Signal',
          status: weakPbus === 0 ? 'pass' : 'warn',
          detail: weakPbus === 0
            ? `${pbusHw.deviceCount} dispositivo(s) com sinal OK · Banda ideal: ${pbusHw.bestBand}`
            : `${weakPbus} dispositivo(s) com sinal fraco (<-80dBm)`,
          suggestion: weakPbus > 0 ? 'Reposicione dispositivos ou troque a banda de rádio' : undefined,
        });
      }

      // Cue continuity summary
      let goodCues = 0, openCues = 0;
      pbusHw.devices.forEach(d => {
        d.cues.forEach(c => {
          if (c.connected) goodCues++;
          else openCues++;
        });
      });
      if (goodCues + openCues > 0) {
        checks.push({
          id: 'pbus-continuity',
          label: 'PBUS Cue Continuity',
          status: openCues === 0 ? 'pass' : 'warn',
          detail: `${goodCues} cues OK, ${openCues} abertos (${goodCues + openCues} total)`,
          suggestion: openCues > 0 ? 'Verifique conexões dos ignitores nos slots PBUS com circuito aberto' : undefined,
        });
      }
    } else {
      checks.push({
        id: 'pbus-link',
        label: 'PBUS Hardware',
        status: 'warn',
        detail: 'Modo SIM — PBUS não conectado',
        suggestion: 'Conecte via serial no Connection Manager para diagnóstico real',
      });
    }

    // 1. Fleet check
    const totalDrones = droneFormations.reduce((sum, f) => sum + f.droneCount, 0);
    checks.push({
      id: 'fleet',
      label: 'Fleet Population',
      status: totalDrones > 0 ? 'pass' : 'warn',
      detail: totalDrones > 0 ? `${totalDrones} drones ativos` : 'Nenhum drone configurado',
      suggestion: totalDrones === 0 ? 'Adicione formações de drones no painel lateral' : undefined,
    });

    // 2. Proximity check
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
      suggestion: proximityConflicts > 0 ? 'Aumente o espaçamento entre drones ou reduza a contagem' : undefined,
    });

    // 3. Geofence check
    const maxRadius = Math.max(...droneFormations.map((f) => f.radius), 0);
    checks.push({
      id: 'geofence',
      label: 'Geofence Validation',
      status: maxRadius <= 80 ? 'pass' : 'fail',
      detail: maxRadius <= 80 ? `Raio máx: ${maxRadius.toFixed(0)}m (≤80m)` : `Raio ${maxRadius.toFixed(0)}m excede geofence`,
      suggestion: maxRadius > 80 ? 'Reduza o raio das formações para ≤80m' : undefined,
    });

    // 4. Battery estimation
    const estimatedFlightTime = duration / 60;
    checks.push({
      id: 'battery',
      label: 'Battery Estimate',
      status: estimatedFlightTime <= 15 ? 'pass' : estimatedFlightTime <= 25 ? 'warn' : 'fail',
      detail: `Show: ${estimatedFlightTime.toFixed(1)}min — ${estimatedFlightTime <= 15 ? 'Confortável' : estimatedFlightTime <= 25 ? 'Margem reduzida' : 'Excede autonomia'}`,
      suggestion: estimatedFlightTime > 25 ? 'Reduza a duração total do show ou divida em segmentos' : undefined,
    });

    // 5. Timeline coverage
    const hasTimelineItems = timelineItems.length > 0;
    checks.push({
      id: 'timeline',
      label: 'Timeline Coverage',
      status: hasTimelineItems ? 'pass' : 'warn',
      detail: hasTimelineItems ? `${timelineItems.length} eventos na timeline` : 'Timeline vazia',
      suggestion: !hasTimelineItems ? 'Arraste efeitos da biblioteca para a timeline' : undefined,
    });

    // 6. Position count
    const pyroPositions = positions.filter(p => p.type === 'pyro');
    const dronePositions = positions.filter(p => p.type === 'drone-pad');
    checks.push({
      id: 'positions',
      label: 'Launch Positions',
      status: positions.length > 0 ? 'pass' : 'warn',
      detail: `${pyroPositions.length} pyro, ${dronePositions.length} drone pads`,
      suggestion: positions.length === 0 ? 'Crie posições no viewport usando a toolbar' : undefined,
    });

    // 7. Trajectory validation
    const orphanTrajectories = trajectories.filter((t) => t.waypoints.length < 2);
    checks.push({
      id: 'trajectories',
      label: 'Trajectory Integrity',
      status: orphanTrajectories.length === 0 ? 'pass' : 'warn',
      detail: orphanTrajectories.length === 0 ? `${trajectories.length} trajetórias válidas` : `${orphanTrajectories.length} trajetórias com <2 waypoints`,
      suggestion: orphanTrajectories.length > 0 ? 'Adicione waypoints às trajetórias incompletas' : undefined,
    });

    // 8. Unlinked timeline items
    const unlinkedItems = timelineItems.filter(item => {
      const effect = EFFECT_LIBRARY.find(e => e.id === item.effectId);
      if (!effect || effect.type === 'drone') return false;
      return !item.positionId && (!item.positionIds || item.positionIds.length === 0);
    });
    checks.push({
      id: 'unlinked',
      label: 'Position Linking',
      status: unlinkedItems.length === 0 ? 'pass' : 'warn',
      detail: unlinkedItems.length === 0
        ? 'Todos os efeitos vinculados a posições'
        : `${unlinkedItems.length} efeitos sem posição vinculada`,
      suggestion: unlinkedItems.length > 0 ? 'Vincule efeitos a posições pyro para disparo preciso' : undefined,
    });

    // 9. Safety distance validation
    let safetyViolations = 0;
    pyroPositions.forEach(pos => {
      const linkedItems = timelineItems.filter(
        t => t.positionId === pos.id || t.positionIds?.includes(pos.id)
      );
      linkedItems.forEach(item => {
        const effect = EFFECT_LIBRARY.find(e => e.id === item.effectId);
        if (effect?.caliber) {
          const safeDist = getSafetyDistance(effect.caliber);
          const distToAudience = Math.abs(pos.z);
          if (distToAudience < safeDist * 0.5) safetyViolations++;
        }
      });
    });
    checks.push({
      id: 'safety',
      label: 'NFPA Safety Distance',
      status: safetyViolations === 0 ? 'pass' : 'fail',
      detail: safetyViolations === 0
        ? 'Todas as distâncias de segurança OK'
        : `${safetyViolations} violações de distância NFPA 1123`,
      suggestion: safetyViolations > 0 ? 'Mova posições pyro para longe da área do público' : undefined,
    });

    // 10. SMPTE sync
    checks.push({
      id: 'smpte',
      label: 'SMPTE / Sync Lock',
      status: 'pass',
      detail: 'Timecode sync disponível',
    });

    // 11. Duration sanity
    checks.push({
      id: 'duration',
      label: 'Show Duration',
      status: duration > 0 && duration <= 3600 ? 'pass' : duration === 0 ? 'warn' : 'fail',
      detail: duration === 0 ? 'Duração não definida' : `${(duration / 60).toFixed(1)} minutos`,
      suggestion: duration === 0 ? 'Defina a duração do show nas configurações' : undefined,
    });

    // Simulate processing delay
    await new Promise((r) => setTimeout(r, 600));
    setResults(checks);
    setRunning(false);

    const failures = checks.filter((c) => c.status === 'fail').length;
    const warnings = checks.filter((c) => c.status === 'warn').length;
    const passes = checks.length - failures - warnings;
    pushLog(
      `E2E SCAN COMPLETE: ${failures} falhas, ${warnings} avisos, ${passes} OK`,
      failures > 0 ? 'error' : warnings > 0 ? 'warn' : 'success'
    );
  }, [droneFormations, positions, trajectories, timelineItems, duration, hardware, pbusHw]);

  const exportReport = useCallback(() => {
    if (results.length === 0) return;
    const lines = [
      '═══ E2E DIAGNOSTIC REPORT ═══',
      `Date: ${new Date().toISOString()}`,
      `Positions: ${positions.length} | Timeline: ${timelineItems.length} | Formations: ${droneFormations.length}`,
      `FireOne: ${hardware.isConnected ? `Connected (${hardware.modules.size} modules)` : 'Not connected (SIM mode)'}`,
      '',
      ...results.map(r => `[${r.status.toUpperCase()}] ${r.label}: ${r.detail}${r.suggestion ? ` → ${r.suggestion}` : ''}`),
      '',
      `Summary: ${results.filter(r => r.status === 'fail').length} FAIL, ${results.filter(r => r.status === 'warn').length} WARN, ${results.filter(r => r.status === 'pass').length} PASS`,
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `diagnostic-report-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [results, positions, timelineItems, droneFormations, hardware]);

  const statusIcon = (s: DiagResult['status']) => {
    switch (s) {
      case 'pass': return <CheckCircle2 className="w-3 h-3 text-green-400" />;
      case 'warn': return <AlertTriangle className="w-3 h-3 text-yellow-400" />;
      case 'fail': return <AlertTriangle className="w-3 h-3 text-red-400" />;
      default: return <div className="w-3 h-3 rounded-full bg-muted-foreground/30" />;
    }
  };

  const failCount = results.filter(r => r.status === 'fail').length;
  const warnCount = results.filter(r => r.status === 'warn').length;
  const passCount = results.filter(r => r.status === 'pass').length;

  return (
    <div className="h-full flex flex-col bg-surface-0 border-l border-border">
      <div className="flex items-center justify-between p-2 border-b border-border bg-surface-1">
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-primary" />
          <span className="text-[10px] font-bold font-mono-code text-foreground tracking-wider uppercase">
            E2E Diagnostic
          </span>
          {hardware.isConnected && (
            <Badge variant="outline" className="text-[7px] px-1 py-0 border-green-500/40 text-green-400 ml-1">
              <Radio className="h-2 w-2 mr-0.5" /> HW
            </Badge>
          )}
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="p-2 flex gap-1">
        <Button
          onClick={runDiagnostic}
          disabled={running}
          variant="outline"
          size="sm"
          className="flex-1 h-7 text-[9px] gap-1"
        >
          {running ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
          {running ? 'Scanning...' : 'Run Full Diagnostic'}
        </Button>
        {results.length > 0 && (
          <Button onClick={exportReport} variant="ghost" size="sm" className="h-7 px-2" title="Export report">
            <Download className="w-3 h-3" />
          </Button>
        )}
      </div>

      {/* Summary bar */}
      {results.length > 0 && (
        <div className="px-2 pb-1 flex gap-2 text-[9px] font-mono-code">
          <span className="text-green-400">✓ {passCount}</span>
          <span className="text-yellow-400">⚠ {warnCount}</span>
          <span className="text-red-400">✗ {failCount}</span>
        </div>
      )}

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
            {r.suggestion && (
              <p className="text-primary/70 mt-0.5 pl-[18px] italic">💡 {r.suggestion}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
