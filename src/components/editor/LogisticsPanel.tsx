import { useState, useCallback, useRef } from 'react';
import { X, Printer, Tag, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useProjectStore } from '@/store/useProjectStore';
import { cn } from '@/lib/utils';

interface LabelData {
  address: string;
  droneId: string;
  formation: string;
  position: string;
  time: string;
}

export default function LogisticsPanel({ onClose }: { onClose: () => void }) {
  const [labels, setLabels] = useState<LabelData[]>([]);
  const [generated, setGenerated] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const positions = useProjectStore((s) => s.positions);
  const droneFormations = useProjectStore((s) => s.droneFormations);
  const timelineItems = useProjectStore((s) => s.timelineItems);
  const projectName = useProjectStore((s) => s.projectName);

  const generateLabels = useCallback(() => {
    const newLabels: LabelData[] = [];

    // Labels from formations
    droneFormations.forEach((f, fIdx) => {
      for (let i = 0; i < Math.min(f.droneCount, 200); i++) {
        newLabels.push({
          address: `M${String(fIdx + 1).padStart(2, '0')}-${String.fromCharCode(65 + Math.floor(i / 30))}-${(i % 30) + 1}`,
          droneId: `D-${String(fIdx * 1000 + i + 1).padStart(4, '0')}`,
          formation: f.formationType.toUpperCase(),
          position: `(${f.points[i]?.x.toFixed(1) || 0}, ${f.points[i]?.z.toFixed(1) || 0})`,
          time: `${f.startTime.toFixed(1)}s`,
        });
      }
    });

    // Labels from positions
    positions.forEach((pos, i) => {
      newLabels.push({
        address: `POS-${String(i + 1).padStart(3, '0')}`,
        droneId: pos.name,
        formation: pos.type.toUpperCase(),
        position: `(${pos.x.toFixed(1)}, ${pos.z.toFixed(1)})`,
        time: '--',
      });
    });

    // Labels from timeline events
    timelineItems.forEach((item, i) => {
      newLabels.push({
        address: `CUE_${String(i + 1).padStart(3, '0')}`,
        droneId: item.effectId,
        formation: 'EVENT',
        position: `(${item.position.x.toFixed(1)}, ${item.position.z.toFixed(1)})`,
        time: `${item.startTime.toFixed(1)}s`,
      });
    });

    setLabels(newLabels);
    setGenerated(true);
  }, [droneFormations, positions, timelineItems]);

  const handlePrint = useCallback(() => {
    const content = printRef.current;
    if (!content) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html><head><title>${projectName} - Labels</title>
      <style>
        body { margin: 10mm; font-family: monospace; color: #000; }
        .label-grid { display: flex; flex-wrap: wrap; gap: 1mm; }
        .sticker { width: 66.6mm; height: 25.4mm; border: 0.1mm solid #ccc; padding: 2mm; font-size: 8px; background: white; box-sizing: border-box; }
        .sticker .addr { font-size: 10px; font-weight: 900; }
        .sticker .detail { color: #666; margin-top: 1mm; }
        @media print { body { margin: 0; } }
      </style></head><body>
      <div class="label-grid">
        ${labels.map((l) => `
          <div class="sticker">
            <div class="addr">${l.address}</div>
            <div class="detail">ID: ${l.droneId}</div>
            <div class="detail">FORM: ${l.formation} | POS: ${l.position}</div>
            <div class="detail">TIME: ${l.time} | ${projectName}</div>
          </div>
        `).join('')}
      </div></body></html>
    `);
    printWindow.document.close();
    printWindow.print();
  }, [labels, projectName]);

  const handleExportCSV = useCallback(() => {
    const header = 'Address,DroneID,Formation,Position,Time\n';
    const rows = labels.map((l) => `${l.address},${l.droneId},${l.formation},"${l.position}",${l.time}`).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${projectName.replace(/\s+/g, '_')}_labels.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [labels, projectName]);

  return (
    <div className="h-full flex flex-col bg-surface-0 border-l border-border">
      <div className="flex items-center justify-between p-2 border-b border-border bg-surface-1">
        <div className="flex items-center gap-1.5">
          <Tag className="w-3.5 h-3.5 text-primary" />
          <span className="text-[10px] font-bold font-mono-code text-foreground tracking-wider uppercase">
            Logistics · Labels
          </span>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="p-2 space-y-1.5">
        <Button
          onClick={generateLabels}
          variant="outline"
          size="sm"
          className="w-full h-7 text-[9px] gap-1"
        >
          <Tag className="w-3 h-3" />
          Gerar Etiquetas Avery
        </Button>

        {generated && (
          <div className="flex gap-1">
            <Button onClick={handlePrint} variant="outline" size="sm" className="flex-1 h-6 text-[8px] gap-0.5">
              <Printer className="w-2.5 h-2.5" /> Imprimir
            </Button>
            <Button onClick={handleExportCSV} variant="outline" size="sm" className="flex-1 h-6 text-[8px] gap-0.5">
              <Download className="w-2.5 h-2.5" /> CSV
            </Button>
          </div>
        )}
      </div>

      <div ref={printRef} className="flex-1 overflow-y-auto p-2 space-y-1">
        {!generated && (
          <p className="text-[9px] text-muted-foreground text-center py-4">
            Gere etiquetas para impressão em folha Avery 5160 (30 etiquetas/folha)
          </p>
        )}
        {labels.map((l, i) => (
          <div key={i} className="p-1.5 rounded border border-border/50 bg-surface-1/50 text-[8px] font-mono-code">
            <div className="flex items-center justify-between">
              <span className="font-bold text-foreground text-[9px]">{l.address}</span>
              <span className="text-muted-foreground">{l.time}</span>
            </div>
            <div className="text-muted-foreground mt-0.5">
              ID: {l.droneId} · {l.formation} · {l.position}
            </div>
          </div>
        ))}
        {generated && labels.length === 0 && (
          <p className="text-[9px] text-muted-foreground text-center py-4">
            Nenhum dado para gerar etiquetas. Adicione formações ou posições primeiro.
          </p>
        )}
      </div>
    </div>
  );
}
