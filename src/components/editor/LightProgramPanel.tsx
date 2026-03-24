/**
 * ─── Light Program Editor Panel ─────────────────────────────────
 * Skybrush-style LED choreography editor with:
 *   - Visual keyframe timeline with color strips
 *   - Effect library (pulse, strobe, rainbow, chase, etc.)
 *   - Per-drone or global light program editing
 *   - Preview colors in real-time on 3D drones
 *   - Export to .skyc light segments
 */

import { useState, useMemo, useCallback } from 'react';
import { useProjectStore } from '@/store/useProjectStore';
import { Lightbulb, Plus, Trash2, Copy, Play, Palette, Sparkles, Zap, Rainbow, Wind, Eye, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  type LightEffect,
  type Color4D,
  hexToColor4D,
  color4DToHex,
  evaluateLightProgram,
  simplifyLightProgram,
  generateFormationLightProgram,
  lightProgramToSkyc,
  type DroneLightProgram,
} from '@/lib/lightProgramEngine';

const EFFECT_TYPES = [
  { value: 'solid', label: 'Solid', icon: Lightbulb, description: 'Static color' },
  { value: 'pulse', label: 'Pulse', icon: Sparkles, description: 'Smooth pulsing' },
  { value: 'strobe', label: 'Strobe', icon: Zap, description: 'Fast on/off flash' },
  { value: 'rainbow', label: 'Rainbow', icon: Rainbow, description: 'Hue cycle across fleet' },
  { value: 'chase', label: 'Chase', icon: Wind, description: 'Wave across drones' },
  { value: 'breathe', label: 'Breathe', icon: Eye, description: 'Slow fade in/out' },
  { value: 'sparkle', label: 'Sparkle', icon: Sparkles, description: 'Random twinkle' },
  { value: 'gradient', label: 'Gradient', icon: Palette, description: 'Color spread across fleet' },
] as const;

