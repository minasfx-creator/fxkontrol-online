/**
 * ManualComplianceMatrix — Maps manual requirements to implementation status.
 * Phase 5: Executive Consolidation.
 *
 * Compliance Hardening v2:
 *  - Status enum normalizado em UPPERCASE com 6 estados (IMPLEMENTED, VERIFIED,
 *    PARTIAL, PLANNED, MISSING, BLOCKED, NOT_APPLICABLE).
 *  - Filtro de blockers ESTRITO: somente IMPLEMENTED ou VERIFIED liberam
 *    requisitos `criticalForGoLive`. PARTIAL bloqueia (sistema físico).
 *  - `evidenceStatus` distingue conformidade real (`tested`/`third_party`)
 *    de aspiracional (`self_attested`/`none`).
 *  - `nextAction` rastreável (substitui `action` livre) + `owner` opcional.
 */
import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { BookOpen, CheckCircle2, AlertTriangle, Clock, MinusCircle, ShieldAlert, ShieldCheck, HelpCircle } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';

type ComplianceStatus =
  | 'IMPLEMENTED'
  | 'VERIFIED'
  | 'PARTIAL'
  | 'PLANNED'
  | 'MISSING'
  | 'BLOCKED'
  | 'NOT_APPLICABLE';

type EvidenceStatus = 'none' | 'self_attested' | 'tested' | 'third_party';

interface ComplianceRow {
  source: string;
  clause: string;
  requirement: string;
  status: ComplianceStatus;
  evidence: string;
  action: string;
  evidenceStatus: EvidenceStatus;
  nextAction: string;
  owner?: string;
  criticalForGoLive?: boolean;
}

const STATUS_CFG: Record<ComplianceStatus, { icon: typeof CheckCircle2; color: string; bg: string; label: string }> = {
  IMPLEMENTED:    { icon: CheckCircle2,  color: 'text-emerald-400',         bg: 'bg-emerald-500/15', label: 'IMPLEMENTED' },
  VERIFIED:       { icon: ShieldCheck,   color: 'text-emerald-300',         bg: 'bg-emerald-500/25', label: 'VERIFIED' },
  PARTIAL:        { icon: AlertTriangle, color: 'text-amber-400',           bg: 'bg-amber-500/15',   label: 'PARTIAL' },
  PLANNED:        { icon: Clock,         color: 'text-cyan-400',            bg: 'bg-cyan-500/15',    label: 'PLANNED' },
  MISSING:        { icon: HelpCircle,    color: 'text-red-300',             bg: 'bg-red-500/10',     label: 'MISSING' },
  BLOCKED:        { icon: ShieldAlert,   color: 'text-red-400',             bg: 'bg-red-500/20',     label: 'BLOCKED' },
  NOT_APPLICABLE: { icon: MinusCircle,   color: 'text-muted-foreground/50', bg: 'bg-muted/10',       label: 'N/A' },
};

const EVIDENCE_CFG: Record<EvidenceStatus, { color: string; label: string }> = {
  none:          { color: 'text-red-400/80',     label: 'NO EVIDENCE' },
  self_attested: { color: 'text-amber-400/80',   label: 'SELF-ATTESTED' },
  tested:        { color: 'text-cyan-300',       label: 'TESTED' },
  third_party:   { color: 'text-emerald-300',    label: '3RD-PARTY' },
};

/** Status that count as compliant for go-live decisions. */
const GO_LIVE_PASS_STATUSES: readonly ComplianceStatus[] = ['IMPLEMENTED', 'VERIFIED'];

