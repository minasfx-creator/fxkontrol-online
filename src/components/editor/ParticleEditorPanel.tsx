import { useState, useRef, useCallback, useMemo } from 'react';
import { Atom, X, Play, Pause, RotateCcw, Palette, Sparkles, Flame, Wind as WindIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface ParticlePreset {
  id: string;
  name: string;
  icon: string;
  params: ParticleParams;
}

interface ParticleParams {
  count: number;
  lifetime: number;         // seconds
  speed: number;            // m/s
  speedVariance: number;    // 0-1
  gravity: number;          // m/s²
  drag: number;             // 0-1
  spread: number;           // degrees
  size: number;             // px
  sizeEnd: number;          // px at end of life
  colorStart: string;       // hex
  colorEnd: string;         // hex
  emissionRate: number;     // particles/sec
  turbulence: number;       // 0-1
  windInfluence: number;    // 0-1
  fadeIn: number;           // 0-1 (fraction of lifetime)
  fadeOut: number;           // 0-1
  rotationSpeed: number;    // deg/s
  shape: 'point' | 'circle' | 'star' | 'spark' | 'smoke';
  blendMode: 'additive' | 'normal' | 'multiply' | 'screen' | 'overlay' | 'soft-light' | 'hard-light';
  trail: boolean;
  trailLength: number;
  bounce: boolean;
  bounceDecay: number;      // 0-1
}

const DEFAULT_PARAMS: ParticleParams = {
  count: 200,
  lifetime: 2.5,
  speed: 15,
  speedVariance: 0.3,
  gravity: 9.8,
  drag: 0.02,
  spread: 360,
  size: 4,
  sizeEnd: 1,
  colorStart: '#FFD700',
  colorEnd: '#FF4500',
  emissionRate: 100,
  turbulence: 0.1,
  windInfluence: 0.5,
  fadeIn: 0.05,
  fadeOut: 0.3,
  rotationSpeed: 0,
  shape: 'spark',
  blendMode: 'additive',
  trail: true,
  trailLength: 3,
  bounce: false,
  bounceDecay: 0.5,
};

const PRESETS: ParticlePreset[] = [
  { id: 'peony', name: 'Peony Burst', icon: '🌸', params: { ...DEFAULT_PARAMS, spread: 360, speed: 20, gravity: 4, lifetime: 3, colorStart: '#FF6B6B', colorEnd: '#FF0000', trail: true } },
  { id: 'willow', name: 'Willow', icon: '🌿', params: { ...DEFAULT_PARAMS, spread: 180, speed: 12, gravity: 2, lifetime: 5, drag: 0.05, colorStart: '#FFD700', colorEnd: '#8B4513', trail: true, trailLength: 8 } },
  { id: 'crackle', name: 'Crackle', icon: '✨', params: { ...DEFAULT_PARAMS, count: 500, spread: 360, speed: 8, lifetime: 0.3, speedVariance: 0.8, colorStart: '#FFFFFF', colorEnd: '#FFD700', size: 2, shape: 'point' } },
  { id: 'waterfall', name: 'Waterfall', icon: '💧', params: { ...DEFAULT_PARAMS, spread: 30, speed: 5, gravity: 9.8, lifetime: 4, count: 300, colorStart: '#FFD700', colorEnd: '#FF8C00', emissionRate: 200, shape: 'spark' } },
  { id: 'smoke', name: 'Smoke Pot', icon: '💨', params: { ...DEFAULT_PARAMS, count: 100, spread: 60, speed: 2, gravity: -0.5, lifetime: 6, drag: 0.1, size: 12, sizeEnd: 30, colorStart: '#AAAAAA', colorEnd: '#333333', shape: 'smoke', blendMode: 'normal', trail: false, turbulence: 0.4 } },
  { id: 'comet', name: 'Comet Tail', icon: '☄️', params: { ...DEFAULT_PARAMS, count: 50, spread: 10, speed: 30, gravity: 3, lifetime: 1.5, colorStart: '#FFFFFF', colorEnd: '#4488FF', trail: true, trailLength: 12, shape: 'star' } },
];

export default function ParticleEditorPanel({ onClose }: { onClose: () => void }) {
  const [params, setParams] = useState<ParticleParams>({ ...DEFAULT_PARAMS });
  const [effectName, setEffectName] = useState('Custom Effect');
  const [previewing, setPreviewing] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const updateParam = useCallback(<K extends keyof ParticleParams>(key: K, value: ParticleParams[K]) => {
    setParams(prev => ({ ...prev, [key]: value }));
  }, []);

  const loadPreset = useCallback((preset: ParticlePreset) => {
    setParams({ ...preset.params });
    setEffectName(preset.name);
  }, []);

  const handleReset = useCallback(() => {
    setParams({ ...DEFAULT_PARAMS });
    setEffectName('Custom Effect');
  }, []);

  // Simple canvas preview
  const startPreview = useCallback(() => {
    setPreviewing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width = canvas.offsetWidth * 2;
    const h = canvas.height = canvas.offsetHeight * 2;

    interface Particle { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; size: number }
    const particles: Particle[] = [];
    let animId = 0;

    const emit = () => {
      const angle = (Math.random() - 0.5) * (params.spread * Math.PI / 180);
      const sp = params.speed * (1 + (Math.random() - 0.5) * params.speedVariance * 2);
      particles.push({
        x: w / 2,
        y: h * 0.7,
        vx: Math.sin(angle) * sp * 2,
        vy: -Math.cos(angle) * sp * 2,
        life: params.lifetime,
        maxLife: params.lifetime,
        size: params.size,
      });
    };

    const draw = () => {
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      ctx.fillRect(0, 0, w, h);

      // Emit
      const emitCount = Math.ceil(params.emissionRate / 60);
      for (let i = 0; i < emitCount && particles.length < params.count; i++) emit();

      // Update & draw
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.vy += params.gravity * 0.3;
        p.vx *= (1 - params.drag);
        p.vy *= (1 - params.drag);
        p.x += p.vx * 0.016 * 10;
        p.y += p.vy * 0.016 * 10;
        p.life -= 0.016;

        if (p.life <= 0 || p.y > h || p.x < 0 || p.x > w) {
          particles.splice(i, 1);
          continue;
        }

        const t = 1 - p.life / p.maxLife;
        const alpha = t < params.fadeIn ? t / params.fadeIn :
          t > (1 - params.fadeOut) ? (1 - t) / params.fadeOut : 1;
        const sz = params.size + (params.sizeEnd - params.size) * t;

        const blendMap: Record<string, GlobalCompositeOperation> = {
          'additive': 'lighter',
          'normal': 'source-over',
          'multiply': 'multiply',
          'screen': 'screen',
          'overlay': 'overlay',
          'soft-light': 'soft-light',
          'hard-light': 'hard-light',
        };
        ctx.globalCompositeOperation = blendMap[params.blendMode] || 'source-over';
        ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
        ctx.fillStyle = params.colorStart;
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(0.5, sz), 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      animId = requestAnimationFrame(draw);
    };

    draw();

    // Store cleanup
    const cleanup = () => {
      cancelAnimationFrame(animId);
      setPreviewing(false);
    };
    (canvas as any).__cleanup = cleanup;
  }, [params]);

  const stopPreview = useCallback(() => {
    const canvas = canvasRef.current;
    if (canvas && (canvas as any).__cleanup) {
      (canvas as any).__cleanup();
    }
  }, []);

  return (
    <div className="h-full flex flex-col bg-surface-1 border-l border-border/60">
      {/* Header */}
      <div className="flex items-center justify-between p-2 border-b border-border/40">
        <div className="flex items-center gap-1.5">
          <Atom className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-semibold text-foreground">Particle Editor</span>
        </div>
        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={onClose}>
          <X className="w-3 h-3" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-3 text-xs">
        {/* Preview canvas */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Preview</Label>
            <Button
              variant="ghost"
              size="sm"
              className="h-5 text-[9px]"
              onClick={previewing ? stopPreview : startPreview}
            >
              {previewing ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
            </Button>
          </div>
          <canvas
            ref={canvasRef}
            className="w-full h-24 rounded border border-border/40 bg-black"
          />
        </div>

        {/* Effect Name */}
        <div className="space-y-1">
          <span className="text-muted-foreground">Effect Name</span>
          <Input
            className="h-7 text-[10px]"
            value={effectName}
            onChange={(e) => setEffectName(e.target.value)}
          />
        </div>

        {/* Presets */}
        <div className="space-y-1.5">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Presets</Label>
          <div className="grid grid-cols-3 gap-1">
            {PRESETS.map(p => (
              <button
                key={p.id}
                onClick={() => loadPreset(p)}
                className="flex flex-col items-center gap-0.5 p-1.5 rounded bg-surface-2/50 hover:bg-surface-3/60 transition-colors text-[9px]"
              >
                <span className="text-sm">{p.icon}</span>
                <span className="text-muted-foreground truncate w-full text-center">{p.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Emission */}
        <div className="space-y-2">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Emission</Label>
          {[
            { label: 'Count', key: 'count' as const, min: 10, max: 2000, step: 10, fmt: (v: number) => `${v}` },
            { label: 'Rate', key: 'emissionRate' as const, min: 10, max: 500, step: 10, fmt: (v: number) => `${v}/s` },
            { label: 'Spread', key: 'spread' as const, min: 5, max: 360, step: 5, fmt: (v: number) => `${v}°` },
          ].map(({ label, key, min, max, step, fmt }) => (
            <div key={key} className="space-y-0.5">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-mono-code text-foreground">{fmt(params[key] as number)}</span>
              </div>
              <Slider min={min} max={max} step={step} value={[params[key] as number]} onValueChange={([v]) => updateParam(key, v)} />
            </div>
          ))}
        </div>

        {/* Physics */}
        <div className="space-y-2">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Physics</Label>
          {[
            { label: 'Speed', key: 'speed' as const, min: 1, max: 50, step: 1, fmt: (v: number) => `${v} m/s` },
            { label: 'Gravity', key: 'gravity' as const, min: -5, max: 20, step: 0.5, fmt: (v: number) => `${v} m/s²` },
            { label: 'Drag', key: 'drag' as const, min: 0, max: 50, step: 1, fmt: (v: number) => `${(v / 100).toFixed(2)}` },
            { label: 'Lifetime', key: 'lifetime' as const, min: 0.1, max: 10, step: 0.1, fmt: (v: number) => `${v}s` },
            { label: 'Turbulence', key: 'turbulence' as const, min: 0, max: 100, step: 5, fmt: (v: number) => `${(v / 100).toFixed(0)}%` },
            { label: 'Wind', key: 'windInfluence' as const, min: 0, max: 100, step: 5, fmt: (v: number) => `${(v / 100).toFixed(0)}%` },
          ].map(({ label, key, min, max, step, fmt }) => {
            const raw = params[key] as number;
            const sliderVal = key === 'drag' ? raw * 100 : key === 'turbulence' || key === 'windInfluence' ? raw * 100 : raw;
            return (
              <div key={key} className="space-y-0.5">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-mono-code text-foreground">{fmt(sliderVal)}</span>
                </div>
                <Slider
                  min={min}
                  max={max}
                  step={step}
                  value={[sliderVal]}
                  onValueChange={([v]) => {
                    const mapped = key === 'drag' ? v / 100 : key === 'turbulence' || key === 'windInfluence' ? v / 100 : v;
                    updateParam(key, mapped);
                  }}
                />
              </div>
            );
          })}
        </div>

        {/* Appearance */}
        <div className="space-y-2">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Appearance</Label>

          <div className="flex gap-2">
            <div className="space-y-0.5 flex-1">
              <span className="text-muted-foreground">Start Color</span>
              <input
                type="color"
                value={params.colorStart}
                onChange={(e) => updateParam('colorStart', e.target.value)}
                className="w-full h-6 rounded cursor-pointer border border-border/40"
              />
            </div>
            <div className="space-y-0.5 flex-1">
              <span className="text-muted-foreground">End Color</span>
              <input
                type="color"
                value={params.colorEnd}
                onChange={(e) => updateParam('colorEnd', e.target.value)}
                className="w-full h-6 rounded cursor-pointer border border-border/40"
              />
            </div>
          </div>

          <div className="space-y-0.5">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Size Start</span>
              <span className="font-mono-code text-foreground">{params.size}px</span>
            </div>
            <Slider min={1} max={30} step={1} value={[params.size]} onValueChange={([v]) => updateParam('size', v)} />
          </div>

          <div className="space-y-0.5">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Size End</span>
              <span className="font-mono-code text-foreground">{params.sizeEnd}px</span>
            </div>
            <Slider min={0} max={30} step={1} value={[params.sizeEnd]} onValueChange={([v]) => updateParam('sizeEnd', v)} />
          </div>

          <div className="space-y-1">
            <span className="text-muted-foreground">Shape</span>
            <Select value={params.shape} onValueChange={(v) => updateParam('shape', v as ParticleParams['shape'])}>
              <SelectTrigger className="h-7 text-[10px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="point">Point</SelectItem>
                <SelectItem value="circle">Circle</SelectItem>
                <SelectItem value="star">Star</SelectItem>
                <SelectItem value="spark">Spark</SelectItem>
                <SelectItem value="smoke">Smoke</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <span className="text-muted-foreground">Blend Mode</span>
            <Select value={params.blendMode} onValueChange={(v) => updateParam('blendMode', v as ParticleParams['blendMode'])}>
              <SelectTrigger className="h-7 text-[10px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="additive">Additive (Glow)</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="screen">Screen</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Trail</span>
            <Switch checked={params.trail} onCheckedChange={(v) => updateParam('trail', v)} />
          </div>
          {params.trail && (
            <div className="space-y-0.5">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Trail Length</span>
                <span className="font-mono-code text-foreground">{params.trailLength}</span>
              </div>
              <Slider min={1} max={20} step={1} value={[params.trailLength]} onValueChange={([v]) => updateParam('trailLength', v)} />
            </div>
          )}

          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Ground Bounce</span>
            <Switch checked={params.bounce} onCheckedChange={(v) => updateParam('bounce', v)} />
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-1.5 pt-1">
          <Button variant="outline" size="sm" className="w-full h-7 text-[10px]" onClick={handleReset}>
            <RotateCcw className="w-3 h-3 mr-1" />
            Reset to Default
          </Button>
          <Button variant="default" size="sm" className="w-full h-7 text-[10px]">
            <Sparkles className="w-3 h-3 mr-1" />
            Save as Custom Effect
          </Button>
        </div>
      </div>
    </div>
  );
}