export default function LightProgramPanel() {
  const { droneFormations, currentTime, duration } = useProjectStore();
  const [effects, setEffects] = useState<LightEffect[]>([]);
  const [keyframes, setKeyframes] = useState<Color4D[]>([]);
  const [selectedEffectId, setSelectedEffectId] = useState<string | null>(null);
  const [mode, setMode] = useState<'keyframes' | 'effects'>('effects');

  const droneCount = droneFormations.length > 0 ? droneFormations[0].droneCount : 100;

  // Auto-generate from formations
  const handleAutoGenerate = useCallback(() => {
    const kf = generateFormationLightProgram(
      droneFormations.map(f => ({
        startTime: f.startTime,
        transitionDuration: f.transitionDuration,
        holdDuration: f.holdDuration,
        color: f.color,
        endColor: f.endColor,
      })),
      0,
      droneCount,
    );
    setKeyframes(kf);
    toast.success(`Generated ${kf.length} keyframes from ${droneFormations.length} formations`);
  }, [droneFormations, droneCount]);

  // Add effect
  const handleAddEffect = useCallback(() => {
    const newEffect: LightEffect = {
      id: `le-${Date.now()}`,
      name: `Effect ${effects.length + 1}`,
      type: 'solid',
      startTime: currentTime,
      duration: 5,
      color: '#00AAFF',
      speed: 1,
      intensity: 1,
      params: {},
    };
    setEffects(prev => [...prev, newEffect]);
    setSelectedEffectId(newEffect.id);
  }, [effects.length, currentTime]);

  // Remove effect
  const handleRemoveEffect = useCallback((id: string) => {
    setEffects(prev => prev.filter(e => e.id !== id));
    if (selectedEffectId === id) setSelectedEffectId(null);
  }, [selectedEffectId]);

  // Update effect
  const updateEffect = useCallback((id: string, updates: Partial<LightEffect>) => {
    setEffects(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e));
  }, []);

  // Add keyframe at current time
  const handleAddKeyframe = useCallback(() => {
    const kf = hexToColor4D('#00AAFF', currentTime, true);
    setKeyframes(prev => [...prev, kf].sort((a, b) => a.t - b.t));
  }, [currentTime]);

  // Simplify keyframes
  const handleSimplify = useCallback(() => {
    const before = keyframes.length;
    const simplified = simplifyLightProgram(keyframes, 3);
    setKeyframes(simplified);
    toast.success(`Simplified: ${before} → ${simplified.length} keyframes`);
  }, [keyframes]);

  // Preview current color
  const previewProgram: DroneLightProgram = useMemo(() => ({
    droneId: 'preview',
    keyframes,
    effects,
  }), [keyframes, effects]);

  const currentColor = useMemo(() => {
    return evaluateLightProgram(previewProgram, currentTime, 0, droneCount);
  }, [previewProgram, currentTime, droneCount]);

  const currentHex = color4DToHex(currentColor);

  // Export
  const handleExport = useCallback(() => {
    const allKf = [...keyframes];
    // Bake effects into keyframes at 10 FPS
    for (const effect of effects) {
      const steps = Math.ceil(effect.duration * 10);
      for (let i = 0; i <= steps; i++) {
        const t = effect.startTime + (i / steps) * effect.duration;
        const c = evaluateLightProgram({ droneId: '', keyframes: [], effects: [effect] }, t, 0, droneCount);
        allKf.push(c);
      }
    }
    allKf.sort((a, b) => a.t - b.t);
    const simplified = simplifyLightProgram(allKf, 2);
    const skyc = lightProgramToSkyc(simplified);
    const json = JSON.stringify(skyc, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'light_program.json';
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${simplified.length} light segments`);
  }, [keyframes, effects, droneCount]);

  const selectedEffect = effects.find(e => e.id === selectedEffectId);

  return (
    <div className="space-y-3 p-1">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-primary" />
          <span className="text-xs font-semibold text-foreground">Light Program</span>
        </div>
        <div className="flex items-center gap-1">
          <Button size="sm" variant={mode === 'effects' ? 'default' : 'outline'} className="h-6 text-[10px] px-2" onClick={() => setMode('effects')}>Effects</Button>
          <Button size="sm" variant={mode === 'keyframes' ? 'default' : 'outline'} className="h-6 text-[10px] px-2" onClick={() => setMode('keyframes')}>Keyframes</Button>
        </div>
      </div>

      {/* Current color preview */}
      <div className="flex items-center gap-2 p-2 bg-surface-2 rounded border border-border/40">
        <div className="w-8 h-8 rounded border border-border/60" style={{ backgroundColor: currentHex }} />
        <div className="flex-1">
          <div className="text-[10px] font-mono-code text-muted-foreground">T={currentTime.toFixed(1)}s</div>
          <div className="text-[10px] font-mono-code text-foreground">
            R:{Math.round(currentColor.r)} G:{Math.round(currentColor.g)} B:{Math.round(currentColor.b)}
          </div>
        </div>
        <Badge variant="outline" className="text-[9px]">{droneCount} drones</Badge>
      </div>

      {/* Multi-drone preview strip */}
      <div className="flex h-4 rounded overflow-hidden border border-border/40">
        {Array.from({ length: Math.min(50, droneCount) }, (_, i) => {
          const c = evaluateLightProgram(previewProgram, currentTime, i, droneCount);
          return <div key={i} className="flex-1" style={{ backgroundColor: color4DToHex(c) }} />;
        })}
      </div>

      {mode === 'effects' ? (
        <ScrollArea className="h-[350px]">
          <div className="space-y-2 pr-2">
            {/* Auto-generate */}
            <Button size="sm" variant="outline" className="w-full h-7 text-[10px]" onClick={handleAutoGenerate}>
              <Sparkles className="w-3 h-3 mr-1" /> Auto-generate from Formations
            </Button>

            {/* Effect list */}
            {effects.map(effect => {
              const EffectIcon = EFFECT_TYPES.find(t => t.value === effect.type)?.icon || Lightbulb;
              return (
                <div
                  key={effect.id}
                  className={`p-2 rounded border cursor-pointer transition-all ${selectedEffectId === effect.id ? 'border-primary/60 bg-primary/5' : 'border-border/40 bg-surface-1 hover:bg-surface-2'}`}
                  onClick={() => setSelectedEffectId(effect.id)}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded" style={{ backgroundColor: effect.color }} />
                    <EffectIcon className="w-3 h-3 text-muted-foreground" />
                    <span className="text-[10px] font-medium flex-1">{effect.name}</span>
                    <span className="text-[9px] text-muted-foreground">{effect.startTime.toFixed(1)}s</span>
                    <Button size="sm" variant="ghost" className="h-5 w-5 p-0" onClick={(e) => { e.stopPropagation(); handleRemoveEffect(effect.id); }}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              );
            })}

            {/* Add effect */}
            <Button size="sm" variant="outline" className="w-full h-7 text-[10px]" onClick={handleAddEffect}>
              <Plus className="w-3 h-3 mr-1" /> Add Effect at {currentTime.toFixed(1)}s
            </Button>

            {/* Effect editor */}
            {selectedEffect && (
              <div className="space-y-2 p-2 bg-surface-1 rounded border border-border/40">
                <Input value={selectedEffect.name} onChange={e => updateEffect(selectedEffect.id, { name: e.target.value })} className="h-6 text-[10px]" />

                <Select value={selectedEffect.type} onValueChange={v => updateEffect(selectedEffect.id, { type: v as LightEffect['type'] })}>
                  <SelectTrigger className="h-7 text-[10px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {EFFECT_TYPES.map(t => (
                      <SelectItem key={t.value} value={t.value} className="text-[10px]">{t.label} — {t.description}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[9px] text-muted-foreground">Color</label>
                    <Input type="color" value={selectedEffect.color} onChange={e => updateEffect(selectedEffect.id, { color: e.target.value })} className="h-7" />
                  </div>
                  {selectedEffect.type === 'gradient' && (
                    <div>
                      <label className="text-[9px] text-muted-foreground">End Color</label>
                      <Input type="color" value={selectedEffect.endColor || '#FF0000'} onChange={e => updateEffect(selectedEffect.id, { endColor: e.target.value })} className="h-7" />
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[9px] text-muted-foreground">Start (s)</label>
                    <Input type="number" step={0.1} value={selectedEffect.startTime} onChange={e => updateEffect(selectedEffect.id, { startTime: +e.target.value })} className="h-6 text-[10px]" />
                  </div>
                  <div>
                    <label className="text-[9px] text-muted-foreground">Duration (s)</label>
                    <Input type="number" step={0.5} min={0.1} value={selectedEffect.duration} onChange={e => updateEffect(selectedEffect.id, { duration: +e.target.value })} className="h-6 text-[10px]" />
                  </div>
                </div>

                <div>
                  <label className="text-[9px] text-muted-foreground">Speed: {selectedEffect.speed.toFixed(1)}x</label>
                  <Slider min={0.1} max={10} step={0.1} value={[selectedEffect.speed]} onValueChange={([v]) => updateEffect(selectedEffect.id, { speed: v })} />
                </div>

                <div>
                  <label className="text-[9px] text-muted-foreground">Intensity: {Math.round(selectedEffect.intensity * 100)}%</label>
                  <Slider min={0} max={1} step={0.01} value={[selectedEffect.intensity]} onValueChange={([v]) => updateEffect(selectedEffect.id, { intensity: v })} />
                </div>

                {selectedEffect.type === 'strobe' && (
                  <div>
                    <label className="text-[9px] text-muted-foreground">Frequency (Hz)</label>
                    <Input type="number" step={1} min={1} max={30} value={selectedEffect.params.frequency ?? 10} onChange={e => updateEffect(selectedEffect.id, { params: { ...selectedEffect.params, frequency: +e.target.value } })} className="h-6 text-[10px]" />
                  </div>
                )}
              </div>
            )}
          </div>
        </ScrollArea>
      ) : (
        <ScrollArea className="h-[350px]">
          <div className="space-y-2 pr-2">
            {/* Timeline strip */}
            <div className="relative h-6 bg-surface-2 rounded border border-border/40 overflow-hidden">
              {keyframes.map((kf, i) => {
                const pos = duration > 0 ? (kf.t / duration) * 100 : 0;
                return (
                  <div key={i} className="absolute top-0 bottom-0 w-0.5 border-r border-foreground/50" style={{ left: `${pos}%`, backgroundColor: color4DToHex(kf) }} />
                );
              })}
              <div className="absolute top-0 bottom-0 w-0.5 bg-primary" style={{ left: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }} />
            </div>

            <div className="flex gap-1">
              <Button size="sm" variant="outline" className="h-6 text-[10px] flex-1" onClick={handleAddKeyframe}>
                <Plus className="w-3 h-3 mr-1" /> Add KF
              </Button>
              <Button size="sm" variant="outline" className="h-6 text-[10px] flex-1" onClick={handleSimplify}>
                Simplify ({keyframes.length})
              </Button>
              <Button size="sm" variant="outline" className="h-6 text-[10px] flex-1" onClick={handleAutoGenerate}>
                Auto
              </Button>
            </div>

            {/* Keyframe list */}
            {keyframes.map((kf, i) => (
              <div key={i} className="flex items-center gap-2 p-1.5 bg-surface-1 rounded border border-border/30">
                <div className="w-4 h-4 rounded" style={{ backgroundColor: color4DToHex(kf) }} />
                <span className="text-[9px] font-mono-code text-muted-foreground w-12">{kf.t.toFixed(1)}s</span>
                <span className="text-[9px] font-mono-code text-foreground flex-1">
                  {Math.round(kf.r)},{Math.round(kf.g)},{Math.round(kf.b)}
                </span>
                <Badge variant="outline" className="text-[8px] h-4">{kf.isFade ? 'Fade' : 'Snap'}</Badge>
                <Button size="sm" variant="ghost" className="h-5 w-5 p-0" onClick={() => setKeyframes(prev => prev.filter((_, j) => j !== i))}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}

      {/* Export */}
      <Button size="sm" variant="outline" className="w-full h-7 text-[10px]" onClick={handleExport}>
        <Download className="w-3 h-3 mr-1" /> Export Light Program
      </Button>
    </div>
  );
}
