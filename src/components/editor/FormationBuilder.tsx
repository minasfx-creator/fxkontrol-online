import { useState, useMemo, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import { useProjectStore } from '@/store/useProjectStore';
import {
  generateFormation,
  FORMATION_PRESETS,
  type FormationType,
  type FormationConfig,
  type FormationPoint,
} from '@/lib/formations';

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

    // Background
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

    // Find bounding box for scaling
    let maxDist = 0;
    for (const p of points) {
      const dist = Math.max(Math.abs(p.x), Math.abs(p.z));
      if (dist > maxDist) maxDist = dist;
    }
    maxDist = Math.max(maxDist, 1);
    const scale = Math.min(drawW, drawH) / (maxDist * 2.4);

    // Draw points
    for (let i = 0; i < points.length; i++) {
      const px = w / 2 + points[i].x * scale;
      const py = h / 2 + points[i].z * scale;

      // Glow
      const gradient = ctx.createRadialGradient(px, py, 0, px, py, 8);
      gradient.addColorStop(0, 'hsla(207, 90%, 54%, 0.5)');
      gradient.addColorStop(1, 'hsla(207, 90%, 54%, 0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(px - 8, py - 8, 16, 16);

      // Dot
      ctx.beginPath();
      ctx.arc(px, py, 3, 0, Math.PI * 2);
      ctx.fillStyle = 'hsl(207 90% 54%)';
      ctx.fill();
    }

    // Count label
    ctx.fillStyle = 'hsl(240 5% 55%)';
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`${points.length} drones`, w - padding, h - padding + 14);
  }, [points, radius]);

  return (
    <canvas
      ref={canvasRef}
      width={280}
      height={280}
      className="rounded-sm border border-border w-full"
      style={{ imageRendering: 'auto' }}
    />
  );
}

export default function FormationBuilder({ open, onOpenChange }: FormationBuilderProps) {
  const { addPosition } = useProjectStore();
  const [selectedType, setSelectedType] = useState<FormationType>('circle');
  const [count, setCount] = useState(24);
  const [radius, setRadius] = useState(10);
  const [spacing, setSpacing] = useState(2);
  const [rotation, setRotation] = useState(0);

  const config: FormationConfig = useMemo(
    () => ({ type: selectedType, count, radius, spacing, rotation }),
    [selectedType, count, radius, spacing, rotation]
  );

  const points = useMemo(() => generateFormation(config), [config]);

  const handleApply = () => {
    points.forEach((p, i) => {
      addPosition({
        id: `fp-${Date.now()}-${i}`,
        name: `D${String(i + 1).padStart(3, '0')}`,
        type: 'drone-pad',
        x: p.x,
        y: 0,
        z: p.z,
        heading: 0,
        pitch: 0,
        roll: 0,
        color: '#00B4D8',
      });
    });
    onOpenChange(false);
  };

  const needsRadius = ['heart', 'star', 'circle', 'wave', 'spiral'].includes(selectedType);
  const needsSpacing = ['grid', 'line', 'v-shape'].includes(selectedType);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] bg-card border-border p-0 gap-0">
        <DialogHeader className="px-4 py-3 border-b border-border">
          <DialogTitle className="text-sm font-semibold uppercase tracking-wider">
            Formation Builder
          </DialogTitle>
        </DialogHeader>

        <div className="flex">
          {/* Left: Preset selector */}
          <div className="w-[180px] border-r border-border p-2 space-y-1">
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
                  <p className="text-[9px] text-muted-foreground">{preset.description}</p>
                </div>
              </button>
            ))}
          </div>

          {/* Center: Preview */}
          <div className="flex-1 p-3 space-y-3">
            <FormationPreview points={points} radius={radius} />

            {/* Parameters */}
            <div className="space-y-2">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground font-semibold uppercase">Drones</span>
                  <span className="text-xs font-mono-code text-foreground">{count}</span>
                </div>
                <Slider
                  value={[count]}
                  onValueChange={([v]) => setCount(v)}
                  min={4}
                  max={200}
                  step={1}
                  className="w-full"
                />
              </div>

              {needsRadius && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground font-semibold uppercase">Raio (m)</span>
                    <span className="text-xs font-mono-code text-foreground">{radius}</span>
                  </div>
                  <Slider
                    value={[radius]}
                    onValueChange={([v]) => setRadius(v)}
                    min={2}
                    max={50}
                    step={1}
                    className="w-full"
                  />
                </div>
              )}

              {needsSpacing && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground font-semibold uppercase">Espaçamento (m)</span>
                    <span className="text-xs font-mono-code text-foreground">{spacing.toFixed(1)}</span>
                  </div>
                  <Slider
                    value={[spacing]}
                    onValueChange={([v]) => setSpacing(v)}
                    min={0.5}
                    max={10}
                    step={0.5}
                    className="w-full"
                  />
                </div>
              )}

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground font-semibold uppercase">Rotação (°)</span>
                  <span className="text-xs font-mono-code text-foreground">{rotation}°</span>
                </div>
                <Slider
                  value={[rotation]}
                  onValueChange={([v]) => setRotation(v)}
                  min={0}
                  max={360}
                  step={5}
                  className="w-full"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 text-xs h-8"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                className="flex-1 text-xs h-8 bg-primary text-primary-foreground"
                onClick={handleApply}
              >
                Aplicar ({points.length} drones)
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
