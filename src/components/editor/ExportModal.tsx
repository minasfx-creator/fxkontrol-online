/**
 * ExportModal — Professional export dialog with firing script & setup report CSVs,
 * tabular preview, and download actions.
 */
import { useState, useMemo } from 'react';
import { useProjectStore, EFFECT_LIBRARY, type TimelineItem, type Position } from '@/store/useProjectStore';
import { exportFiringCSV, downloadFile } from '@/lib/exportEngine';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Download, FileSpreadsheet, MapPin, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface ExportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ═══════════════════════════════════════════════════════════
// SETUP REPORT — grouped by position then caliber
// ═══════════════════════════════════════════════════════════
function extractCaliber(name: string): string {
  const match = name.match(/(\d+)"/);
  return match ? `${match[1]}"` : 'N/A';
}

function findClosestPosition(item: TimelineItem, positions: Position[]): Position | null {
  const pyroPositions = positions.filter(p => p.type === 'pyro');
  if (pyroPositions.length === 0) return null;
  let closest: Position | null = null;
  let minDist = Infinity;
  for (const pos of pyroPositions) {
    const dist = Math.sqrt((pos.x - item.position.x) ** 2 + (pos.z - item.position.z) ** 2);
    if (dist < minDist) { minDist = dist; closest = pos; }
  }
  return closest;
}

interface SetupRow {
  position: string;
  caliber: string;
  effectName: string;
  count: number;
  module: number;
  pins: string;
  angle: number;
  notes: string;
}

function generateSetupReport(timelineItems: TimelineItem[], positions: Position[]): SetupRow[] {
  const pyroItems = timelineItems.filter(item => {
    const effect = EFFECT_LIBRARY.find(e => e.id === item.effectId);
    return effect?.type === 'firework';
  });

  // Group by position → caliber → effect
  const groups = new Map<string, Map<string, { effect: string; items: TimelineItem[] }>>();

  pyroItems.forEach((item, idx) => {
    const effect = EFFECT_LIBRARY.find(e => e.id === item.effectId)!;
    const pos = findClosestPosition(item, positions);
    const posName = pos?.name || 'UNASSIGNED';
    const caliber = extractCaliber(effect.name);
    const key = `${posName}::${caliber}::${effect.name}`;

    if (!groups.has(posName)) groups.set(posName, new Map());
    const posGroup = groups.get(posName)!;
    if (!posGroup.has(key)) posGroup.set(key, { effect: effect.name, items: [] });
    posGroup.get(key)!.items.push(item);
  });

  const rows: SetupRow[] = [];
  const sortedPositions = [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  for (const [posName, caliberMap] of sortedPositions) {
    const pos = positions.find(p => p.name === posName);
    for (const [, group] of caliberMap) {
      const caliber = extractCaliber(group.effect);
      rows.push({
        position: posName,
        caliber,
        effectName: group.effect,
        count: group.items.length,
        module: Math.floor(rows.length / 32) + 1,
        pins: `${(rows.length % 32) + 1}-${Math.min((rows.length % 32) + group.items.length, 32)}`,
        angle: pos?.pitch || 90,
        notes: group.items[0]?.notes || '',
      });
    }
  }

  return rows;
}

function exportSetupCSV(timelineItems: TimelineItem[], positions: Position[]): string {
  const rows = generateSetupReport(timelineItems, positions);
  const header = 'Position,Caliber,Effect,Qty,Module,Pins,Angle,Notes';
  const csvRows = rows.map(r =>
    `${r.position},${r.caliber},"${r.effectName}",${r.count},${r.module},${r.pins},${r.angle},"${r.notes}"`
  );
  return header + '\n' + csvRows.join('\n');
}

// ═══════════════════════════════════════════════════════════
// FIRING SCRIPT PREVIEW rows
// ═══════════════════════════════════════════════════════════
interface FiringPreviewRow {
  cue: number;
  time: string;
  position: string;
  effect: string;
  caliber: string;
  module: number;
  pin: number;
}

function generateFiringPreview(timelineItems: TimelineItem[], positions: Position[], limit = 20): FiringPreviewRow[] {
  const pyroItems = timelineItems
    .filter(item => EFFECT_LIBRARY.find(e => e.id === item.effectId)?.type === 'firework')
    .sort((a, b) => a.startTime - b.startTime)
    .slice(0, limit);

  return pyroItems.map((item, i) => {
    const effect = EFFECT_LIBRARY.find(e => e.id === item.effectId)!;
    const pos = findClosestPosition(item, positions);
    const mins = Math.floor(item.startTime / 60);
    const secs = (item.startTime % 60).toFixed(3);
    return {
      cue: i + 1,
      time: `${String(mins).padStart(2, '0')}:${secs.padStart(6, '0')}`,
      position: pos?.name || 'N/A',
      effect: effect.name,
      caliber: extractCaliber(effect.name),
      module: Math.floor(i / 32) + 1,
      pin: (i % 32) + 1,
    };
  });
}

// ═══════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════
export default function ExportModal({ open, onOpenChange }: ExportModalProps) {
  const { projectName, timelineItems, positions } = useProjectStore();
  const [activeTab, setActiveTab] = useState('firing');

  const pyroCount = useMemo(() =>
    timelineItems.filter(i => EFFECT_LIBRARY.find(e => e.id === i.effectId)?.type === 'firework').length
  , [timelineItems]);

  const firingPreview = useMemo(() => generateFiringPreview(timelineItems, positions), [timelineItems, positions]);
  const setupRows = useMemo(() => generateSetupReport(timelineItems, positions), [timelineItems, positions]);

  const handleDownloadFiring = () => {
    const csv = exportFiringCSV(timelineItems, positions);
    downloadFile(csv, `${projectName.replace(/\s+/g, '_')}_firing_script.csv`, 'text/csv');
    toast.success('Firing Script CSV exportado!');
  };

  const handleDownloadSetup = () => {
    const csv = exportSetupCSV(timelineItems, positions);
    downloadFile(csv, `${projectName.replace(/\s+/g, '_')}_setup_report.csv`, 'text/csv');
    toast.success('Setup Report CSV exportado!');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <FileSpreadsheet className="w-4 h-4 text-primary" />
            Export / Print — {projectName}
          </DialogTitle>
        </DialogHeader>

        {/* Stats bar */}
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground border-b border-border/30 pb-2">
          <Badge variant="outline" className="text-[9px]">{pyroCount} cues</Badge>
          <Badge variant="outline" className="text-[9px]">{positions.filter(p => p.type === 'pyro').length} posições</Badge>
          <Badge variant="outline" className="text-[9px]">{Math.ceil(pyroCount / 32)} módulos</Badge>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="w-full grid grid-cols-2 h-8">
            <TabsTrigger value="firing" className="text-[10px]">
              <Download className="w-3 h-3 mr-1" /> Firing Script
            </TabsTrigger>
            <TabsTrigger value="setup" className="text-[10px]">
              <MapPin className="w-3 h-3 mr-1" /> Setup Report
            </TabsTrigger>
          </TabsList>

          {/* ─── FIRING SCRIPT ─── */}
          <TabsContent value="firing" className="flex-1 overflow-hidden flex flex-col gap-2 mt-2">
            <p className="text-[10px] text-muted-foreground">
              Ordem cronológica para consolas de disparo (Cobra, FireTEK, FireOne). Colunas: Cue, Module, Pin, EventTime, PreFire, Effect, Caliber, Position.
            </p>
            <Button onClick={handleDownloadFiring} className="w-full" size="sm">
              <Download className="w-3.5 h-3.5 mr-2" /> Download Firing Script (CSV)
            </Button>

            {/* Preview table */}
            <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground/60 pt-1">
              <Eye className="w-3 h-3" /> Preview (primeiros {firingPreview.length} cues)
            </div>
            <div className="flex-1 overflow-auto border border-border/20 rounded">
              <table className="w-full text-[8px] font-mono">
                <thead>
                  <tr className="bg-muted/10 border-b border-border/20">
                    {['Cue', 'Time', 'Pos', 'Effect', 'Cal', 'Mod', 'Pin'].map(h => (
                      <th key={h} className="px-2 py-1.5 text-left text-muted-foreground/60 font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {firingPreview.length > 0 ? firingPreview.map(row => (
                    <tr key={row.cue} className="border-b border-border/10 hover:bg-muted/5">
                      <td className="px-2 py-1 text-primary font-bold">{row.cue}</td>
                      <td className="px-2 py-1">{row.time}</td>
                      <td className="px-2 py-1">{row.position}</td>
                      <td className="px-2 py-1 max-w-[120px] truncate">{row.effect}</td>
                      <td className="px-2 py-1">{row.caliber}</td>
                      <td className="px-2 py-1">{row.module}</td>
                      <td className="px-2 py-1">{row.pin}</td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={7} className="px-4 py-6 text-center text-muted-foreground/40">
                        Nenhum cue pirotécnico na Timeline
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </TabsContent>

          {/* ─── SETUP REPORT ─── */}
          <TabsContent value="setup" className="flex-1 overflow-hidden flex flex-col gap-2 mt-2">
            <p className="text-[10px] text-muted-foreground">
              Agrupado por Posição e Calibre para a equipa de logística. Indica quantos tubos e tortas montar em cada posição.
            </p>
            <Button onClick={handleDownloadSetup} className="w-full" size="sm">
              <Download className="w-3.5 h-3.5 mr-2" /> Download Setup Report (CSV)
            </Button>

            <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground/60 pt-1">
              <Eye className="w-3 h-3" /> Preview
            </div>
            <div className="flex-1 overflow-auto border border-border/20 rounded">
              <table className="w-full text-[8px] font-mono">
                <thead>
                  <tr className="bg-muted/10 border-b border-border/20">
                    {['Posição', 'Calibre', 'Efeito', 'Qtd', 'Módulo', 'Pins', 'Ângulo'].map(h => (
                      <th key={h} className="px-2 py-1.5 text-left text-muted-foreground/60 font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {setupRows.length > 0 ? setupRows.map((row, i) => (
                    <tr key={i} className="border-b border-border/10 hover:bg-muted/5">
                      <td className="px-2 py-1 text-primary font-bold">{row.position}</td>
                      <td className="px-2 py-1">{row.caliber}</td>
                      <td className="px-2 py-1 max-w-[120px] truncate">{row.effectName}</td>
                      <td className="px-2 py-1 font-bold">{row.count}</td>
                      <td className="px-2 py-1">{row.module}</td>
                      <td className="px-2 py-1">{row.pins}</td>
                      <td className="px-2 py-1">{row.angle}°</td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={7} className="px-4 py-6 text-center text-muted-foreground/40">
                        Nenhum cue pirotécnico na Timeline
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
