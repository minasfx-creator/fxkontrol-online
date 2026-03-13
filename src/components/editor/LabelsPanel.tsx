import { useState } from 'react';
import { Printer, X, Tag, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useProjectStore } from '@/store/useProjectStore';
import { generateLabels, generateLabelHTML, LABEL_PRESETS, type LabelData } from '@/lib/labelGenerator';
import { cn } from '@/lib/utils';

export default function LabelsPanel({ onClose }: { onClose: () => void }) {
  const [preset, setPreset] = useState('avery-5160');
  const items = useProjectStore(s => s.timelineItems);
  const positions = useProjectStore(s => s.positions);

  const labels = generateLabels(items, positions);
  const config = LABEL_PRESETS[preset];

  const handlePrint = () => {
    const html = generateLabelHTML(labels, config);
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
      setTimeout(() => win.print(), 500);
    }
  };

  return (
    <div className="h-full flex flex-col bg-surface-0 border-l border-border/50">
      <div className="p-3 border-b border-border/30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Tag className="w-4 h-4 text-primary" />
          <span className="text-xs font-bold text-foreground uppercase tracking-wider">Labels</span>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}><X className="w-3 h-3" /></Button>
      </div>

      <div className="p-2 space-y-2">
        <div>
          <label className="text-[9px] text-muted-foreground uppercase">Label Template</label>
          <Select value={preset} onValueChange={setPreset}>
            <SelectTrigger className="h-7 text-xs bg-surface-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="avery-5160">Avery 5160 (30/page)</SelectItem>
              <SelectItem value="avery-5163">Avery 5163 (10/page)</SelectItem>
              <SelectItem value="custom-tube">Custom Tube Labels (48/page)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="text-[9px] text-muted-foreground font-mono-code bg-surface-1/50 p-2 rounded border border-border/20">
          <div>{config.labelsPerRow} × {config.labelsPerColumn} = {config.labelsPerRow * config.labelsPerColumn} labels/page</div>
          <div>{config.labelWidth}mm × {config.labelHeight}mm each</div>
          <div>{labels.length} total labels to print</div>
          <div>{Math.ceil(labels.length / (config.labelsPerRow * config.labelsPerColumn))} page(s)</div>
        </div>

        <Button size="sm" className="w-full h-8 text-xs" onClick={handlePrint} disabled={labels.length === 0}>
          <Printer className="w-3 h-3 mr-1.5" />
          Print Labels ({labels.length})
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-2">
        <div className="text-[9px] text-muted-foreground uppercase tracking-wider mb-1">Preview</div>
        <div className="space-y-1">
          {labels.slice(0, 20).map(l => (
            <div key={l.cue} className="flex items-center gap-2 px-2 py-1 bg-surface-1/30 rounded border border-border/20 text-[9px] font-mono-code">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: l.color }} />
              <span className="text-muted-foreground w-8">#{l.cue}</span>
              <span className="flex-1 truncate text-foreground">{l.effectName}</span>
              <span className="text-muted-foreground">{l.time}</span>
            </div>
          ))}
          {labels.length > 20 && (
            <div className="text-[9px] text-center text-muted-foreground py-1">
              +{labels.length - 20} more labels
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
