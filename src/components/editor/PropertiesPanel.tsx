import { useState } from 'react';
import { Settings2, Download, FileJson, FileSpreadsheet, Box, Trash2, Zap, Shield, Sliders, MapPin, Link2, Unlink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useProjectStore, EFFECT_LIBRARY } from '@/store/useProjectStore';
import { Separator } from '@/components/ui/separator';
import { exportVVIZ, exportFiringCSV, downloadFile } from '@/lib/exportEngine';
import SafetyPanel from './SafetyPanel';

function ExportSection() {
  const { timelineItems, positions, projectName, duration, trajectories, droneFormations } = useProjectStore();

  const droneCount = (droneFormations.length > 0 ? droneFormations[0].droneCount : 0) +
    timelineItems.filter((item) => {
      const effect = EFFECT_LIBRARY.find((e) => e.id === item.effectId);
      return effect?.type === 'drone';
    }).length + trajectories.length;

  const pyroCount = timelineItems.filter((item) => {
    const effect = EFFECT_LIBRARY.find((e) => e.id === item.effectId);
    return effect?.type === 'firework';
  }).length;

  const handleExportVVIZ = () => {
    const content = exportVVIZ(projectName, duration, timelineItems, positions, trajectories, droneFormations);
    downloadFile(content, `${projectName.replace(/\s+/g, '_')}.vviz`, 'application/json');
  };

  const handleExportFiringCSV = () => {
    const content = exportFiringCSV(timelineItems, positions);
    downloadFile(content, `${projectName.replace(/\s+/g, '_')}_firing.csv`, 'text/csv');
  };

  const handleExportJSON = () => {
    const data = {
      project: projectName,
      exportedAt: new Date().toISOString(),
      items: timelineItems.map((item) => {
        const effect = EFFECT_LIBRARY.find((e) => e.id === item.effectId);
        return { ...item, effectName: effect?.name, effectType: effect?.type };
      }),
      positions,
    };
    downloadFile(JSON.stringify(data, null, 2), `${projectName.replace(/\s+/g, '_')}.json`, 'application/json');
  };

  return (
    <div className="space-y-1.5">
      {/* Drone export */}
      <div className="rounded-xl p-2 space-y-1" style={{ background: 'hsl(var(--surface-0) / 0.5)' }}>
        <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/50 px-1 font-display">Drone Show</p>
        <Button variant="ghost" size="sm" className="w-full justify-start gap-2 h-8 text-xs rounded-lg" onClick={handleExportVVIZ}>
          <Box className="h-3.5 w-3.5 text-primary" />
          <span className="flex-1 text-left">Export .VVIZ</span>
          <span className="text-[9px] text-muted-foreground/40 font-mono-code">{droneCount}</span>
        </Button>
      </div>

      {/* Pyro export */}
      <div className="rounded-xl p-2 space-y-1" style={{ background: 'hsl(var(--surface-0) / 0.5)' }}>
        <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/50 px-1 font-display">Firing System</p>
        <Button variant="ghost" size="sm" className="w-full justify-start gap-2 h-8 text-xs rounded-lg" onClick={handleExportFiringCSV}>
          <Zap className="h-3.5 w-3.5 text-accent" />
          <span className="flex-1 text-left">Cobra / FireTEK CSV</span>
          <span className="text-[9px] text-muted-foreground/40 font-mono-code">{pyroCount}</span>
        </Button>
      </div>

      {/* Generic */}
      <Button variant="ghost" size="sm" className="w-full justify-start gap-2 h-8 text-xs rounded-lg" onClick={handleExportJSON}>
        <FileJson className="h-3.5 w-3.5 text-muted-foreground/40" />
        <span className="flex-1 text-left">Export Project JSON</span>
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
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] font-mono-code w-3 font-semibold" style={{ color }}>{label}</span>
      <Input
        type="number"
        value={value}
        step={step}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="h-7 text-[10px] font-mono-code px-2 rounded-lg bg-surface-0/50 border-border/15 w-full focus:border-primary/30"
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
    <div className="space-y-2.5">
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 rounded-lg" style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}33` }} />
        <div className="flex-1">
          <Input
            value={pos.name}
            onChange={(e) => updatePosition(pos.id, { name: e.target.value })}
            className="h-7 text-xs font-semibold rounded-lg bg-surface-0/50 border-border/15 px-2 focus:border-primary/30"
          />
        </div>
      </div>
      <p className="text-[10px] text-muted-foreground/60 capitalize font-display">{pos.type === 'pyro' ? '🎆 Pyro Position' : '🛸 Drone Launch Pad'}</p>

      {/* Coordinates */}
      <div className="rounded-xl p-2.5 space-y-2" style={{ background: 'hsl(var(--surface-0) / 0.5)' }}>
        <p className="text-[10px] text-muted-foreground/50 font-semibold uppercase tracking-wider font-display">Position (m)</p>
        <div className="grid grid-cols-3 gap-1.5">
          <NumberField label="X" value={pos.x} onChange={(v) => updatePosition(pos.id, { x: v })} color="hsl(0 72% 51%)" />
          <NumberField label="Y" value={pos.y} onChange={(v) => updatePosition(pos.id, { y: v })} color="hsl(142 70% 45%)" />
          <NumberField label="Z" value={pos.z} onChange={(v) => updatePosition(pos.id, { z: v })} color="hsl(207 90% 54%)" />
        </div>
      </div>

      {/* Orientation */}
      <div className="rounded-xl p-2.5 space-y-2" style={{ background: 'hsl(var(--surface-0) / 0.5)' }}>
        <p className="text-[10px] text-muted-foreground/50 font-semibold uppercase tracking-wider font-display">Orientation (°)</p>
        <div className="grid grid-cols-3 gap-1.5">
          <NumberField label="H" value={pos.heading} onChange={(v) => updatePosition(pos.id, { heading: v })} step={1} color="hsl(24 95% 53%)" />
          <NumberField label="P" value={pos.pitch} onChange={(v) => updatePosition(pos.id, { pitch: v })} step={1} color="hsl(24 95% 53%)" />
          <NumberField label="R" value={pos.roll} onChange={(v) => updatePosition(pos.id, { roll: v })} step={1} color="hsl(24 95% 53%)" />
        </div>
      </div>

      <Button
        variant="ghost"
        size="sm"
        className="w-full justify-start gap-2 h-8 text-xs text-destructive/60 hover:text-destructive hover:bg-destructive/8 rounded-lg"
        onClick={() => removePosition(pos.id)}
      >
        <Trash2 className="h-3 w-3" /> Remove Position
      </Button>
    </div>
  );
}

