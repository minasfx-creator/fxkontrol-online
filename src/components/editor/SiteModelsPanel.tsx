import React from 'react';
import { X, Eye, EyeOff, Trash2, Box, Move, RotateCw, Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useSceneStore, type SiteModel } from '@/store/useSceneStore';
import { cn } from '@/lib/utils';

interface SiteModelsPanelProps {
  onClose: () => void;
}

function ModelRow({ model }: { model: SiteModel }) {
  const updateSiteModel = useSceneStore((s) => s.updateSiteModel);
  const removeSiteModel = useSceneStore((s) => s.removeSiteModel);
  const selectSiteModel = useSceneStore((s) => s.selectSiteModel);
  const selectedId = useSceneStore((s) => s.selectedSiteModelId);
  const isSelected = selectedId === model.id;

  const setPos = (axis: number, val: number) => {
    const pos = [...model.position] as [number, number, number];
    pos[axis] = val;
    updateSiteModel(model.id, { position: pos });
  };

  const setRot = (axis: number, val: number) => {
    const rot = [...model.rotation] as [number, number, number];
    rot[axis] = val;
    updateSiteModel(model.id, { rotation: rot });
  };

  return (
    <div
      className={cn(
        'rounded-lg border p-2.5 space-y-2 transition-colors cursor-pointer',
        isSelected
          ? 'border-primary/50 bg-primary/5'
          : 'border-border/20 bg-muted/30 hover:border-border/40'
      )}
      onClick={() => selectSiteModel(isSelected ? null : model.id)}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <Box className="h-3.5 w-3.5 shrink-0 text-primary" />
          <span className="text-xs font-medium truncate text-foreground">{model.name}</span>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); updateSiteModel(model.id, { visible: !model.visible }); }}
            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title={model.visible ? 'Ocultar' : 'Mostrar'}
          >
            {model.visible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); removeSiteModel(model.id); }}
            className="p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
            title="Remover"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Transform Controls */}
      <div className="space-y-1.5" onClick={(e) => e.stopPropagation()}>
        {/* Position */}
        <div className="flex items-center gap-1">
          <Move className="h-3 w-3 text-muted-foreground shrink-0" />
          <span className="text-[9px] text-muted-foreground w-5 shrink-0">Pos</span>
          {['X', 'Y', 'Z'].map((label, i) => (
            <div key={label} className="flex items-center gap-0.5 flex-1 min-w-0">
              <span className={cn('text-[8px] font-mono', i === 0 ? 'text-red-400' : i === 1 ? 'text-green-400' : 'text-blue-400')}>{label}</span>
              <input
                type="number"
                step={0.5}
                value={Number(model.position[i].toFixed(2))}
                onChange={(e) => setPos(i, parseFloat(e.target.value) || 0)}
                className="w-full h-5 text-[9px] text-center bg-background border border-border/30 rounded px-0.5 text-foreground"
              />
            </div>
          ))}
        </div>

        {/* Rotation */}
        <div className="flex items-center gap-1">
          <RotateCw className="h-3 w-3 text-muted-foreground shrink-0" />
          <span className="text-[9px] text-muted-foreground w-5 shrink-0">Rot</span>
          {['X', 'Y', 'Z'].map((label, i) => (
            <div key={label} className="flex items-center gap-0.5 flex-1 min-w-0">
              <span className={cn('text-[8px] font-mono', i === 0 ? 'text-red-400' : i === 1 ? 'text-green-400' : 'text-blue-400')}>{label}</span>
              <input
                type="number"
                step={15}
                value={Number(model.rotation[i].toFixed(1))}
                onChange={(e) => setRot(i, parseFloat(e.target.value) || 0)}
                className="w-full h-5 text-[9px] text-center bg-background border border-border/30 rounded px-0.5 text-foreground"
              />
            </div>
          ))}
        </div>

        {/* Scale */}
        <div className="flex items-center gap-1">
          <Maximize2 className="h-3 w-3 text-muted-foreground shrink-0" />
          <span className="text-[9px] text-muted-foreground w-5 shrink-0">Scl</span>
          <div className="flex items-center gap-0.5 flex-1">
            <input
              type="number"
              step={0.1}
              min={0.01}
              value={Number(model.scale.toFixed(2))}
              onChange={(e) => updateSiteModel(model.id, { scale: parseFloat(e.target.value) || 0.1 })}
              className="w-full h-5 text-[9px] text-center bg-background border border-border/30 rounded px-0.5 text-foreground"
            />
          </div>
          <span className="text-[8px] text-muted-foreground">{model.source}</span>
        </div>
      </div>
    </div>
  );
}

export default function SiteModelsPanel({ onClose }: SiteModelsPanelProps) {
  const siteModels = useSceneStore((s) => s.siteModels);

  return (
    <div className="h-full flex flex-col bg-card/95 backdrop-blur-xl border-r border-border/20">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/20">
        <div className="flex items-center gap-2">
          <Box className="h-4 w-4 text-primary" />
          <h3 className="text-xs font-semibold text-foreground">Site Models</h3>
          <span className="text-[9px] text-muted-foreground bg-muted/50 rounded-full px-1.5 py-0.5">
            {siteModels.length}
          </span>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1 px-3 py-2">
        {siteModels.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Box className="h-8 w-8 text-muted-foreground/30 mb-2" />
            <p className="text-[10px] text-muted-foreground">Nenhum modelo importado</p>
            <p className="text-[9px] text-muted-foreground/60 mt-1">
              Use o Asset Marketplace para importar modelos GLB/glTF
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {siteModels.map((model) => (
              <ModelRow key={model.id} model={model} />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
