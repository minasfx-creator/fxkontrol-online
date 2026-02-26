import { useState, useMemo, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useProjectStore, type DroneFormation } from '@/store/useProjectStore';
import {
  generateFormation,
  FORMATION_PRESETS,
  type FormationType,
  type FormationConfig,
  type FormationPoint,
} from '@/lib/formations';
import { Trash2, Plus } from 'lucide-react';

interface FormationBuilderProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** 2D preview canvas rendering formation points */
function FormationPreview({ points, radius }: { points: FormationPoint[]; radius: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const padding = 24;
    const drawW = w - padding * 2;
    const drawH = h - padding * 2;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'hsl(240 6% 8%)';
    ctx.fillRect(0, 0, w, h);

    // Grid
    ctx.strokeStyle = 'hsl(240 4% 15%)';
    ctx.lineWidth = 0.5;
    const gridStep = 20;
    for (let x = padding; x <= w - padding; x += gridStep) {
      ctx.beginPath(); ctx.moveTo(x, padding); ctx.lineTo(x, h - padding); ctx.stroke();
    }
    for (let y = padding; y <= h - padding; y += gridStep) {
      ctx.beginPath(); ctx.moveTo(padding, y); ctx.lineTo(w - padding, y); ctx.stroke();
    }

    // Center crosshair
    ctx.strokeStyle = 'hsl(240 4% 25%)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(w / 2, padding); ctx.lineTo(w / 2, h - padding); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(padding, h / 2); ctx.lineTo(w - padding, h / 2); ctx.stroke();

    if (points.length === 0) return;

    let maxDist = 0;
    for (const p of points) {
      const dist = Math.max(Math.abs(p.x), Math.abs(p.z));
      if (dist > maxDist) maxDist = dist;
    }
    maxDist = Math.max(maxDist, 1);
    const scale = Math.min(drawW, drawH) / (maxDist * 2.4);

    for (let i = 0; i < points.length; i++) {
      const px = w / 2 + points[i].x * scale;
      const py = h / 2 + points[i].z * scale;

      const gradient = ctx.createRadialGradient(px, py, 0, px, py, 8);
      gradient.addColorStop(0, 'hsla(207, 90%, 54%, 0.5)');
      gradient.addColorStop(1, 'hsla(207, 90%, 54%, 0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(px - 8, py - 8, 16, 16);

      ctx.beginPath();
      ctx.arc(px, py, 3, 0, Math.PI * 2);
      ctx.fillStyle = 'hsl(207 90% 54%)';
      ctx.fill();
    }

    ctx.fillStyle = 'hsl(240 5% 55%)';
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`${points.length} drones`, w - padding, h - padding + 14);
  }, [points, radius]);

  return (
    <canvas
      ref={canvasRef}
      width={280}
      height={220}
      className="rounded-sm border border-border w-full"
      style={{ imageRendering: 'auto' }}
    />
  );
}

function SliderField({ label, value, onChange, min, max, step, unit }: {
  label: string; value: number; onChange: (v: number) => void;
  min: number; max: number; step: number; unit?: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground font-semibold uppercase">{label}</span>
        <span className="text-xs font-mono-code text-foreground">{value}{unit || ''}</span>
      </div>
      <Slider value={[value]} onValueChange={([v]) => onChange(v)} min={min} max={max} step={step} className="w-full" />
    </div>
  );
}

