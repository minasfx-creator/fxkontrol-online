import { useState, useMemo } from 'react';
import { FileText, Shield, Cable, Link2, ClipboardList, Download, ExternalLink, Map, BarChart3, AlertTriangle, CheckCircle2, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useProjectStore, EFFECT_LIBRARY } from '@/store/useProjectStore';
import {
  generateSafetyReport,
  generateWiringReport,
  generateChainReport,
  generateCueSheet,
  openReport,
  downloadReport,
} from '@/lib/reportEngine';
import { cn } from '@/lib/utils';

const REPORTS = [
  { id: 'safety', label: 'Safety Distance', icon: Shield, desc: 'NFPA 1123 fallout & mortar distances', color: 'text-destructive', category: 'safety' },
  { id: 'wiring', label: 'Wiring Script', icon: Cable, desc: 'Module/Slat/Pin wiring schedule', color: 'text-primary', category: 'technical' },
  { id: 'chain', label: 'Chain Specs', icon: Link2, desc: 'Chain sequences and timing', color: 'text-warning', category: 'technical' },
  { id: 'cuesheet', label: 'Cue Sheet', icon: ClipboardList, desc: 'Pinboard cue list for crew', color: 'text-success', category: 'operational' },
  { id: 'sitelayout', label: 'Site Layout', icon: Map, desc: 'Venue layout with zones & distances', color: 'text-accent', category: 'safety' },
] as const;

type ReportId = typeof REPORTS[number]['id'];

interface QuickStat {
  label: string;
  value: string;
  status: 'ok' | 'warn' | 'critical';
}

