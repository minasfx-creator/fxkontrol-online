/**
 * ManualComplianceMatrix — Maps manual requirements to implementation status.
 * Phase 5: Executive Consolidation.
 */
import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { BookOpen, CheckCircle2, AlertTriangle, Clock, MinusCircle } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

type ComplianceStatus = 'implemented' | 'partial' | 'planned' | 'not_applicable';

interface ComplianceRow {
  source: string;
  clause: string;
  requirement: string;
  status: ComplianceStatus;
  evidence: string;
  action: string;
  criticalForGoLive?: boolean;
}

const STATUS_CFG: Record<ComplianceStatus, { icon: typeof CheckCircle2; color: string; bg: string; label: string }> = {
  implemented:    { icon: CheckCircle2,  color: 'text-emerald-400', bg: 'bg-emerald-500/15', label: 'IMPLEMENTED' },
  partial:        { icon: AlertTriangle, color: 'text-amber-400',   bg: 'bg-amber-500/15',   label: 'PARTIAL' },
  planned:        { icon: Clock,         color: 'text-cyan-400',    bg: 'bg-cyan-500/15',    label: 'PLANNED' },
  not_applicable: { icon: MinusCircle,   color: 'text-muted-foreground/50', bg: 'bg-muted/10', label: 'N/A' },
};

const COMPLIANCE_DATA: ComplianceRow[] = [
  // NFPA 1123
  { source: 'NFPA 1123', clause: '§4.3', requirement: 'Minimum safety distances for aerial shells', status: 'implemented', evidence: 'PyroSafetyZones.tsx + SafetyDistanceConfig', action: 'None' },
  { source: 'NFPA 1123', clause: '§5.1', requirement: 'Operator qualification verification', status: 'partial', evidence: 'Auth + role system exists', action: 'Add credential check UI', criticalForGoLive: true },
  { source: 'NFPA 1123', clause: '§6.2', requirement: 'Electrical firing system safety interlocks', status: 'implemented', evidence: 'SafetyInterlockManager + ARM/DISARM flow', action: 'None' },
  { source: 'NFPA 1123', clause: '§7.1', requirement: 'Weather monitoring and wind limits', status: 'planned', evidence: 'WeatherAdapter interface defined', action: 'Implement weather API integration', criticalForGoLive: true },
  // NFPA 1126
  { source: 'NFPA 1126', clause: '§3.3', requirement: 'Proximate audience pyro safety distances', status: 'implemented', evidence: 'SafetyDistanceConfig proximity mode', action: 'None' },
  { source: 'NFPA 1126', clause: '§4.4', requirement: 'Fallback zone definition', status: 'implemented', evidence: 'PyroSafetyZones fallback volumes', action: 'None' },
  { source: 'NFPA 1126', clause: '§5.2', requirement: 'Fire watch and suppression equipment log', status: 'planned', evidence: 'AuditTrail can log events', action: 'Add fire watch checklist', criticalForGoLive: true },
  // Showven
  { source: 'Showven Manual', clause: 'Ch.3', requirement: 'Cold spark machine DMX addressing', status: 'implemented', evidence: 'DMXUniverseManager + AddressingConsole', action: 'None' },
  { source: 'Showven Manual', clause: 'Ch.5', requirement: 'Machine safety distance (2m minimum)', status: 'implemented', evidence: 'SafetyDistanceConfig showven profile', action: 'None' },
  { source: 'Showven Manual', clause: 'Ch.7', requirement: 'Granule consumption rate tracking', status: 'partial', evidence: 'ConsumableTracker exists', action: 'Add real-time consumption rate' },
  // Finale 3D
  { source: 'Finale 3D', clause: 'Import', requirement: '.vviz file import and trajectory parsing', status: 'implemented', evidence: 'VVizImporter.ts', action: 'None' },
  { source: 'Finale 3D', clause: 'Export', requirement: 'Finale-compatible position export', status: 'implemented', evidence: 'ExportCoordinator Finale channel', action: 'None' },
  { source: 'Finale 3D', clause: 'Sync', requirement: 'Timecode synchronization', status: 'partial', evidence: 'SMPTE timecode parser exists', action: 'Add LTC input adapter', criticalForGoLive: true },
  // FireOne
  { source: 'FireOne Protocol', clause: 'FIR-01', requirement: '.fir script generation with timing', status: 'implemented', evidence: 'FireOneExportConsole + fireOneExporter.ts', action: 'None' },
  { source: 'FireOne Protocol', clause: 'FIR-02', requirement: 'Module/pin addressing scheme', status: 'implemented', evidence: 'AddressingConsole + channel mapping', action: 'None' },
  { source: 'FireOne Protocol', clause: 'FIR-03', requirement: 'Continuity test protocol', status: 'implemented', evidence: 'ContinuityMatrix.tsx', action: 'None' },
  // Art-Net
  { source: 'Art-Net Spec', clause: 'ArtPoll', requirement: 'Node discovery via ArtPoll', status: 'partial', evidence: 'ArtNetNodeAdapter exists, discovery simulated', action: 'Implement UDP ArtPoll', criticalForGoLive: true },
  { source: 'Art-Net Spec', clause: 'ArtDmx', requirement: 'DMX data transmission', status: 'implemented', evidence: 'DMXUniverseManager + Art-Net output', action: 'None' },
  { source: 'Art-Net Spec', clause: 'ArtSync', requirement: 'Universe synchronization', status: 'planned', evidence: 'Interface defined', action: 'Implement sync packet' },
  // VDL
  { source: 'VDL Standard', clause: 'VDL-1', requirement: 'Visual Description Language effect coding', status: 'implemented', evidence: 'VDL effect taxonomy in ShowPlan', action: 'None' },
  { source: 'VDL Standard', clause: 'VDL-2', requirement: 'Effect caliber/height classification', status: 'implemented', evidence: 'CaliberClassification in pyro types', action: 'None' },
  // ESP32
  { source: 'ESP32 Datasheet', clause: 'GPIO', requirement: 'GPIO pin mapping for firing channels', status: 'implemented', evidence: 'ArduinoNanoAdapter + 74HC595 shift register', action: 'None' },
  { source: 'ESP32 Datasheet', clause: 'ADC', requirement: 'Battery voltage ADC monitoring', status: 'implemented', evidence: 'BatteryMonitorAdapter ADC simulation', action: 'Connect real ADC' },
  { source: 'ESP32 Datasheet', clause: 'WiFi', requirement: 'WiFi/ESP-NOW field communication', status: 'planned', evidence: 'Transport interface defined', action: 'Implement ESP-NOW bridge' },
  // SMPTE
  { source: 'SMPTE Timecode', clause: 'TC-30', requirement: '30fps timecode sync', status: 'partial', evidence: 'TimelineManager supports 30fps', action: 'Add hardware LTC reader', criticalForGoLive: true },
  { source: 'SMPTE Timecode', clause: 'TC-MTC', requirement: 'MIDI timecode input', status: 'planned', evidence: 'Interface planned', action: 'Implement Web MIDI API', criticalForGoLive: true },
];

