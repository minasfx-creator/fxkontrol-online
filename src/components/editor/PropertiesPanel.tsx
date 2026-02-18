import { useState } from 'react';
import { Settings2, Download, FileJson, FileSpreadsheet, Box, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

function NumberField({
  label,
  value,
  onChange,
  color,
  step = 0.1,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  color?: string;
  step?: number;
}) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-[10px] font-mono-code w-3" style={{ color }}>{label}</span>
      <Input
        type="number"
        value={value}
        step={step}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="h-6 text-[10px] font-mono-code px-1.5 bg-surface-2 border-border w-full"
      />
    </div>
  );
}

function PositionInspector() {
  const { selectedPositionId, positions, updatePosition, removePosition } = useProjectStore();
  const pos = positions.find((p) => p.id === selectedPositionId);

  if (!pos) return null;

  const color = pos.type === 'pyro' ? '#FF6B35' : '#00B4D8';

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
        <div className="flex-1">
          <Input
            value={pos.name}
            onChange={(e) => updatePosition(pos.id, { name: e.target.value })}
            className="h-6 text-xs font-medium bg-surface-2 border-border px-1.5"
          />
        </div>
      </div>
      <p className="text-[10px] text-muted-foreground capitalize">{pos.type === 'pyro' ? 'Pyro Position' : 'Drone Launch Pad'}</p>

      {/* Coordinates */}
      <div className="bg-surface-2 rounded-sm p-2 space-y-1.5">
        <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Position (VVIZ)</p>
        <div className="grid grid-cols-3 gap-1">
          <NumberField label="X" value={pos.x} onChange={(v) => updatePosition(pos.id, { x: v })} color="hsl(0 72% 51%)" />
          <NumberField label="Y" value={pos.y} onChange={(v) => updatePosition(pos.id, { y: v })} color="hsl(142 70% 45%)" />
          <NumberField label="Z" value={pos.z} onChange={(v) => updatePosition(pos.id, { z: v })} color="hsl(207 90% 54%)" />
        </div>
      </div>

      {/* Orientation */}
      <div className="bg-surface-2 rounded-sm p-2 space-y-1.5">
        <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Orientation (°)</p>
        <div className="grid grid-cols-3 gap-1">
          <NumberField label="H" value={pos.heading} onChange={(v) => updatePosition(pos.id, { heading: v })} step={1} color="hsl(24 95% 53%)" />
          <NumberField label="P" value={pos.pitch} onChange={(v) => updatePosition(pos.id, { pitch: v })} step={1} color="hsl(24 95% 53%)" />
          <NumberField label="R" value={pos.roll} onChange={(v) => updatePosition(pos.id, { roll: v })} step={1} color="hsl(24 95% 53%)" />
        </div>
      </div>

      <Button
        variant="ghost"
        size="sm"
        className="w-full justify-start gap-2 h-7 text-xs text-destructive hover:text-destructive"
        onClick={() => removePosition(pos.id)}
      >
        <Trash2 className="h-3 w-3" /> Remove Position
      </Button>
    </div>
  );
}

export default function PropertiesPanel() {
  const { selectedTimelineItemId, timelineItems, selectedEffectId, selectedPositionId } = useProjectStore();

  const selectedItem = timelineItems.find((i) => i.id === selectedTimelineItemId);
  const selectedEffect = selectedItem
    ? EFFECT_LIBRARY.find((e) => e.id === selectedItem.effectId)
    : selectedEffectId
      ? EFFECT_LIBRARY.find((e) => e.id === selectedEffectId)
      : null;

  const showPosition = selectedPositionId && !selectedEffect;

  return (
    <div className="h-full flex flex-col bg-card border-l border-border">
      {/* Header */}
      <div className="px-3 py-2 border-b border-border flex items-center gap-2">
        <Settings2 className="h-3.5 w-3.5 text-muted-foreground" />
        <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider">Properties</h2>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3">
        {showPosition ? (
          <PositionInspector />
        ) : selectedEffect ? (
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
            <p className="text-xs text-muted-foreground">Select an effect, timeline item, or position pin</p>
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
