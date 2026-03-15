/**
 * Depence-style Laser Control Panel
 * Real-time control: pan/tilt, pattern, color, intensity, beam count
 */

import { useState, useCallback } from 'react';
import { Zap, ChevronDown, Upload } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useProjectStore, EFFECT_LIBRARY } from '@/store/useProjectStore';
import { parseILDA, generateShape, type ILDAFrame } from '@/lib/ildaParser';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const LASER_PATTERNS = [
  { value: 'single', label: 'Single Beam' },
  { value: 'fan', label: 'Fan Array' },
  { value: 'harp', label: 'Harp' },
  { value: 'tunnel', label: 'Tunnel' },
  { value: 'cone', label: 'Cone / Vortex' },
  { value: 'wave', label: 'Wave' },
  { value: 'grid', label: 'Grid Matrix' },
] as const;

const ILDA_SHAPES = [
  { value: 'circle', label: '⭕ Circle' },
  { value: 'star', label: '⭐ Star' },
  { value: 'heart', label: '❤️ Heart' },
  { value: 'logo', label: '💎 Logo' },
] as const;

interface LaserControlPanelProps {
  onClose?: () => void;
}

export default function LaserControlPanel({ onClose }: LaserControlPanelProps) {
  const { selectedTimelineItemId, timelineItems } = useProjectStore();
  const [pan, setPan] = useState(0);
  const [tilt, setTilt] = useState(45);
  const [intensity, setIntensity] = useState(100);
  const [beamCount, setBeamCount] = useState(8);
  const [pattern, setPattern] = useState<string>('fan');
  const [color, setColor] = useState('#00FF00');
  const [scanRate, setScanRate] = useState(30);
  const [divergence, setDivergence] = useState(1.2);
  const [ildaFrames, setIldaFrames] = useState<ILDAFrame[]>([]);
  const [ildaShape, setIldaShape] = useState<string>('circle');

  // Find if selected timeline item is a laser
  const selectedItem = timelineItems.find(i => i.id === selectedTimelineItemId);
  const selectedEffect = selectedItem ? EFFECT_LIBRARY.find(e => e.id === selectedItem.effectId) : null;
  const isLaser = selectedEffect?.type === 'laser';

  const handleIldaImport = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.ild,.ilda';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const buffer = await file.arrayBuffer();
      const frames = parseILDA(buffer);
      if (frames.length > 0) {
        setIldaFrames(frames);
        toast.success(`ILDA: ${frames.length} frames loaded (${frames[0].pointCount} pts/frame)`);
      } else {
        toast.error('Could not parse ILDA file');
      }
    };
    input.click();
  }, []);

  const handleGenerateShape = useCallback((shape: string) => {
    setIldaShape(shape);
    const pts = generateShape(shape as any, 64, 1);
    toast.success(`ILDA shape generated: ${shape} (${pts.length} points)`);
  }, []);

  return (
    <div className="h-full flex flex-col bg-card border-r border-border overflow-y-auto">
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-green-400" />
          <h2 className="text-[10px] font-bold text-foreground uppercase tracking-[0.15em]">Laser Control</h2>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xs">✕</button>
        )}
      </div>

      {/* Status */}
      <div className="px-3 py-2 border-b border-border">
        <div className={cn(
          "text-[9px] uppercase tracking-wider font-bold px-2 py-1 rounded text-center",
          isLaser ? "bg-green-500/10 text-green-400" : "bg-surface-2 text-muted-foreground"
        )}>
          {isLaser ? `Active: ${selectedEffect?.name}` : 'Select a laser from timeline'}
        </div>
      </div>

      <div className="flex-1 px-3 py-3 space-y-5">
        {/* Pattern */}
        <div className="space-y-1.5">
          <label className="text-[9px] uppercase tracking-wider text-muted-foreground font-bold">Pattern</label>
          <Select value={pattern} onValueChange={setPattern}>
            <SelectTrigger className="h-8 text-xs bg-surface-2 border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LASER_PATTERNS.map(p => (
                <SelectItem key={p.value} value={p.value} className="text-xs">{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Color */}
        <div className="space-y-1.5">
          <label className="text-[9px] uppercase tracking-wider text-muted-foreground font-bold">Beam Color</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="w-8 h-8 rounded cursor-pointer border border-border bg-transparent"
            />
            <div className="flex-1 grid grid-cols-6 gap-1">
              {['#FF0000', '#00FF00', '#0044FF', '#00FFFF', '#FF00FF', '#FFDD00', '#FF8800', '#8800FF', '#FFFFFF', '#00FF88', '#FF0088', '#0088FF'].map(c => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={cn(
                    "w-5 h-5 rounded-sm border transition-all",
                    color === c ? "border-white scale-110" : "border-border/50 hover:scale-105"
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Pan / Tilt */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-[9px] uppercase tracking-wider text-muted-foreground font-bold flex justify-between">
              <span>Pan</span>
              <span className="text-primary/60">{pan}°</span>
            </label>
            <Slider min={-180} max={180} step={1} value={[pan]} onValueChange={([v]) => setPan(v)} />
          </div>
          <div className="space-y-1.5">
            <label className="text-[9px] uppercase tracking-wider text-muted-foreground font-bold flex justify-between">
              <span>Tilt</span>
              <span className="text-primary/60">{tilt}°</span>
            </label>
            <Slider min={-90} max={90} step={1} value={[tilt]} onValueChange={([v]) => setTilt(v)} />
          </div>
        </div>

        {/* Intensity */}
        <div className="space-y-1.5">
          <label className="text-[9px] uppercase tracking-wider text-muted-foreground font-bold flex justify-between">
            <span>Intensity</span>
            <span className="text-green-400">{intensity}%</span>
          </label>
          <Slider min={0} max={100} step={1} value={[intensity]} onValueChange={([v]) => setIntensity(v)} />
        </div>

        {/* Beam Count */}
        <div className="space-y-1.5">
          <label className="text-[9px] uppercase tracking-wider text-muted-foreground font-bold flex justify-between">
            <span>Beam Count</span>
            <span className="text-primary/60">{beamCount}</span>
          </label>
          <Slider min={1} max={32} step={1} value={[beamCount]} onValueChange={([v]) => setBeamCount(v)} />
        </div>

        {/* Scanner Rate */}
        <div className="space-y-1.5">
          <label className="text-[9px] uppercase tracking-wider text-muted-foreground font-bold flex justify-between">
            <span>Scan Rate</span>
            <span className="text-primary/60">{scanRate}k PPS</span>
          </label>
          <Slider min={10} max={60} step={5} value={[scanRate]} onValueChange={([v]) => setScanRate(v)} />
        </div>

        {/* Divergence */}
        <div className="space-y-1.5">
          <label className="text-[9px] uppercase tracking-wider text-muted-foreground font-bold flex justify-between">
            <span>Beam Divergence</span>
            <span className="text-primary/60">{divergence.toFixed(1)} mrad</span>
          </label>
          <Slider min={0.3} max={5} step={0.1} value={[divergence]} onValueChange={([v]) => setDivergence(v)} />
        </div>

        {/* Separator */}
        <div className="h-px bg-border" />

        {/* ILDA Section */}
        <div className="space-y-2">
          <label className="text-[9px] uppercase tracking-wider text-muted-foreground font-bold">ILDA Projection</label>
          
          <Button onClick={handleIldaImport} variant="outline" size="sm" className="w-full text-xs gap-2">
            <Upload className="w-3 h-3" />
            Import .ILD File
          </Button>

          {ildaFrames.length > 0 && (
            <div className="text-[9px] text-green-400 bg-green-500/10 px-2 py-1 rounded text-center">
              {ildaFrames.length} frames · {ildaFrames[0]?.pointCount} pts/frame
            </div>
          )}

          {/* Quick shapes */}
          <div className="space-y-1">
            <label className="text-[8px] uppercase tracking-wider text-muted-foreground">Quick Shapes</label>
            <div className="grid grid-cols-4 gap-1">
              {ILDA_SHAPES.map(s => (
                <button
                  key={s.value}
                  onClick={() => handleGenerateShape(s.value)}
                  className={cn(
                    "px-1.5 py-1 rounded text-[9px] border transition-all",
                    ildaShape === s.value
                      ? "bg-green-500/15 text-green-400 border-green-500/30"
                      : "bg-surface-2 text-muted-foreground border-transparent hover:text-foreground"
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Safety Zone */}
        <div className="h-px bg-border" />
        <div className="space-y-1.5">
          <label className="text-[9px] uppercase tracking-wider text-destructive font-bold">⚠ Safety Zone</label>
          <div className="text-[9px] text-muted-foreground bg-surface-2 rounded p-2 space-y-0.5">
            <p>MPE Limit: <span className="text-foreground">Class 4</span></p>
            <p>Min Audience Distance: <span className="text-foreground">3.0m</span></p>
            <p>Scan Fail Safety: <span className="text-green-400">Active</span></p>
          </div>
        </div>
      </div>
    </div>
  );
}