/** Evidence levels acceptable for safety-critical / physical-risk items. */
const SAFETY_EVIDENCE_PASS: readonly EvidenceStatus[] = ['tested', 'third_party'];

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
  { source: 'NFPA 1123', clause: '§4.3', requirement: 'Minimum safety distances for aerial shells', status: 'IMPLEMENTED', evidence: 'PyroSafetyZones.tsx + SafetyDistanceConfig', evidenceStatus: 'self_attested', nextAction: 'None', owner: 'Safety Eng' },
  { source: 'NFPA 1123', clause: '§5.1', requirement: 'Operator qualification verification', status: 'PARTIAL', evidence: 'Auth + role system exists', evidenceStatus: 'self_attested', nextAction: 'Add credential check UI', owner: 'Platform', criticalForGoLive: true },
  { source: 'NFPA 1123', clause: '§6.2', requirement: 'Electrical firing system safety interlocks', status: 'IMPLEMENTED', evidence: 'SafetyInterlockManager + ARM/DISARM flow', evidenceStatus: 'tested', nextAction: 'None', owner: 'Firmware' },
  { source: 'NFPA 1123', clause: '§7.1', requirement: 'Weather monitoring and wind limits', status: 'PLANNED', evidence: 'WeatherAdapter interface defined', evidenceStatus: 'none', nextAction: 'Implement weather API integration', owner: 'Backend', criticalForGoLive: true },
  // NFPA 1126
  { source: 'NFPA 1126', clause: '§3.3', requirement: 'Proximate audience pyro safety distances', status: 'IMPLEMENTED', evidence: 'SafetyDistanceConfig proximity mode', evidenceStatus: 'self_attested', nextAction: 'None', owner: 'Safety Eng' },
  { source: 'NFPA 1126', clause: '§4.4', requirement: 'Fallback zone definition', status: 'IMPLEMENTED', evidence: 'PyroSafetyZones fallback volumes', evidenceStatus: 'self_attested', nextAction: 'None', owner: 'Safety Eng' },
  { source: 'NFPA 1126', clause: '§5.2', requirement: 'Fire watch and suppression equipment log', status: 'PLANNED', evidence: 'AuditTrail can log events', evidenceStatus: 'none', nextAction: 'Add fire watch checklist', owner: 'Operations', criticalForGoLive: true },
  // Showven
  { source: 'Showven Manual', clause: 'Ch.3', requirement: 'Cold spark machine DMX addressing', status: 'IMPLEMENTED', evidence: 'DMXUniverseManager + AddressingConsole', evidenceStatus: 'tested', nextAction: 'None', owner: 'Hardware' },
  { source: 'Showven Manual', clause: 'Ch.5', requirement: 'Machine safety distance (2m minimum)', status: 'IMPLEMENTED', evidence: 'SafetyDistanceConfig showven profile', evidenceStatus: 'self_attested', nextAction: 'None', owner: 'Safety Eng' },
  { source: 'Showven Manual', clause: 'Ch.7', requirement: 'Granule consumption rate tracking', status: 'PARTIAL', evidence: 'ConsumableTracker exists', evidenceStatus: 'self_attested', nextAction: 'Add real-time consumption rate', owner: 'Hardware' },
  // Finale 3D
  { source: 'Finale 3D', clause: 'Import', requirement: '.vviz file import and trajectory parsing', status: 'implemented', evidence: 'VVizImporter.ts', action: 'None' },
  { source: 'Finale 3D', clause: 'Export', requirement: 'Finale-compatible position export', status: 'implemented', evidence: 'ExportCoordinator Finale channel', action: 'None' },
  { source: 'Finale 3D', clause: 'Sync', requirement: 'Timecode synchronization', status: 'partial', evidence: 'SMPTE timecode parser exists', action: 'Add LTC input adapter', criticalForGoLive: true },
  { source: 'Finale 3D', clause: 'Import', requirement: '.vviz file import and trajectory parsing', status: 'IMPLEMENTED', evidence: 'VVizImporter.ts', evidenceStatus: 'tested', nextAction: 'None', owner: 'Importers' },
  { source: 'Finale 3D', clause: 'Export', requirement: 'Finale-compatible position export', status: 'IMPLEMENTED', evidence: 'ExportCoordinator Finale channel', evidenceStatus: 'tested', nextAction: 'None', owner: 'Exporters' },
  { source: 'Finale 3D', clause: 'Sync', requirement: 'Timecode synchronization', status: 'PARTIAL', evidence: 'SMPTE timecode parser exists', evidenceStatus: 'self_attested', nextAction: 'Add LTC input adapter', owner: 'Sync', criticalForGoLive: true },
  // FireOne
  { source: 'FireOne Protocol', clause: 'FIR-01', requirement: '.fir script generation with timing', status: 'IMPLEMENTED', evidence: 'FireOneExportConsole + fireOneExporter.ts', evidenceStatus: 'tested', nextAction: 'None', owner: 'Exporters' },
  { source: 'FireOne Protocol', clause: 'FIR-02', requirement: 'Module/pin addressing scheme', status: 'IMPLEMENTED', evidence: 'AddressingConsole + channel mapping', evidenceStatus: 'tested', nextAction: 'None', owner: 'Hardware' },
  { source: 'FireOne Protocol', clause: 'FIR-03', requirement: 'Continuity test protocol', status: 'IMPLEMENTED', evidence: 'ContinuityMatrix.tsx', evidenceStatus: 'tested', nextAction: 'None', owner: 'Hardware' },
  // Art-Net
  { source: 'Art-Net Spec', clause: 'ArtPoll', requirement: 'Node discovery via ArtPoll', status: 'partial', evidence: 'ArtNetNodeAdapter exists, discovery simulated', action: 'Implement UDP ArtPoll', criticalForGoLive: true },
  { source: 'Art-Net Spec', clause: 'ArtDmx', requirement: 'DMX data transmission', status: 'implemented', evidence: 'DMXUniverseManager + Art-Net output', action: 'None' },
  { source: 'Art-Net Spec', clause: 'ArtSync', requirement: 'Universe synchronization', status: 'planned', evidence: 'Interface defined', action: 'Implement sync packet' },
  { source: 'Art-Net Spec', clause: 'ArtPoll', requirement: 'Node discovery via ArtPoll', status: 'PARTIAL', evidence: 'ArtNetNodeAdapter exists, discovery simulated', evidenceStatus: 'self_attested', nextAction: 'Implement UDP ArtPoll', owner: 'Network', criticalForGoLive: true },
  { source: 'Art-Net Spec', clause: 'ArtDmx', requirement: 'DMX data transmission', status: 'IMPLEMENTED', evidence: 'DMXUniverseManager + Art-Net output', evidenceStatus: 'tested', nextAction: 'None', owner: 'Network' },
  { source: 'Art-Net Spec', clause: 'ArtSync', requirement: 'Universe synchronization', status: 'PLANNED', evidence: 'Interface defined', evidenceStatus: 'none', nextAction: 'Implement sync packet', owner: 'Network' },
  // VDL
  { source: 'VDL Standard', clause: 'VDL-1', requirement: 'Visual Description Language effect coding', status: 'IMPLEMENTED', evidence: 'VDL effect taxonomy in ShowPlan', evidenceStatus: 'self_attested', nextAction: 'None', owner: 'Show Engine' },
  { source: 'VDL Standard', clause: 'VDL-2', requirement: 'Effect caliber/height classification', status: 'IMPLEMENTED', evidence: 'CaliberClassification in pyro types', evidenceStatus: 'self_attested', nextAction: 'None', owner: 'Show Engine' },
  // ESP32
  { source: 'ESP32 Datasheet', clause: 'GPIO', requirement: 'GPIO pin mapping for firing channels', status: 'IMPLEMENTED', evidence: 'ArduinoNanoAdapter + 74HC595 shift register', evidenceStatus: 'tested', nextAction: 'None', owner: 'Firmware' },
  { source: 'ESP32 Datasheet', clause: 'ADC', requirement: 'Battery voltage ADC monitoring', status: 'PARTIAL', evidence: 'BatteryMonitorAdapter ADC simulation', evidenceStatus: 'self_attested', nextAction: 'Connect real ADC', owner: 'Firmware' },
  { source: 'ESP32 Datasheet', clause: 'WiFi', requirement: 'WiFi/ESP-NOW field communication', status: 'PLANNED', evidence: 'Transport interface defined', evidenceStatus: 'none', nextAction: 'Implement ESP-NOW bridge', owner: 'Firmware' },
  // SMPTE
  { source: 'SMPTE Timecode', clause: 'TC-30', requirement: '30fps timecode sync', status: 'partial', evidence: 'TimelineManager supports 30fps', action: 'Add hardware LTC reader', criticalForGoLive: true },
  { source: 'SMPTE Timecode', clause: 'TC-MTC', requirement: 'MIDI timecode input', status: 'planned', evidence: 'Interface planned', action: 'Implement Web MIDI API', criticalForGoLive: true },
  { source: 'SMPTE Timecode', clause: 'TC-30', requirement: '30fps timecode sync', status: 'PARTIAL', evidence: 'TimelineManager supports 30fps', evidenceStatus: 'self_attested', nextAction: 'Add hardware LTC reader', owner: 'Sync', criticalForGoLive: true },
  { source: 'SMPTE Timecode', clause: 'TC-MTC', requirement: 'MIDI timecode input', status: 'PLANNED', evidence: 'Interface planned', evidenceStatus: 'none', nextAction: 'Implement Web MIDI API', owner: 'Sync', criticalForGoLive: true },
];