export default function PropertiesPanel({ onToggleEffectEditor, showEffectEditor }: { onToggleEffectEditor?: () => void; showEffectEditor?: boolean }) {
  const { selectedTimelineItemId, timelineItems, selectedEffectId, selectedPositionId, positions, updateTimelineItem } = useProjectStore();

  const selectedItem = timelineItems.find((i) => i.id === selectedTimelineItemId);
  const selectedEffect = selectedItem
    ? EFFECT_LIBRARY.find((e) => e.id === selectedItem.effectId)
    : selectedEffectId
      ? EFFECT_LIBRARY.find((e) => e.id === selectedEffectId)
      : null;

  const showPosition = selectedPositionId && !selectedEffect;

  // Position linking helpers
  const linkedPosition = selectedItem?.positionId
    ? positions.find(p => p.id === selectedItem.positionId)
    : null;
  const pyroPositions = positions.filter(p => p.type === 'pyro');

  const handleLinkPosition = (posId: string) => {
    if (!selectedItem) return;
    const pos = positions.find(p => p.id === posId);
    if (!pos) return;
    updateTimelineItem(selectedItem.id, {
      positionId: posId,
      positionName: pos.name,
      position: { x: pos.x, y: pos.y, z: pos.z },
    });
  };

  const handleUnlinkPosition = () => {
    if (!selectedItem) return;
    updateTimelineItem(selectedItem.id, {
      positionId: undefined,
      positionIds: undefined,
      positionName: undefined,
    });
  };

  // Count effects assigned to each position
  const getPositionEffectCount = (posId: string) =>
    timelineItems.filter(i => i.positionId === posId).length;

  return (
    <div className="h-full flex flex-col border-l border-border/10" style={{ background: 'hsl(var(--card))' }}>
      {/* Header */}
      <div className="px-3.5 py-2.5 border-b border-border/10 flex items-center gap-2">
        <div className="w-5 h-5 rounded-lg bg-gradient-to-br from-primary/10 to-accent/8 flex items-center justify-center">
          <Settings2 className="h-3 w-3 text-primary/70" />
        </div>
        <h2 className="text-[11px] font-bold text-foreground uppercase tracking-[0.1em] font-display">Properties</h2>
      </div>

      <div className="flex-1 overflow-y-auto px-3.5 py-3 space-y-3">
        {showPosition ? (
          <>
            <PositionInspector />
            {/* Show effects linked to this position */}
            {selectedPositionId && (
              <div className="space-y-1">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Linked Effects</p>
                {timelineItems.filter(i => i.positionId === selectedPositionId).length === 0 ? (
                  <p className="text-[10px] text-muted-foreground italic">No effects linked. Double-click an effect in the Asset Palette to assign it here.</p>
                ) : (
                  <div className="space-y-0.5">
                    {timelineItems.filter(i => i.positionId === selectedPositionId).map(item => {
                      const eff = EFFECT_LIBRARY.find(e => e.id === item.effectId);
                      if (!eff) return null;
                      return (
                        <div key={item.id} className="flex items-center gap-1.5 bg-surface-2 rounded-sm px-2 py-1">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: eff.color }} />
                          <span className="text-[10px] flex-1 truncate">{eff.name}</span>
                          <span className="text-[9px] text-muted-foreground font-mono-code">{item.startTime.toFixed(1)}s</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </>
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
                <div className="rounded-xl p-2.5" style={{ background: 'hsl(var(--surface-0) / 0.5)' }}>
                  <p className="text-[10px] text-muted-foreground/40 mb-0.5 font-display">Duration</p>
                  <p className="text-xs font-mono-code text-foreground font-semibold">{selectedEffect.duration}s</p>
                </div>
                <div className="rounded-xl p-2.5" style={{ background: 'hsl(var(--surface-0) / 0.5)' }}>
                  <p className="text-[10px] text-muted-foreground/40 mb-0.5 font-display">Cost</p>
                  <p className="text-xs font-mono-code text-accent font-semibold">${selectedEffect.cost}</p>
                </div>
              </div>

              {/* Finale 3D fields */}
              {(selectedEffect.caliber || selectedEffect.prefire || selectedEffect.safetyDistance) && (
                <div className="rounded-xl p-2.5 space-y-1.5" style={{ background: 'hsl(var(--surface-0) / 0.5)' }}>
                  <p className="text-[10px] text-muted-foreground/40 font-semibold uppercase tracking-wider font-display">Pyro Specs</p>
                  <div className="grid grid-cols-3 gap-1 text-[10px] font-mono-code">
                    {selectedEffect.caliber && <div><span className="text-muted-foreground/40">Cal:</span> <span className="text-foreground">{selectedEffect.caliber}"</span></div>}
                    {selectedEffect.heightMeters && <div><span className="text-muted-foreground/40">H:</span> <span className="text-foreground">{selectedEffect.heightMeters}m</span></div>}
                    {selectedEffect.prefire && <div><span className="text-muted-foreground/40">PFT:</span> <span className="text-foreground">{selectedEffect.prefire}s</span></div>}
                  </div>
                  <div className="grid grid-cols-2 gap-1 text-[10px] font-mono-code">
                    {selectedEffect.safetyDistance && <div><span className="text-muted-foreground/40">Safety:</span> <span className="text-foreground">{selectedEffect.safetyDistance}m</span></div>}
                    {selectedEffect.pattern && <div><span className="text-muted-foreground/40">Pattern:</span> <span className="text-foreground">{selectedEffect.pattern}</span></div>}
                  </div>
                </div>
              )}

              <div className="rounded-xl p-2.5" style={{ background: 'hsl(var(--surface-0) / 0.5)' }}>
                <p className="text-[10px] text-muted-foreground/40 mb-1 font-display">Color</p>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-lg border border-border/20" style={{ backgroundColor: selectedEffect.color, boxShadow: `0 0 8px ${selectedEffect.color}33` }} />
                  <span className="text-xs font-mono-code text-muted-foreground/50">{selectedEffect.color}</span>
                </div>
              </div>

              {/* ── Position Linking (Finale 3D) ── */}
              {selectedItem && (
                <div className="bg-surface-2 rounded-sm p-2 space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3 h-3 text-primary" />
                    <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Firing Position</p>
                  </div>
                  
                  {linkedPosition ? (
                    <div className="flex items-center gap-2">
                      <Link2 className="w-3 h-3 text-primary" />
                      <div className="flex-1">
                        <p className="text-xs font-medium text-foreground">{linkedPosition.name}</p>
                        <p className="text-[9px] text-muted-foreground font-mono-code">
                          X:{linkedPosition.x.toFixed(1)} Z:{linkedPosition.z.toFixed(1)}
                        </p>
                      </div>
                      <button
                        onClick={handleUnlinkPosition}
                        className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                        title="Unlink position"
                      >
                        <Unlink className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <p className="text-[9px] text-warning italic">⚠ No position linked</p>
                      {pyroPositions.length > 0 ? (
                        <div className="max-h-24 overflow-y-auto space-y-0.5">
                          {pyroPositions.map(pos => (
                            <button
                              key={pos.id}
                              onClick={() => handleLinkPosition(pos.id)}
                              className="w-full flex items-center gap-1.5 px-1.5 py-1 rounded-sm text-left hover:bg-primary/10 transition-colors"
                            >
                              <MapPin className="w-2.5 h-2.5 text-primary flex-shrink-0" />
                              <span className="text-[10px] flex-1 truncate">{pos.name}</span>
                              <span className="text-[8px] text-muted-foreground">{getPositionEffectCount(pos.id)} fx</span>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[9px] text-muted-foreground">Add pyro positions first (P key)</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {selectedItem && (
                <div className="bg-surface-2 rounded-sm p-2">
                  <p className="text-[10px] text-muted-foreground mb-1">World Position</p>
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
            <p className="text-[9px] text-muted-foreground mt-1">💡 Select a pyro position first, then double-click an effect to assign it</p>
          </div>
        )}

        <Separator />

        {/* Effect Editor Toggle */}
        {onToggleEffectEditor && (
          <Button
            variant={showEffectEditor ? 'default' : 'outline'}
            size="sm"
            className="w-full h-7 text-xs gap-1.5"
            onClick={onToggleEffectEditor}
          >
            <Sliders className="h-3 w-3" />
            {showEffectEditor ? 'Hide Effect Editor' : 'Effect Editor (VDL)'}
          </Button>
        )}

        <Separator />
        <SafetyPanel />

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
