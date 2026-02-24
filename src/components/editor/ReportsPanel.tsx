import { FileText, Shield, Cable, Link2, ClipboardList, Download, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useProjectStore } from '@/store/useProjectStore';
import {
  generateSafetyReport,
  generateWiringReport,
  generateChainReport,
  generateCueSheet,
  openReport,
  downloadReport,
} from '@/lib/reportEngine';

const REPORTS = [
  { id: 'safety', label: 'Safety Distance', icon: Shield, desc: 'NFPA 1123 fallout & mortar distances', color: 'text-destructive' },
  { id: 'wiring', label: 'Wiring Script', icon: Cable, desc: 'Module/Slat/Pin wiring schedule', color: 'text-primary' },
  { id: 'chain', label: 'Chain Specs', icon: Link2, desc: 'Chain sequences and timing', color: 'text-warning' },
  { id: 'cuesheet', label: 'Cue Sheet', icon: ClipboardList, desc: 'Pinboard cue list for crew', color: 'text-success' },
] as const;

type ReportId = typeof REPORTS[number]['id'];

export default function ReportsPanel({ onClose }: { onClose: () => void }) {
  const { projectName, timelineItems, positions } = useProjectStore();

  const generate = (id: ReportId): string => {
    switch (id) {
      case 'safety': return generateSafetyReport(projectName, timelineItems, positions);
      case 'wiring': return generateWiringReport(projectName, timelineItems, positions);
      case 'chain': return generateChainReport(projectName, timelineItems);
      case 'cuesheet': return generateCueSheet(projectName, timelineItems, positions);
    }
  };

  const handleOpen = (id: ReportId) => openReport(generate(id));
  const handleDownload = (id: ReportId) => downloadReport(generate(id), `${projectName}-${id}.html`);

  return (
    <div className="h-full flex flex-col bg-card border-l border-border">
      <div className="px-3 py-2 border-b border-border flex items-center gap-2">
        <FileText className="h-3.5 w-3.5 text-muted-foreground" />
        <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider flex-1">Reports</h2>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xs">✕</button>
      </div>

      <div className="flex-1 overflow-auto p-2 space-y-2">
        {timelineItems.length === 0 && (
          <div className="px-2 py-6 text-center">
            <FileText className="h-6 w-6 text-muted-foreground/20 mx-auto mb-2" />
            <p className="text-[10px] text-muted-foreground/60">Add items to the timeline to generate reports</p>
          </div>
        )}

        {timelineItems.length > 0 && REPORTS.map(({ id, label, icon: Icon, desc, color }) => (
          <div key={id} className="bg-surface-2 rounded border border-border p-2">
            <div className="flex items-center gap-2 mb-1.5">
              <Icon className={`h-3.5 w-3.5 ${color}`} />
              <span className="text-[10px] font-semibold text-foreground flex-1">{label}</span>
            </div>
            <p className="text-[9px] text-muted-foreground mb-2">{desc}</p>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-[9px] gap-1 flex-1"
                onClick={() => handleOpen(id)}
              >
                <ExternalLink className="h-3 w-3" /> Open
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-[9px] gap-1 flex-1"
                onClick={() => handleDownload(id)}
              >
                <Download className="h-3 w-3" /> Download
              </Button>
            </div>
          </div>
        ))}

        {timelineItems.length > 0 && (
          <div className="bg-surface-2 rounded border border-border p-2">
            <p className="text-[9px] text-muted-foreground">
              💡 Reports open in a new window. Use <b>Ctrl+P</b> to print as PDF.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