export default function ManualComplianceMatrix() {
  const counts = useMemo(() => {
    const c = { implemented: 0, partial: 0, planned: 0, not_applicable: 0 };
    COMPLIANCE_DATA.forEach(r => c[r.status]++);
    return c;
  }, []);

  const complianceScore = useMemo(() => {
    const total = COMPLIANCE_DATA.filter(r => r.status !== 'not_applicable').length;
    const impl = counts.implemented + counts.partial * 0.5;
    return total > 0 ? Math.round((impl / total) * 100) : 0;
  }, [counts]);

  const blockers = useMemo(() => (
    COMPLIANCE_DATA
      .filter(r => r.criticalForGoLive && r.status !== 'implemented')
      .sort((a, b) => a.source.localeCompare(b.source))
  ), []);

  return (
    <div className="flex flex-col h-full p-4 gap-3 bg-background/80">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-primary" />
          <span className="text-xs font-mono font-bold tracking-widest text-foreground uppercase">Manual Compliance Matrix</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-[8px] font-mono">
            {(Object.entries(counts) as [ComplianceStatus, number][]).map(([status, count]) => {
              const cfg = STATUS_CFG[status];
              return <span key={status} className={cn('px-1.5 py-0.5 rounded', cfg.bg, cfg.color)}>{count} {cfg.label}</span>;
            })}
          </div>
          <span className={cn('text-[10px] font-mono font-bold px-2 py-0.5 rounded',
            complianceScore >= 80 ? 'bg-emerald-500/15 text-emerald-400' :
            complianceScore >= 50 ? 'bg-amber-500/15 text-amber-400' :
            'bg-red-500/15 text-red-400'
          )}>{complianceScore}% COMPLIANT</span>
        </div>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[120px_60px_1fr_80px_1fr_1fr] gap-1 text-[7px] font-mono text-muted-foreground/50 tracking-widest px-2">
        <span>SOURCE</span>
        <span>CLAUSE</span>
        <span>REQUIREMENT</span>
        <span className="text-center">STATUS</span>
        <span>EVIDENCE</span>
        <span>ACTION</span>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-1">
          {COMPLIANCE_DATA.map((row, i) => {
            const cfg = STATUS_CFG[row.status];
            const Icon = cfg.icon;
            return (
              <div key={i} className="grid grid-cols-[120px_60px_1fr_80px_1fr_1fr] gap-1 items-center rounded border border-border/10 px-2 py-1.5 hover:bg-muted/5 transition-colors">
                <span className="text-[8px] font-mono font-medium text-foreground truncate">{row.source}</span>
                <span className="text-[7px] font-mono text-muted-foreground">{row.clause}</span>
                <span className="text-[8px] font-mono text-foreground/80">{row.requirement}</span>
                <div className="flex justify-center">
                  <span className={cn('text-[7px] font-mono px-1.5 py-0.5 rounded flex items-center gap-1', cfg.bg, cfg.color)}>
                    <Icon className="w-2.5 h-2.5" />
                    {cfg.label}
                  </span>
                </div>
                <span className="text-[7px] font-mono text-muted-foreground/60 truncate">{row.evidence}</span>
                <span className={cn('text-[7px] font-mono truncate', row.action === 'None' ? 'text-muted-foreground/30' : 'text-amber-400/80')}>{row.action}</span>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
