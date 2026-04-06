import { useState, useMemo } from 'react';
import { FileText, Shield, Cable, Link2, ClipboardList, Map, ChevronDown, ChevronRight, Sparkles } from 'lucide-react';
import { useProjectStore } from '@/store/useProjectStore';
import { EFFECT_LIBRARY } from '@/data/effectLibrary';
import {
  generateSafetyReport,
  generateWiringReport,
  generateChainReport,
  generateCueSheet,
  openReport,
  downloadReport,
} from '@/lib/reportEngine';
import QuickStats, { type QuickStat } from './reports/QuickStats';
import ComplianceChecklist from './reports/ComplianceChecklist';
import ReportCard from './reports/ReportCard';

const REPORTS = [
  { id: 'safety', label: 'Distâncias de Segurança', icon: Shield, desc: 'Relatório NFPA 1123 com fallout e distâncias de morteiro', color: 'text-destructive', category: 'safety' },
  { id: 'wiring', label: 'Script de Cabeamento', icon: Cable, desc: 'Tabela de módulo/slat/pin com metragem de fios', color: 'text-primary', category: 'technical' },
  { id: 'chain', label: 'Especificações de Cadeia', icon: Link2, desc: 'Sequências de cadeias e temporização', color: 'text-primary', category: 'technical' },
  { id: 'cuesheet', label: 'Cue Sheet', icon: ClipboardList, desc: 'Lista de cues operacional para equipe de campo', color: 'text-primary', category: 'operational' },
  { id: 'sitelayout', label: 'Layout do Venue', icon: Map, desc: 'Layout com zonas e perímetros de segurança', color: 'text-primary', category: 'safety' },
] as const;

type ReportId = typeof REPORTS[number]['id'];

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
      case 'sitelayout': return generateSafetyReport(projectName, timelineItems, positions);
    }
  };

  const handleOpen = (id: ReportId) => openReport(generate(id));
  const handleDownload = (id: ReportId) => downloadReport(generate(id), `${projectName}-${id}.html`);

  const stats: QuickStat[] = useMemo(() => {
    const pyroItems = timelineItems.filter(i => EFFECT_LIBRARY.find(e => e.id === i.effectId)?.type === 'firework');
    const pyroPositions = positions.filter(p => p.type === 'pyro');
    const droneCount = droneFormations.reduce((s, f) => s + f.droneCount, 0);

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
      { label: 'Cues Pyro', value: String(pyroItems.length), status: pyroItems.length > 0 ? 'ok' : 'warn' },
      { label: 'Posições', value: String(pyroPositions.length), status: pyroPositions.length > 0 ? 'ok' : 'warn' },
      { label: 'Drones', value: String(droneCount), status: 'ok' },
      { label: 'Raio Seg.', value: `${safetyDist}m`, status: safetyDist >= 120 ? 'critical' : safetyDist >= 90 ? 'warn' : 'ok' },
      { label: 'Calibre Max', value: maxCaliber > 0 ? `${maxCaliber}"` : '—', status: maxCaliber >= 8 ? 'critical' : 'ok' },
    ];
  }, [timelineItems, positions, droneFormations]);

  const categories = [
    { id: 'safety', label: 'Segurança & Conformidade', icon: Shield },
    { id: 'technical', label: 'Técnico', icon: Cable },
    { id: 'operational', label: 'Operacional', icon: ClipboardList },
  ];

  const complianceItems = useMemo(() => [
    { label: 'Distâncias NFPA 1123', ok: positions.filter(p => p.type === 'pyro').length > 0 },
    { label: 'Atribuição de posições', ok: timelineItems.every(i => i.positionName || positions.length > 0) },
    { label: 'Script de cabeamento', ok: timelineItems.length > 0 },
    { label: 'Perímetro de segurança', ok: positions.length > 0 },
  ], [timelineItems, positions]);

  return (
    <div className="h-full flex flex-col bg-card border-l border-border">
      <div className="px-3 py-2 border-b border-border flex items-center gap-2">
        <FileText className="h-3.5 w-3.5 text-primary" />
        <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider flex-1">Relatórios</h2>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xs transition-colors">✕</button>
      </div>

      <QuickStats stats={stats} />

      <div className="flex-1 overflow-auto p-2 space-y-1.5">
        {timelineItems.length === 0 && positions.length === 0 && (
          <div className="px-2 py-8 text-center">
            <Sparkles className="h-6 w-6 text-muted-foreground/20 mx-auto mb-2" />
            <p className="text-[10px] text-muted-foreground/60">Adicione itens na timeline ou posições para gerar relatórios profissionais</p>
          </div>
        )}

        {categories.map(cat => {
          const catReports = REPORTS.filter(r => r.category === cat.id);
          const isExpanded = expandedCategory === cat.id;
          return (
            <div key={cat.id} className="rounded-lg border border-border/50 overflow-hidden">
              <button
                className="w-full flex items-center gap-1.5 px-2.5 py-2 bg-muted/30 hover:bg-muted/50 transition-colors"
                onClick={() => setExpandedCategory(isExpanded ? null : cat.id)}
              >
                {isExpanded
                  ? <ChevronDown className="h-3 w-3 text-muted-foreground" />
                  : <ChevronRight className="h-3 w-3 text-muted-foreground" />
                }
                <cat.icon className="h-3 w-3 text-primary/70" />
                <span className="text-[10px] font-semibold text-foreground flex-1 text-left">{cat.label}</span>
                <span className="text-[8px] text-muted-foreground/50 bg-muted/50 px-1.5 py-0.5 rounded">{catReports.length}</span>
              </button>
              {isExpanded && (
                <div className="p-1.5 space-y-1.5">
                  {catReports.map(({ id, label, icon: Icon, desc, color }) => (
                    <ReportCard
                      key={id}
                      id={id}
                      label={label}
                      desc={desc}
                      icon={Icon}
                      color={color}
                      isActive={previewId === id}
                      onOpen={() => handleOpen(id)}
                      onDownload={() => handleDownload(id)}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {(timelineItems.length > 0 || positions.length > 0) && (
          <ComplianceChecklist items={complianceItems} />
        )}

        <div className="bg-muted/30 rounded-lg border border-border/30 p-2.5">
          <p className="text-[8px] text-muted-foreground leading-relaxed">
            💡 Relatórios abrem em nova janela com formatação profissional para propostas. Use <b>Ctrl+P</b> para imprimir ou salvar como PDF.
          </p>
        </div>
      </div>
    </div>
  );
}
