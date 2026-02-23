import { useState, useEffect, useMemo } from 'react';
import { Sliders, Wand2, X, Sparkles } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { parseVDL, toVDL, getVDLColors, type VDLResult } from '@/lib/vdlParser';
import { useProjectStore } from '@/store/useProjectStore';
import { cn } from '@/lib/utils';

const VDL_COLORS = getVDLColors();

interface EffectEditorProps {
  initialVDL?: string;
  onClose?: () => void;
}

export default function EffectEditor({ initialVDL = '', onClose }: EffectEditorProps) {
  const { addTimelineItem, currentTime } = useProjectStore();
  const [vdlInput, setVdlInput] = useState(initialVDL);
  const [params, setParams] = useState<VDLResult>(() => parseVDL(initialVDL));

  // Sync VDL input → params
  useEffect(() => {
    if (vdlInput) {
      const parsed = parseVDL(vdlInput);
      if (parsed.valid) setParams(parsed);
    }
  }, [vdlInput]);

  // Generate display VDL from params
  const displayVDL = useMemo(() => toVDL(params), [params]);

  const updateParam = <K extends keyof VDLResult>(key: K, value: VDLResult[K]) => {
    setParams(prev => ({ ...prev, [key]: value }));
  };

  const toggleColor = (name: string, hex: string) => {
    setParams(prev => {
      const has = prev.colorNames.includes(name);
      return {
        ...prev,
        colorNames: has ? prev.colorNames.filter(c => c !== name) : [...prev.colorNames, name],
        colors: has ? prev.colors.filter(c => c !== hex) : [...prev.colors, hex],
      };
    });
  };

  const toggleModifier = (mod: string) => {
    setParams(prev => ({
      ...prev,
      modifiers: prev.modifiers.includes(mod)
        ? prev.modifiers.filter(m => m !== mod)
        : [...prev.modifiers, mod],
    }));
  };

  const handleAddToTimeline = () => {
    const colorStr = params.colorNames.map(c => c.charAt(0).toUpperCase() + c.slice(1)).join('/');
    const name = `${params.caliber}" ${colorStr} ${params.typeName}`.trim();
    const typeIcons: Record<string, string> = {
      peony: '🔴', chrysanthemum: '💥', dahlia: '🟣', willow: '🎆',
      palm: '🌴', brocade: '👑', comet: '☄️', shell: '💫',
      mine: '💫', fountain: '⚜️', fan: '🪭', salute: '💢',
    };

    const newItem = {
      id: `tl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      effectId: `vdl-${Date.now()}`,
      startTime: currentTime,
      trackIndex: 0,
      position: {
        x: (Math.random() - 0.5) * 16,
        y: params.height / 10,
        z: (Math.random() - 0.5) * 8,
      },
      notes: `VDL: ${displayVDL} | Stars: ${params.starCount} | Spread: ${params.spread}°`,
    };
    addTimelineItem(newItem);
  };

  return (
    <div className="h-full flex flex-col bg-card border-l border-border">
      {/* Header */}
      <div className="px-3 py-2 border-b border-border flex items-center gap-2">
        <Sliders className="h-3.5 w-3.5 text-primary" />
        <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider flex-1">Effect Editor</h2>
        {onClose && (
          <Button variant="ghost" size="icon" className="h-5 w-5" onClick={onClose}>
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3">
        {/* VDL Input */}
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">VDL Description</Label>
          <div className="relative">
            <Wand2 className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-primary" />
            <Input
              placeholder='e.g. 4in Red Gold Chrysanthemum w/ tail'
              value={vdlInput}
              onChange={(e) => setVdlInput(e.target.value)}
              className="h-8 pl-7 text-xs bg-surface-2 border-border font-mono-code"
            />
          </div>
          {vdlInput && (
            <p className={cn("text-[10px]", params.valid ? "text-primary" : "text-muted-foreground")}>
              {params.valid ? `✓ ${displayVDL}` : 'Type a VDL description...'}
            </p>
          )}
        </div>

        {/* Caliber */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Caliber</Label>
            <span className="text-xs font-mono-code text-foreground">{params.caliber}" ({params.caliberMM}mm)</span>
          </div>
          <Slider
            value={[params.caliber]}
            onValueChange={([v]) => updateParam('caliber', v)}
            min={1} max={12} step={0.5}
            className="py-1"
          />
          <div className="flex justify-between text-[9px] text-muted-foreground">
            <span>1"</span><span>6"</span><span>12"</span>
          </div>
        </div>

        {/* Colors */}
        <div className="space-y-1.5">
          <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Colors</Label>
          <div className="flex flex-wrap gap-1">
            {VDL_COLORS.map(({ name, hex }) => (
              <button
                key={name}
                onClick={() => toggleColor(name, hex)}
                className={cn(
                  "w-5 h-5 rounded-full border-2 transition-transform",
                  params.colorNames.includes(name)
                    ? "border-foreground scale-110"
                    : "border-transparent opacity-60 hover:opacity-100"
                )}
                style={{ backgroundColor: hex }}
                title={name}
              />
            ))}
          </div>
          {params.colorNames.length > 0 && (
            <p className="text-[10px] text-muted-foreground">
              {params.colorNames.map(c => c.charAt(0).toUpperCase() + c.slice(1)).join(', ')}
            </p>
          )}
        </div>

        {/* Height */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Burst Height</Label>
            <span className="text-xs font-mono-code text-foreground">{params.height}m</span>
          </div>
          <Slider
            value={[params.height]}
            onValueChange={([v]) => updateParam('height', v)}
            min={10} max={300} step={5}
          />
        </div>

        {/* Spread Angle */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Spread Angle</Label>
            <span className="text-xs font-mono-code text-foreground">{params.spread}°</span>
          </div>
          <Slider
            value={[params.spread]}
            onValueChange={([v]) => updateParam('spread', v)}
            min={5} max={180} step={5}
          />
        </div>

        {/* Star Count */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Star Count</Label>
            <span className="text-xs font-mono-code text-foreground">{params.starCount}</span>
          </div>
          <Slider
            value={[params.starCount]}
            onValueChange={([v]) => updateParam('starCount', v)}
            min={1} max={500} step={5}
          />
        </div>

        {/* Duration */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Duration</Label>
            <span className="text-xs font-mono-code text-foreground">{params.duration}s</span>
          </div>
          <Slider
            value={[params.duration]}
            onValueChange={([v]) => updateParam('duration', Math.round(v * 10) / 10)}
            min={0.5} max={15} step={0.1}
          />
        </div>

        {/* Modifiers */}
        <div className="space-y-1.5">
          <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Modifiers</Label>
          <div className="flex flex-wrap gap-1">
            {['tail', 'glitter', 'strobe', 'crackle', 'pistil', 'twinkle', 'whistle', 'report'].map(mod => (
              <Badge
                key={mod}
                variant={params.modifiers.includes(mod) ? 'default' : 'outline'}
                className={cn(
                  "text-[10px] cursor-pointer capitalize",
                  params.modifiers.includes(mod) && "bg-primary text-primary-foreground"
                )}
                onClick={() => toggleModifier(mod)}
              >
                {mod}
              </Badge>
            ))}
          </div>
        </div>

        {/* Preview Summary */}
        <div className="bg-surface-2 rounded-sm p-2 space-y-1">
          <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Summary</p>
          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px]">
            <span className="text-muted-foreground">VDL</span>
            <span className="font-mono-code text-foreground truncate">{displayVDL || '—'}</span>
            <span className="text-muted-foreground">Cost</span>
            <span className="font-mono-code text-foreground">${params.cost}</span>
            <span className="text-muted-foreground">Duration</span>
            <span className="font-mono-code text-foreground">{params.duration}s</span>
            <span className="text-muted-foreground">Stars</span>
            <span className="font-mono-code text-foreground">{params.starCount}</span>
          </div>
          <div className="flex gap-1 mt-1">
            {params.colors.map((c, i) => (
              <div key={i} className="w-4 h-4 rounded-full border border-border" style={{ backgroundColor: c }} />
            ))}
          </div>
        </div>
      </div>

      {/* Add Button */}
      <div className="px-3 py-2 border-t border-border">
        <Button
          size="sm"
          className="w-full h-7 text-xs gap-1.5"
          onClick={handleAddToTimeline}
        >
          <Sparkles className="h-3 w-3" />
          Add to Timeline
        </Button>
      </div>
    </div>
  );
}