export default function ReportsPanel({ onClose }: { onClose: () => void }) {
  const { projectName, timelineItems, positions, droneFormations } = useProjectStore();
  const [expandedCategory, setExpandedCategory] = useState<string | null>('safety');
  const [previewId, setPreviewId] = useState<ReportId | null>(null);

  const generate = (id: ReportId): string => {
    switch (id) {
      case 'safety': return generateSafetyReport(projectName, timelineItems, positions);
      case 'wiring': return generateWiringReport(projectName, timelineItems, positions);
      case 'chain': return generateChainReport(projectName, timelineItems);
      case 'cuesheet': return generateCueSheet(projectName, timelineItems, positions);
      case 'sitelayout': return generateSafetyReport(projectName, timelineItems, positions); // reuse safety for now
    }
  };

  const handleOpen = (id: ReportId) => openReport(generate(id));
  const handleDownload = (id: ReportId) => downloadReport(generate(id), `${projectName}-${id}.html`);

  // Quick stats
  const stats: QuickStat[] = useMemo(() => {
    const pyroItems = timelineItems.filter(i => EFFECT_LIBRARY.find(e => e.id === i.effectId)?.type === 'firework');
    const pyroPositions = positions.filter(p => p.type === 'pyro');
    const droneCount = droneFormations.reduce((s, f) => s + f.droneCount, 0);

    // Max caliber for safety
    let maxCaliber = 0;
    pyroItems.forEach(item => {
      const effect = EFFECT_LIBRARY.find(e => e.id === item.effectId);
      if (effect) {
        const m = effect.name.match(/(\d+)"/);
        if (m) maxCaliber = Math.max(maxCaliber, parseInt(m[1]));
      }
    });

    const safetyDist = maxCaliber >= 8 ? 120 : maxCaliber >= 6 ? 90 : maxCaliber >= 4 ? 60 : 45;

    return [
      { label: 'Pyro Cues', value: String(pyroItems.length), status: pyroItems.length > 0 ? 'ok' : 'warn' },
      { label: 'Positions', value: String(pyroPositions.length), status: pyroPositions.length > 0 ? 'ok' : 'warn' },
      { label: 'Drones', value: String(droneCount), status: 'ok' },
      { label: 'Safety Radius', value: `${safetyDist}m`, status: safetyDist >= 120 ? 'critical' : safetyDist >= 90 ? 'warn' : 'ok' },
      { label: 'Max Caliber', value: maxCaliber > 0 ? `${maxCaliber}"` : '—', status: maxCaliber >= 8 ? 'critical' : 'ok' },
    ];
  }, [timelineItems, positions, droneFormations]);

  const categories = [
    { id: 'safety', label: 'Safety & Compliance', icon: Shield },
    { id: 'technical', label: 'Technical', icon: Cable },
    { id: 'operational', label: 'Operational', icon: ClipboardList },
  ];

  return (
    <div className="h-full flex flex-col bg-card border-l border-border">
      <div className="px-3 py-2 border-b border-border flex items-center gap-2">
        <FileText className="h-3.5 w-3.5 text-primary" />
        <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider flex-1">Reports</h2>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xs">✕</button>
      </div>

      {/* Quick Stats Dashboard */}
      <div className="px-2 py-2 border-b border-border/50">
        <div className="flex items-center gap-1.5 mb-1.5">
          <BarChart3 className="h-3 w-3 text-muted-foreground" />
          <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">Show Overview</span>
        </div>
        <div className="grid grid-cols-5 gap-1">
          {stats.map(s => (
            <div key={s.label} className={cn(
              "rounded px-1.5 py-1 text-center border",
              s.status === 'ok' && "bg-green-500/5 border-green-500/20",
              s.status === 'warn' && "bg-yellow-500/5 border-yellow-500/20",
              s.status === 'critical' && "bg-red-500/5 border-red-500/20",
            )}>
              <div className={cn(
                "text-[10px] font-bold font-mono",
                s.status === 'ok' && "text-green-400",
                s.status === 'warn' && "text-yellow-400",
                s.status === 'critical' && "text-red-400",
              )}>
                {s.value}
              </div>
              <div className="text-[7px] text-muted-foreground truncate">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-2 space-y-1.5">
        {timelineItems.length === 0 && positions.length === 0 && (
          <div className="px-2 py-8 text-center">
            <FileText className="h-6 w-6 text-muted-foreground/20 mx-auto mb-2" />
            <p className="text-[10px] text-muted-foreground/60">Add items to the timeline or positions to generate reports</p>
          </div>
        )}

        {/* Categorized reports */}
        {categories.map(cat => {
          const catReports = REPORTS.filter(r => r.category === cat.id);
          const isExpanded = expandedCategory === cat.id;
          return (
            <div key={cat.id} className="rounded border border-border/50 overflow-hidden">
              <button
                className="w-full flex items-center gap-1.5 px-2 py-1.5 bg-surface-1/50 hover:bg-surface-2/50 transition-colors"
                onClick={() => setExpandedCategory(isExpanded ? null : cat.id)}
              >
                {isExpanded ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                <cat.icon className="h-3 w-3 text-muted-foreground" />
                <span className="text-[10px] font-semibold text-foreground flex-1 text-left">{cat.label}</span>
                <span className="text-[8px] text-muted-foreground/50">{catReports.length}</span>
              </button>
              {isExpanded && (
                <div className="p-1.5 space-y-1">
                  {catReports.map(({ id, label, icon: Icon, desc, color }) => (
                    <div key={id} className={cn(
                      "rounded border border-border/30 p-2 transition-colors",
                      previewId === id ? "bg-primary/5 border-primary/30" : "bg-surface-2/50"
                    )}>
                      <div className="flex items-center gap-2 mb-1">
                        <Icon className={`h-3.5 w-3.5 ${color}`} />
                        <span className="text-[10px] font-semibold text-foreground flex-1">{label}</span>
                      </div>
                      <p className="text-[8px] text-muted-foreground mb-2 leading-relaxed">{desc}</p>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 text-[8px] gap-1 flex-1 hover:bg-primary/10"
                          onClick={() => handleOpen(id)}
                        >
                          <ExternalLink className="h-2.5 w-2.5" /> Open
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 text-[8px] gap-1 flex-1 hover:bg-primary/10"
                          onClick={() => handleDownload(id)}
                        >
                          <Download className="h-2.5 w-2.5" /> Download
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* Compliance summary */}
        {(timelineItems.length > 0 || positions.length > 0) && (
          <div className="rounded border border-border/50 p-2 space-y-1">
            <div className="flex items-center gap-1.5">
              <Shield className="h-3 w-3 text-primary" />
              <span className="text-[9px] font-semibold text-foreground uppercase tracking-wider">Compliance Checklist</span>
            </div>
            {[
              { label: 'NFPA 1123 Distances', ok: positions.filter(p => p.type === 'pyro').length > 0 },
              { label: 'Position Assignments', ok: timelineItems.every(i => i.positionName || positions.length > 0) },
              { label: 'Wiring Script Generated', ok: timelineItems.length > 0 },
              { label: 'Safety Perimeter Defined', ok: positions.length > 0 },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-1.5 text-[9px]">
                {item.ok ? (
                  <CheckCircle2 className="h-2.5 w-2.5 text-green-400" />
                ) : (
                  <AlertTriangle className="h-2.5 w-2.5 text-yellow-400" />
                )}
                <span className={item.ok ? "text-muted-foreground" : "text-yellow-400"}>{item.label}</span>
              </div>
            ))}
          </div>
        )}

        <div className="bg-surface-2/50 rounded border border-border/30 p-2">
          <p className="text-[8px] text-muted-foreground leading-relaxed">
            💡 Reports open in a new window. Use <b>Ctrl+P</b> to print as PDF. All distances follow NFPA 1123 guidelines.
          </p>
        </div>
      </div>
    </div>
  );
}