export default function FormationBuilder({ open, onOpenChange }: FormationBuilderProps) {
  const { droneFormations, addDroneFormation } = useProjectStore();
  const [selectedType, setSelectedType] = useState<FormationType>('circle');
  const [count, setCount] = useState(24);
  const [radius, setRadius] = useState(10);
  const [spacing, setSpacing] = useState(2);
  const [rotation, setRotation] = useState(0);
  const [height, setHeight] = useState(20);
  const [transitionDuration, setTransitionDuration] = useState(10);
  const [holdDuration, setHoldDuration] = useState(15);
  const [color, setColor] = useState('#00B4D8');

  // Auto-calculate start time: after previous formation ends
  const lastFormationEnd = useMemo(() => {
    if (droneFormations.length === 0) return 0;
    const last = droneFormations[droneFormations.length - 1];
    return last.startTime + last.transitionDuration + last.holdDuration;
  }, [droneFormations]);

  // Match drone count to first formation if subsequent
  const isFirstFormation = droneFormations.length === 0;
  const effectiveCount = isFirstFormation ? count : droneFormations[0].droneCount;

  const config: FormationConfig = useMemo(
    () => ({ type: selectedType, count: effectiveCount, radius, spacing, rotation }),
    [selectedType, effectiveCount, radius, spacing, rotation]
  );

  const points = useMemo(() => generateFormation(config), [config]);

  const handleApply = () => {
    const formation: DroneFormation = {
      id: `form-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      formationType: selectedType,
      droneCount: effectiveCount,
      height,
      radius,
      spacing,
      rotation,
      startTime: lastFormationEnd,
      transitionDuration,
      holdDuration,
      color,
      points: points.map(p => ({ x: p.x, z: p.z })),
    };
    addDroneFormation(formation);
    onOpenChange(false);
  };

  const needsRadius = ['heart', 'star', 'circle', 'wave', 'spiral'].includes(selectedType);
  const needsSpacing = ['grid', 'line', 'v-shape'].includes(selectedType);

  // Calculate realistic max speed (drone ~15 m/s)
  const maxTransitionDistance = Math.sqrt(radius * radius + height * height) * 2;
  const minTransitionTime = Math.ceil(maxTransitionDistance / 15);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[680px] bg-card border-border p-0 gap-0">
        <DialogHeader className="px-4 py-3 border-b border-border">
          <DialogTitle className="text-sm font-semibold uppercase tracking-wider flex items-center gap-2">
            Formation Builder
            {!isFirstFormation && (
              <span className="text-[10px] font-normal text-muted-foreground bg-surface-2 px-2 py-0.5 rounded">
                Formação #{droneFormations.length + 1} · {effectiveCount} drones (da 1ª formação)
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="flex">
          {/* Left: Preset selector */}
          <div className="w-[160px] border-r border-border p-2 space-y-1">
            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider px-2 mb-1">
              Presets
            </p>
            {FORMATION_PRESETS.map((preset) => (
              <button
                key={preset.type}
                onClick={() => setSelectedType(preset.type)}
                className={cn(
                  'w-full flex items-center gap-2 px-2 py-1.5 rounded-sm text-left transition-colors text-xs',
                  selectedType === preset.type
                    ? 'bg-primary/15 text-primary border border-primary/30'
                    : 'hover:bg-surface-3 text-secondary-foreground border border-transparent'
                )}
              >
                <span className="text-base">{preset.icon}</span>
                <div>
                  <p className="font-medium">{preset.label}</p>
                </div>
              </button>
            ))}
          </div>

          {/* Center: Preview + Parameters */}
          <div className="flex-1 p-3 space-y-2">
            <FormationPreview points={points} radius={radius} />

            <div className="space-y-2">
              {isFirstFormation && (
                <SliderField label="Drones" value={count} onChange={setCount} min={4} max={500} step={1} />
              )}

              {needsRadius && (
                <SliderField label="Raio" value={radius} onChange={setRadius} min={2} max={50} step={1} unit="m" />
              )}

              {needsSpacing && (
                <SliderField label="Espaçamento" value={spacing} onChange={setSpacing} min={0.5} max={10} step={0.5} unit="m" />
              )}

              <SliderField label="Rotação" value={rotation} onChange={setRotation} min={0} max={360} step={5} unit="°" />

              <div className="border-t border-border pt-2 space-y-2">
                <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Coreografia</p>
                
                <SliderField label="Altura" value={height} onChange={setHeight} min={5} max={120} step={1} unit="m" />
                
                <SliderField 
                  label="Tempo de Transição" 
                  value={transitionDuration} 
                  onChange={setTransitionDuration} 
                  min={Math.max(3, minTransitionTime)} 
                  max={60} 
                  step={1} 
                  unit="s" 
                />
                
                <SliderField label="Tempo em Formação" value={holdDuration} onChange={setHoldDuration} min={3} max={120} step={1} unit="s" />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground font-semibold uppercase">Cor LED</span>
                <input type="color" value={color} onChange={e => setColor(e.target.value)} className="w-6 h-6 rounded border border-border cursor-pointer" />
                <span className="text-[10px] font-mono-code text-muted-foreground">{color}</span>
              </div>

              {/* Timeline info */}
              <div className="bg-surface-2 rounded-sm p-2 text-[10px] font-mono-code text-muted-foreground space-y-0.5">
                <div className="flex justify-between">
                  <span>Início</span>
                  <span className="text-foreground">{lastFormationEnd.toFixed(1)}s</span>
                </div>
                <div className="flex justify-between">
                  <span>Formada em</span>
                  <span className="text-foreground">{(lastFormationEnd + transitionDuration).toFixed(1)}s</span>
                </div>
                <div className="flex justify-between">
                  <span>Fim</span>
                  <span className="text-foreground">{(lastFormationEnd + transitionDuration + holdDuration).toFixed(1)}s</span>
                </div>
                <div className="flex justify-between">
                  <span>Vel. Máx. Estimada</span>
                  <span className={cn(
                    "text-foreground",
                    maxTransitionDistance / transitionDuration > 15 && "text-destructive"
                  )}>
                    {(maxTransitionDistance / transitionDuration).toFixed(1)} m/s
                    {maxTransitionDistance / transitionDuration > 15 && " ⚠️"}
                  </span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <Button variant="outline" size="sm" className="flex-1 text-xs h-8" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button
                size="sm"
                className="flex-1 text-xs h-8 bg-primary text-primary-foreground"
                onClick={handleApply}
              >
                <Plus className="h-3 w-3 mr-1" />
                Adicionar Formação ({effectiveCount} drones)
              </Button>
            </div>
          </div>

          {/* Right: Formation queue */}
          <div className="w-[180px] border-l border-border p-2 space-y-1">
            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider px-1 mb-1">
              Coreografia ({droneFormations.length})
            </p>
            {droneFormations.length === 0 ? (
              <p className="text-[9px] text-muted-foreground px-1">Nenhuma formação adicionada</p>
            ) : (
              <FormationQueue />
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FormationQueue() {
  const { droneFormations, removeDroneFormation, selectFormation, selectedFormationId } = useProjectStore();

  return (
    <div className="space-y-1 max-h-[350px] overflow-y-auto">
      {droneFormations.map((f, i) => {
        const preset = FORMATION_PRESETS.find(p => p.type === f.formationType);
        const endTime = f.startTime + f.transitionDuration + f.holdDuration;
        return (
          <div
            key={f.id}
            onClick={() => selectFormation(f.id)}
            className={cn(
              "p-1.5 rounded-sm border cursor-pointer transition-colors text-[10px]",
              selectedFormationId === f.id
                ? "border-primary/40 bg-primary/10"
                : "border-transparent hover:bg-surface-3"
            )}
          >
            <div className="flex items-center gap-1.5">
              <span>{preset?.icon || '⭕'}</span>
              <span className="font-medium text-foreground">{preset?.label || f.formationType}</span>
              <button
                className="ml-auto text-muted-foreground hover:text-destructive"
                onClick={(e) => { e.stopPropagation(); removeDroneFormation(f.id); }}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
            <div className="font-mono-code text-muted-foreground mt-0.5">
              {f.startTime.toFixed(0)}s → {endTime.toFixed(0)}s · {f.height}m · {f.droneCount}
            </div>
          </div>
        );
      })}
    </div>
  );
}
