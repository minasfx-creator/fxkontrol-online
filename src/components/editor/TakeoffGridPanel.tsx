/**
 * ─── Takeoff Grid Panel ─────────────────────────────────────────────
 * Skybrush Studio-style takeoff/landing grid generator.
 * Configures grid pattern, spacing, orientation and drone count.
 */

import { useState, useMemo, useCallback } from 'react';
import { Grid3x3, Circle, Minus, Hexagon, RotateCw, Copy, Download, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { generateGrid, recommendedSpacing, type GridConfig, type GridPosition } from '@/lib/skybrushCoordinates';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface TakeoffGridPanelProps {
  onClose?: () => void;
}

export default function TakeoffGridPanel({ onClose }: TakeoffGridPanelProps) {
  const [droneCount, setDroneCount] = useState(100);
  const [spacing, setSpacing] = useState(2.5);
  const [pattern, setPattern] = useState<GridConfig['pattern']>('square');
  const [orientation, setOrientation] = useState(0);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetZ, setOffsetZ] = useState(0);

  const config: GridConfig = useMemo(() => ({
    droneCount,
    spacing,
    pattern,
    orientation,
    centerOffset: { x: offsetX, z: offsetZ },
  }), [droneCount, spacing, pattern, orientation, offsetX, offsetZ]);

  const positions = useMemo(() => generateGrid(config), [config]);
  const recommended = useMemo(() => recommendedSpacing(droneCount), [droneCount]);

  // Grid bounds for SVG preview
  const bounds = useMemo(() => {
    if (positions.length === 0) return { minX: -10, maxX: 10, minZ: -10, maxZ: 10 };
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    positions.forEach(p => {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minZ = Math.min(minZ, p.z);
      maxZ = Math.max(maxZ, p.z);
    });
    const pad = spacing * 2;
    return { minX: minX - pad, maxX: maxX + pad, minZ: minZ - pad, maxZ: maxZ + pad };
  }, [positions, spacing]);

  const handleCopyPositions = useCallback(() => {
    const csv = positions.map(p => `${p.label},${p.x.toFixed(2)},${p.y.toFixed(2)},${p.z.toFixed(2)}`).join('\n');
    navigator.clipboard.writeText(`Label,X,Y,Z\n${csv}`);
    toast.success(`${positions.length} positions copied to clipboard`);
  }, [positions]);

  const handleAutoSpacing = useCallback(() => {
    setSpacing(recommended);
    toast.info(`Spacing set to ${recommended.toFixed(1)}m`);
  }, [recommended]);

  const patternIcon = {
    square: <Grid3x3 className="w-3.5 h-3.5" />,
    hex: <Hexagon className="w-3.5 h-3.5" />,
    line: <Minus className="w-3.5 h-3.5" />,
    circle: <Circle className="w-3.5 h-3.5" />,
  };

  const gridWidth = bounds.maxX - bounds.minX;
  const gridDepth = bounds.maxZ - bounds.minZ;

  return (
    <div className="h-full flex flex-col bg-surface-0 border-l border-border">
      <div className="p-2 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Grid3x3 className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-bold text-foreground tracking-wide">TAKEOFF GRID</span>
          </div>
          <Badge variant="outline" className="text-[8px]">{positions.length} pads</Badge>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-4">
          {/* Grid Preview SVG */}
          <div className="bg-background rounded border border-border p-1">
            <svg
              viewBox={`${bounds.minX} ${bounds.minZ} ${gridWidth} ${gridDepth}`}
              className="w-full h-40"
              style={{ background: 'hsl(var(--background))' }}
            >
              {/* Grid lines */}
              <line x1={bounds.minX} y1={0} x2={bounds.maxX} y2={0} stroke="hsl(var(--muted-foreground))" strokeWidth={0.1} opacity={0.3} />
              <line x1={0} y1={bounds.minZ} x2={0} y2={bounds.maxZ} stroke="hsl(var(--muted-foreground))" strokeWidth={0.1} opacity={0.3} />
              
              {/* Drone positions */}
              {positions.map(p => (
                <g key={p.id}>
                  <circle
                    cx={p.x}
                    cy={p.z}
                    r={spacing * 0.2}
                    fill="hsl(var(--primary))"
                    opacity={0.8}
                  />
                  {droneCount <= 50 && (
                    <text
                      x={p.x}
                      y={p.z + spacing * 0.45}
                      textAnchor="middle"
                      fontSize={spacing * 0.25}
                      fill="hsl(var(--muted-foreground))"
                    >
                      {p.label}
                    </text>
                  )}
                </g>
              ))}

              {/* Origin marker */}
              <circle cx={offsetX} cy={offsetZ} r={spacing * 0.15} fill="none" stroke="hsl(var(--destructive))" strokeWidth={0.15} />
            </svg>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-background rounded p-1.5 text-center">
              <div className="text-[9px] text-muted-foreground">Width</div>
              <div className="text-xs font-bold text-foreground">{gridWidth.toFixed(1)}m</div>
            </div>
            <div className="bg-background rounded p-1.5 text-center">
              <div className="text-[9px] text-muted-foreground">Depth</div>
              <div className="text-xs font-bold text-foreground">{gridDepth.toFixed(1)}m</div>
            </div>
            <div className="bg-background rounded p-1.5 text-center">
              <div className="text-[9px] text-muted-foreground">Area</div>
              <div className="text-xs font-bold text-foreground">{(gridWidth * gridDepth).toFixed(0)}m²</div>
            </div>
          </div>

          {/* Pattern */}
          <div>
            <Label className="text-[10px] text-muted-foreground mb-1 block">Pattern</Label>
            <div className="grid grid-cols-4 gap-1">
              {(['square', 'hex', 'line', 'circle'] as const).map(p => (
                <Button
                  key={p}
                  size="sm"
                  variant={pattern === p ? 'default' : 'outline'}
                  className="h-7 text-[10px] gap-1"
                  onClick={() => setPattern(p)}
                >
                  {patternIcon[p]}
                  {p === 'square' ? 'Grid' : p === 'hex' ? 'Hex' : p === 'line' ? 'Line' : 'Circle'}
                </Button>
              ))}
            </div>
          </div>

          {/* Drone Count */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label className="text-[10px] text-muted-foreground">Drones</Label>
              <span className="text-[10px] font-mono text-foreground">{droneCount}</span>
            </div>
            <Slider
              value={[droneCount]}
              onValueChange={([v]) => setDroneCount(v)}
              min={4}
              max={2000}
              step={1}
              className="h-4"
            />
          </div>

          {/* Spacing */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label className="text-[10px] text-muted-foreground">Spacing</Label>
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-mono text-foreground">{spacing.toFixed(1)}m</span>
                <Button size="sm" variant="ghost" className="h-4 w-4 p-0" onClick={handleAutoSpacing} title={`Auto: ${recommended.toFixed(1)}m`}>
                  <RefreshCw className="w-2.5 h-2.5" />
                </Button>
              </div>
            </div>
            <Slider
              value={[spacing]}
              onValueChange={([v]) => setSpacing(v)}
              min={1.5}
              max={8}
              step={0.1}
              className="h-4"
            />
          </div>

          {/* Orientation */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label className="text-[10px] text-muted-foreground">Orientation</Label>
              <span className="text-[10px] font-mono text-foreground">{orientation}°</span>
            </div>
            <Slider
              value={[orientation]}
              onValueChange={([v]) => setOrientation(v)}
              min={0}
              max={359}
              step={1}
              className="h-4"
            />
          </div>

          {/* Offset */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px] text-muted-foreground">Offset X</Label>
              <Input
                type="number"
                value={offsetX}
                onChange={e => setOffsetX(Number(e.target.value))}
                className="h-6 text-xs"
              />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">Offset Z</Label>
              <Input
                type="number"
                value={offsetZ}
                onChange={e => setOffsetZ(Number(e.target.value))}
                className="h-6 text-xs"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border">
            <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1" onClick={handleCopyPositions}>
              <Copy className="w-3 h-3" /> Copy CSV
            </Button>
            <Button size="sm" variant="default" className="h-7 text-[10px] gap-1">
              <Download className="w-3 h-3" /> Apply to Show
            </Button>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
