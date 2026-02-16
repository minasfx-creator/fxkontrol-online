import { Settings2, Download, FileJson, FileSpreadsheet, Box } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useProjectStore, EFFECT_LIBRARY } from '@/store/useProjectStore';
import { Separator } from '@/components/ui/separator';

function ExportSection() {
  const { timelineItems, projectName } = useProjectStore();

  const exportJSON = () => {
    const data = {
      project: projectName,
      exportedAt: new Date().toISOString(),
      items: timelineItems.map((item) => {
        const effect = EFFECT_LIBRARY.find((e) => e.id === item.effectId);
        return { ...item, effectName: effect?.name, effectType: effect?.type };
      }),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${projectName.replace(/\s+/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportCSV = () => {
    const header = 'id,effectId,effectName,startTime,trackIndex,posX,posY,posZ\n';
    const rows = timelineItems.map((item) => {
      const effect = EFFECT_LIBRARY.find((e) => e.id === item.effectId);
      return `${item.id},${item.effectId},${effect?.name ?? ''},${item.startTime},${item.trackIndex},${item.position.x.toFixed(2)},${item.position.y.toFixed(2)},${item.position.z.toFixed(2)}`;
    }).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${projectName.replace(/\s+/g, '_')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportVVIZ = () => {
    const droneItems = timelineItems.filter((item) => {
      const effect = EFFECT_LIBRARY.find((e) => e.id === item.effectId);
      return effect?.type === 'drone';
    });
    const lines = droneItems.map((item) => {
      return `${item.startTime.toFixed(3)},${item.position.x.toFixed(3)},${item.position.y.toFixed(3)},${item.position.z.toFixed(3)},0.000`;
    });
    const content = `# VVIZ Drone Show Format\n# Time,X,Y,Z,Heading\n${lines.join('\n')}`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${projectName.replace(/\s+/g, '_')}.vviz`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-1.5">
      <Button variant="ghost" size="sm" className="w-full justify-start gap-2 h-7 text-xs" onClick={exportJSON}>
        <FileJson className="h-3.5 w-3.5 text-electric" /> Export JSON
      </Button>
      <Button variant="ghost" size="sm" className="w-full justify-start gap-2 h-7 text-xs" onClick={exportCSV}>
        <FileSpreadsheet className="h-3.5 w-3.5 text-success" /> Export CSV
      </Button>
      <Button variant="ghost" size="sm" className="w-full justify-start gap-2 h-7 text-xs" onClick={exportVVIZ}>
        <Box className="h-3.5 w-3.5 text-safety" /> Export .VVIZ
      </Button>
    </div>
  );
}

export default function PropertiesPanel() {
  const { selectedTimelineItemId, timelineItems, selectedEffectId } = useProjectStore();

  const selectedItem = timelineItems.find((i) => i.id === selectedTimelineItemId);
  const selectedEffect = selectedItem
    ? EFFECT_LIBRARY.find((e) => e.id === selectedItem.effectId)
    : selectedEffectId
      ? EFFECT_LIBRARY.find((e) => e.id === selectedEffectId)
      : null;

  return (
    <div className="h-full flex flex-col bg-card border-l border-border">
      {/* Header */}
      <div className="px-3 py-2 border-b border-border flex items-center gap-2">
        <Settings2 className="h-3.5 w-3.5 text-muted-foreground" />
        <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider">Properties</h2>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3">
        {selectedEffect ? (
          <>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xl">{selectedEffect.icon}</span>
                <div>
                  <p className="text-sm font-medium text-foreground">{selectedEffect.name}</p>
                  <p className="text-[10px] text-muted-foreground capitalize">{selectedEffect.category} · {selectedEffect.type}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="bg-surface-2 rounded-sm p-2">
                  <p className="text-[10px] text-muted-foreground mb-0.5">Duration</p>
                  <p className="text-xs font-mono-code text-foreground">{selectedEffect.duration}s</p>
                </div>
                <div className="bg-surface-2 rounded-sm p-2">
                  <p className="text-[10px] text-muted-foreground mb-0.5">Cost</p>
                  <p className="text-xs font-mono-code text-safety">${selectedEffect.cost}</p>
                </div>
              </div>

              <div className="bg-surface-2 rounded-sm p-2">
                <p className="text-[10px] text-muted-foreground mb-1">Color</p>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full border border-border" style={{ backgroundColor: selectedEffect.color }} />
                  <span className="text-xs font-mono-code text-muted-foreground">{selectedEffect.color}</span>
                </div>
              </div>

              {selectedItem && (
                <div className="bg-surface-2 rounded-sm p-2">
                  <p className="text-[10px] text-muted-foreground mb-1">Position</p>
                  <div className="grid grid-cols-3 gap-1 text-[10px] font-mono-code">
                    <div><span className="text-destructive">X</span> {selectedItem.position.x.toFixed(1)}</div>
                    <div><span className="text-success">Y</span> {selectedItem.position.y.toFixed(1)}</div>
                    <div><span className="text-electric">Z</span> {selectedItem.position.z.toFixed(1)}</div>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Settings2 className="h-6 w-6 text-muted-foreground/30 mb-2" />
            <p className="text-xs text-muted-foreground">Select an effect or timeline item</p>
          </div>
        )}

        <Separator />

        {/* Export */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Download className="h-3.5 w-3.5 text-muted-foreground" />
            <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">Export</h3>
          </div>
          <ExportSection />
        </div>
      </div>
    </div>
  );
}
