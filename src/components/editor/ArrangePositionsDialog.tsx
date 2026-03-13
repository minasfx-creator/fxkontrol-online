import { useState, useCallback } from 'react';
import { useProjectStore, type Position } from '@/store/useProjectStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Circle, LayoutGrid, Minus, RotateCw, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

type Pattern = 'line' | 'circle' | 'grid' | 'arc' | 'v-shape';

interface ArrangeConfig {
  pattern: Pattern;
  count: number;
  spacing: number;
  radius: number;
  arcAngle: number;
  rows: number;
  cols: number;
  centerX: number;
  centerZ: number;
  rotation: number;
}

const DEFAULT_CONFIG: ArrangeConfig = {
  pattern: 'line',
  count: 10,
  spacing: 2,
  radius: 15,
  arcAngle: 180,
  rows: 3,
  cols: 5,
  centerX: 0,
  centerZ: 0,
  rotation: 0,
};

function generatePositions(config: ArrangeConfig): { x: number; z: number }[] {
  const pts: { x: number; z: number }[] = [];
  const rotRad = (config.rotation * Math.PI) / 180;
  const rotate = (x: number, z: number) => ({
    x: Math.round((x * Math.cos(rotRad) - z * Math.sin(rotRad) + config.centerX) * 10) / 10,
    z: Math.round((x * Math.sin(rotRad) + z * Math.cos(rotRad) + config.centerZ) * 10) / 10,
  });

  switch (config.pattern) {
    case 'line': {
      const total = config.count * config.spacing;
      for (let i = 0; i < config.count; i++) {
        const x = -total / 2 + i * config.spacing + config.spacing / 2;
        pts.push(rotate(x, 0));
      }
      break;
    }
    case 'circle': {
      for (let i = 0; i < config.count; i++) {
        const angle = (i / config.count) * Math.PI * 2;
        pts.push(rotate(Math.cos(angle) * config.radius, Math.sin(angle) * config.radius));
      }
      break;
    }
    case 'grid': {
      const totalW = (config.cols - 1) * config.spacing;
      const totalH = (config.rows - 1) * config.spacing;
      for (let r = 0; r < config.rows; r++) {
        for (let c = 0; c < config.cols; c++) {
          pts.push(rotate(
            -totalW / 2 + c * config.spacing,
            -totalH / 2 + r * config.spacing,
          ));
        }
      }
      break;
    }
    case 'arc': {
      const arcRad = (config.arcAngle * Math.PI) / 180;
      const startAngle = -arcRad / 2 + Math.PI / 2;
      for (let i = 0; i < config.count; i++) {
        const angle = startAngle + (i / Math.max(1, config.count - 1)) * arcRad;
        pts.push(rotate(Math.cos(angle) * config.radius, -Math.sin(angle) * config.radius));
      }
      break;
    }
    case 'v-shape': {
      const half = Math.ceil(config.count / 2);
      for (let i = 0; i < half; i++) {
        pts.push(rotate(-i * config.spacing, i * config.spacing));
        if (pts.length < config.count) {
          pts.push(rotate(i * config.spacing, i * config.spacing));
        }
      }
      break;
    }
  }
  return pts;
}