/**
 * Strict blocker filter — for physical / safety-critical systems:
 * a critical requirement is a blocker UNLESS it is IMPLEMENTED or VERIFIED.
 * PARTIAL, PLANNED, MISSING, BLOCKED all count as blockers.
 */
function isGoLiveBlocker(row: ComplianceRow): boolean {
  if (!row.criticalForGoLive) return false;
  if (!GO_LIVE_PASS_STATUSES.includes(row.status)) return true;
  // Status is IMPLEMENTED/VERIFIED but evidence is too weak for safety-critical:
  if (!SAFETY_EVIDENCE_PASS.includes(row.evidenceStatus)) return true;
  return false;
}

export default function ManualComplianceMatrix() {
  const [query, setQuery] = useState('');
  const [showOnlyBlockers, setShowOnlyBlockers] = useState(false);

  const counts = useMemo(() => {
    const c: Record<ComplianceStatus, number> = {
      IMPLEMENTED: 0, VERIFIED: 0, PARTIAL: 0, PLANNED: 0, MISSING: 0, BLOCKED: 0, NOT_APPLICABLE: 0,
    };
    COMPLIANCE_DATA.forEach(r => c[r.status]++);
    return c;
  }, []);

  const complianceScore = useMemo(() => {
    const total = COMPLIANCE_DATA.filter(r => r.status !== 'NOT_APPLICABLE').length;
    // Strict scoring: VERIFIED=1.0, IMPLEMENTED=0.9, PARTIAL=0.4, PLANNED=0.1, MISSING/BLOCKED=0
    const score = COMPLIANCE_DATA.reduce((acc, r) => {
      switch (r.status) {
        case 'VERIFIED':    return acc + 1.0;
        case 'IMPLEMENTED': return acc + 0.9;
        case 'PARTIAL':     return acc + 0.4;
        case 'PLANNED':     return acc + 0.1;
        default:            return acc;
      }
    }, 0);
    return total > 0 ? Math.round((score / total) * 100) : 0;
  }, []);

  const blockers = useMemo(() => (
    COMPLIANCE_DATA
      .filter(isGoLiveBlocker)
      .sort((a, b) => a.source.localeCompare(b.source))
  ), []);

  const blockers = useMemo(() => (
    COMPLIANCE_DATA
      .filter(r => r.criticalForGoLive && r.status !== 'implemented')
      .sort((a, b) => a.source.localeCompare(b.source))
  ), []);

  const filteredRows = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const base = showOnlyBlockers
      ? COMPLIANCE_DATA.filter(r => r.criticalForGoLive && r.status !== 'implemented')
      : COMPLIANCE_DATA;
    if (!normalized) return base;
    return base.filter((row) =>
      `${row.source} ${row.clause} ${row.requirement} ${row.evidence} ${row.action}`
        .toLowerCase()
        .includes(normalized),
    );
  }, [query, showOnlyBlockers]);

  return (
    <div className="flex flex-col h-full p-4 gap-3 bg-background/80">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-primary" />
          <span className="text-xs font-mono font-bold tracking-widest text-foreground uppercase">Manual Compliance Matrix</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 text-[8px] font-mono">
            {(Object.entries(counts) as [ComplianceStatus, number][])
              .filter(([, count]) => count > 0)
              .map(([status, count]) => {
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

      {blockers.length > 0 && (
        <div className="rounded border border-amber-500/30 bg-amber-500/10 p-2">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[9px] font-mono font-bold text-amber-300 uppercase tracking-wider">Go-Live Blockers</span>
            <span className="text-[8px] font-mono text-amber-200/80">{blockers.length} em aberto</span>
          </div>
          <div className="space-y-1">
            {blockers.slice(0, 6).map((row) => (
              <div key={`${row.source}-${row.clause}`} className="flex items-center justify-between gap-2 text-[8px] font-mono">
                <span className="text-amber-100/90 truncate">{row.source} {row.clause} — {row.requirement}</span>
                <span className="text-amber-300/90 shrink-0">→ {row.action}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por fonte, cláusula, requisito ou ação..."
          className="h-7 text-[11px] font-mono bg-background/60"
        />
        <button
          onClick={() => setShowOnlyBlockers(v => !v)}
          className={cn(
            'h-7 px-2 rounded border text-[8px] font-mono uppercase tracking-wider transition-colors',
            showOnlyBlockers
              ? 'border-amber-400/50 bg-amber-500/20 text-amber-200'
              : 'border-border/30 bg-muted/20 text-muted-foreground/80 hover:text-foreground',
          )}
        >
          {showOnlyBlockers ? 'Mostrando blockers' : 'Somente blockers'}
        </button>
      </div>

        <div className="border border-red-500/30 bg-red-500/5 rounded-md p-2 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-mono font-bold text-red-400 tracking-widest uppercase">Go-Live Blockers</span>
            <span className="text-[8px] font-mono text-red-400/80">{blockers.length} em aberto</span>
          </div>
          <ul className="space-y-0.5">
            {blockers.slice(0, 8).map((row) => (
              <li key={`${row.source}-${row.clause}`} className="text-[9px] font-mono text-foreground/80 leading-tight">
                <span className="text-red-400/90">{row.source} {row.clause}</span>
                <span className="text-muted-foreground/60"> [{STATUS_CFG[row.status].label}/{EVIDENCE_CFG[row.evidenceStatus].label}]</span>
                {' — '}{row.requirement}
                <span className="text-amber-400/80"> → {row.nextAction}</span>
                {row.owner && <span className="text-muted-foreground/50"> ({row.owner})</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Column headers */}
      <div className="grid grid-cols-[110px_55px_1fr_75px_75px_1fr_70px] gap-1 text-[7px] font-mono text-muted-foreground/50 tracking-widest px-2">
        <span>SOURCE</span>
        <span>CLAUSE</span>
        <span>REQUIREMENT</span>
        <span className="text-center">STATUS</span>
        <span className="text-center">EVIDENCE</span>
        <span>NEXT ACTION</span>
        <span>OWNER</span>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-1">
          {filteredRows.map((row, i) => {
            const cfg = STATUS_CFG[row.status];
            const evCfg = EVIDENCE_CFG[row.evidenceStatus];
            const Icon = cfg.icon;
            const isBlocker = isGoLiveBlocker(row);
            return (
              <div key={i} className={cn(
                'grid grid-cols-[110px_55px_1fr_75px_75px_1fr_70px] gap-1 items-center rounded border px-2 py-1.5 transition-colors',
                isBlocker ? 'border-red-500/30 bg-red-500/5' : 'border-border/10 hover:bg-muted/5'
              )}>
                <span className="text-[8px] font-mono font-medium text-foreground truncate">{row.source}</span>
                <span className="text-[7px] font-mono text-muted-foreground">{row.clause}</span>
                <span className="text-[8px] font-mono text-foreground/80">{row.requirement}</span>
                <div className="flex justify-center">
                  <span className={cn('text-[7px] font-mono px-1.5 py-0.5 rounded flex items-center gap-1', cfg.bg, cfg.color)}>
                    <Icon className="w-2.5 h-2.5" />
                    {cfg.label}
                  </span>
                </div>
                <div className="flex justify-center">
                  <span className={cn('text-[7px] font-mono', evCfg.color)}>{evCfg.label}</span>
                </div>
                <span className={cn('text-[7px] font-mono truncate', row.nextAction === 'None' ? 'text-muted-foreground/30' : 'text-amber-400/80')}>{row.nextAction}</span>
                <span className="text-[7px] font-mono text-muted-foreground/60 truncate">{row.owner ?? '—'}</span>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