export default function ArrangePositionsDialog({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<ArrangeConfig>(DEFAULT_CONFIG);
  const [open, setOpen] = useState(false);
  const { addPosition, selectMultiplePositions, selectedPositionIds, positions, updatePosition } = useProjectStore();

  const arrangeExisting = selectedPositionIds.length >= 2;
  const effectiveCount = arrangeExisting ? selectedPositionIds.length : (config.pattern === 'grid' ? config.rows * config.cols : config.count);

  const handleApply = useCallback(() => {
    const pts = generatePositions({ ...config, count: effectiveCount });

    if (arrangeExisting) {
      // Rearrange existing selected positions
      const selected = positions.filter(p => selectedPositionIds.includes(p.id));
      selected.forEach((p, i) => {
        if (pts[i]) updatePosition(p.id, { x: pts[i].x, z: pts[i].z });
      });
      toast.success(`Arranged ${selected.length} positions in ${config.pattern}`);
    } else {
      // Create new positions
      const newIds: string[] = [];
      pts.forEach((pt, i) => {
        const id = `pos-${Date.now()}-${Math.random().toString(36).slice(2, 5)}-${i}`;
        newIds.push(id);
        addPosition({
          id,
          name: `POS-${String(i + 1).padStart(3, '0')}`,
          type: 'pyro',
          x: pt.x,
          y: 0,
          z: pt.z,
          heading: 0,
          pitch: 0,
          roll: 0,
          color: '#FF6B35',
        });
      });
      selectMultiplePositions(newIds);
      toast.success(`Created ${pts.length} positions in ${config.pattern}`);
    }
    setOpen(false);
  }, [config, effectiveCount, arrangeExisting, selectedPositionIds, positions, addPosition, selectMultiplePositions, updatePosition]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-mono text-sm">
            {arrangeExisting ? `Arrange ${selectedPositionIds.length} Positions` : 'Add Multiple Positions'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Pattern</Label>
            <Select value={config.pattern} onValueChange={(v) => setConfig(c => ({ ...c, pattern: v as Pattern }))}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="line"><span className="flex items-center gap-2"><Minus className="w-3 h-3" /> Line</span></SelectItem>
                <SelectItem value="circle"><span className="flex items-center gap-2"><Circle className="w-3 h-3" /> Circle</span></SelectItem>
                <SelectItem value="grid"><span className="flex items-center gap-2"><LayoutGrid className="w-3 h-3" /> Grid</span></SelectItem>
                <SelectItem value="arc"><span className="flex items-center gap-2"><RotateCw className="w-3 h-3" /> Arc</span></SelectItem>
                <SelectItem value="v-shape"><span className="flex items-center gap-2"><ChevronRight className="w-3 h-3" /> V-Shape</span></SelectItem>
              </SelectContent>
            </Select>
          </div>

          {!arrangeExisting && config.pattern !== 'grid' && (
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Count</Label>
              <Input type="number" min={2} max={200} value={config.count} onChange={e => setConfig(c => ({ ...c, count: parseInt(e.target.value) || 2 }))} className="h-8 text-xs" />
            </div>
          )}

          {config.pattern === 'grid' && !arrangeExisting && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Rows</Label>
                <Input type="number" min={1} max={50} value={config.rows} onChange={e => setConfig(c => ({ ...c, rows: parseInt(e.target.value) || 1 }))} className="h-8 text-xs" />
              </div>
              <div>
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Columns</Label>
                <Input type="number" min={1} max={50} value={config.cols} onChange={e => setConfig(c => ({ ...c, cols: parseInt(e.target.value) || 1 }))} className="h-8 text-xs" />
              </div>
            </div>
          )}

          <div>
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Spacing (m): {config.spacing}</Label>
            <Slider min={0.5} max={10} step={0.5} value={[config.spacing]} onValueChange={([v]) => setConfig(c => ({ ...c, spacing: v }))} />
          </div>

          {(config.pattern === 'circle' || config.pattern === 'arc') && (
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Radius (m): {config.radius}</Label>
              <Slider min={2} max={100} step={1} value={[config.radius]} onValueChange={([v]) => setConfig(c => ({ ...c, radius: v }))} />
            </div>
          )}

          {config.pattern === 'arc' && (
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Arc Angle (°): {config.arcAngle}</Label>
              <Slider min={30} max={350} step={5} value={[config.arcAngle]} onValueChange={([v]) => setConfig(c => ({ ...c, arcAngle: v }))} />
            </div>
          )}

          <div>
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Rotation (°): {config.rotation}</Label>
            <Slider min={0} max={360} step={5} value={[config.rotation]} onValueChange={([v]) => setConfig(c => ({ ...c, rotation: v }))} />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Center X</Label>
              <Input type="number" step={0.5} value={config.centerX} onChange={e => setConfig(c => ({ ...c, centerX: parseFloat(e.target.value) || 0 }))} className="h-8 text-xs" />
            </div>
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Center Z</Label>
              <Input type="number" step={0.5} value={config.centerZ} onChange={e => setConfig(c => ({ ...c, centerZ: parseFloat(e.target.value) || 0 }))} className="h-8 text-xs" />
            </div>
          </div>

          <div className="bg-muted/50 rounded p-2 text-center text-xs text-muted-foreground font-mono">
            {effectiveCount} positions · {config.pattern}
          </div>

          <Button onClick={handleApply} className="w-full">
            {arrangeExisting ? 'Arrange Selected' : 'Create Positions'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
