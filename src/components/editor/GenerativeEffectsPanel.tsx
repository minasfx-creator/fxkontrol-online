import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Plus, Trash2, Eye, EyeOff, Layers, Sparkles, Play, Pause, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import {
  GenerativeLayer, GeneratorType, BlendMode, AudioBand,
  createDefaultLayer, renderGenerativeFrame, rgbToHex,
  GENERATIVE_PRESETS, GENERATOR_LABELS, BLEND_MODE_LABELS,
  type AudioModulationData,
  type RGBColor,
} from '@/lib/generativeEngine';
import useGenerativeStore from '@/store/useGenerativeStore';
import { setFixtureColor, type DMXUniverse } from '@/lib/dmxEngine';

interface GenerativeEffectsPanelProps {
  onClose: () => void;
}

const GRID_COLS = 16;
const GRID_ROWS = 8;
const PIXEL_COUNT = GRID_COLS * GRID_ROWS;

const AUDIO_BAND_OPTIONS: { value: AudioBand; label: string; color: string }[] = [
  { value: 'none', label: 'OFF', color: 'text-muted-foreground' },
  { value: 'bass', label: 'BASS', color: 'text-red-400' },
  { value: 'mid', label: 'MID', color: 'text-yellow-400' },
  { value: 'high', label: 'HIGH', color: 'text-cyan-400' },
];

export default function GenerativeEffectsPanel({ onClose }: GenerativeEffectsPanelProps) {
  const genStore = useGenerativeStore();

  const [layers, setLayers] = useState<GenerativeLayer[]>(() => {
    return genStore.layers.map(l => ({ ...l }));
  });
  const [playing, setPlaying] = useState(true);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [viewportLinked, setViewportLinked] = useState(genStore.enabled);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timeRef = useRef(0);
  const animRef = useRef<number>(0);
  const lastFrameRef = useRef(0);
  const dmxUniverseRef = useRef<DMXUniverse | null>(null);

  // Sync layers to generative store when viewport link is on
  useEffect(() => {
    if (viewportLinked) {
      genStore.setLayers(layers);
      genStore.setEnabled(true);
      genStore.setPlaying(playing);
    }
  }, [layers, viewportLinked, playing]);

  // Toggle viewport link
  const toggleViewportLink = useCallback((linked: boolean) => {
    setViewportLinked(linked);
    if (linked) {
      genStore.setLayers(layers);
      genStore.setEnabled(true);
      genStore.setPlaying(playing);
    } else {
      genStore.setEnabled(false);
    }
  }, [layers, playing]);

  // Simulated audio (sine-based for preview when no real audio)
  const getSimAudio = useCallback((t: number): AudioModulationData => ({
    bass: (Math.sin(t * 1.2) + 1) / 2,
    mid: (Math.sin(t * 2.5 + 1) + 1) / 2,
    high: (Math.sin(t * 4.8 + 2) + 1) / 2,
  }), []);

  // Animation loop
  useEffect(() => {
    const loop = (now: number) => {
      const dt = lastFrameRef.current ? (now - lastFrameRef.current) / 1000 : 0.016;
      lastFrameRef.current = now;
      if (playing) timeRef.current += dt;

      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const audio = getSimAudio(timeRef.current);
          const colors = renderGenerativeFrame(layers, PIXEL_COUNT, timeRef.current, audio);

          const pw = canvas.width / GRID_COLS;
          const ph = canvas.height / GRID_ROWS;

          ctx.fillStyle = '#000';
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          for (let i = 0; i < colors.length; i++) {
            const gx = i % GRID_COLS;
            const gy = Math.floor(i / GRID_COLS);
            const c = colors[i];
            ctx.fillStyle = `rgb(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)})`;
            ctx.fillRect(gx * pw + 0.5, gy * ph + 0.5, pw - 1, ph - 1);
          }
        }
      }

      animRef.current = requestAnimationFrame(loop);
    };
    animRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animRef.current);
  }, [layers, playing, getSimAudio]);

  const addLayer = () => {
    const newLayer = createDefaultLayer('colorCycle');
    setLayers(prev => [...prev, newLayer]);
    setSelectedLayerId(newLayer.id);
  };

  const removeLayer = (id: string) => {
    setLayers(prev => prev.filter(l => l.id !== id));
    if (selectedLayerId === id) setSelectedLayerId(null);
  };

  const updateLayer = (id: string, updates: Partial<GenerativeLayer>) => {
    setLayers(prev => prev.map(l => l.id === id ? { ...l, ...updates } : l));
  };

  const updateParams = (id: string, key: string, value: number | string) => {
    setLayers(prev => prev.map(l =>
      l.id === id ? { ...l, params: { ...l.params, [key]: value } } : l
    ));
  };

  const loadPreset = (presetId: string) => {
    const preset = GENERATIVE_PRESETS.find(p => p.id === presetId);
    if (preset) {
      setLayers(preset.layers.map(l => ({ ...l, id: `layer-${Date.now()}-${Math.random().toString(36).slice(2)}` })));
      setSelectedLayerId(null);
      timeRef.current = 0;
    }
  };

  const selectedLayer = layers.find(l => l.id === selectedLayerId);

  return (
    <div
      className="absolute right-3 top-12 z-40 w-[380px] rounded-2xl border border-border/20 shadow-2xl overflow-hidden flex flex-col"
      style={{
        background: 'hsl(var(--card) / 0.97)',
        backdropFilter: 'blur(24px)',
        maxHeight: 'calc(100vh - 6rem)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/15">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="text-sm font-bold text-foreground font-display tracking-wide">LIGHTJAMS</span>
          <span className="text-[9px] text-muted-foreground/50 font-mono-code">GEN ENGINE</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-1" title="Link to 3D viewport">
            <span className="text-[8px] font-bold text-muted-foreground uppercase">3D</span>
            <Switch checked={viewportLinked} onCheckedChange={toggleViewportLink} className="h-4 w-7" />
          </div>
          <Button variant="ghost" size="icon" className="h-6 w-6 rounded-md" onClick={() => setPlaying(!playing)}>
            {playing ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6 rounded-md" onClick={onClose}>
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* 2D Preview Canvas */}
      <div className="px-4 pt-3 pb-2">
        <canvas
          ref={canvasRef}
          width={GRID_COLS * 20}
          height={GRID_ROWS * 20}
          className="w-full rounded-lg border border-border/20"
          style={{ imageRendering: 'pixelated', aspectRatio: `${GRID_COLS}/${GRID_ROWS}` }}
        />
      </div>

      {/* Presets */}
      <div className="px-4 py-2 flex gap-1.5 flex-wrap">
        {GENERATIVE_PRESETS.map(p => (
          <button
            key={p.id}
            onClick={() => loadPreset(p.id)}
            className="px-2.5 py-1 rounded-lg text-[10px] font-semibold tracking-wide uppercase border border-border/15 text-muted-foreground hover:text-foreground hover:bg-primary/10 transition-all"
          >
            {p.name}
          </button>
        ))}
      </div>

      <div className="border-t border-border/10" />

      {/* Layers list */}
      <div className="flex-1 overflow-y-auto min-h-0" style={{ maxHeight: '240px' }}>
        <div className="px-4 py-2 flex items-center justify-between">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
            <Layers className="w-3 h-3" /> Layers ({layers.length})
          </span>
          <Button variant="ghost" size="icon" className="h-5 w-5 rounded-md" onClick={addLayer}>
            <Plus className="w-3 h-3" />
          </Button>
        </div>

        {layers.map((layer, idx) => (
          <div
            key={layer.id}
            className={cn(
              "mx-3 mb-1.5 px-3 py-2 rounded-xl border transition-all cursor-pointer",
              selectedLayerId === layer.id
                ? "border-primary/30 bg-primary/5"
                : "border-border/10 hover:border-border/25 bg-surface-0/30"
            )}
            onClick={() => setSelectedLayerId(layer.id === selectedLayerId ? null : layer.id)}
          >
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => { e.stopPropagation(); updateLayer(layer.id, { enabled: !layer.enabled }); }}
                className="text-muted-foreground hover:text-foreground"
              >
                {layer.enabled ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3 opacity-40" />}
              </button>
              <span className={cn("text-xs font-medium flex-1", !layer.enabled && "opacity-40")}>{layer.name}</span>
              <span className="text-[9px] font-mono-code text-muted-foreground/50">{GENERATOR_LABELS[layer.generator]}</span>
              <span className={cn(
                "text-[8px] font-bold px-1.5 py-0.5 rounded",
                layer.audioModulation === 'bass' && "bg-red-500/15 text-red-400",
                layer.audioModulation === 'mid' && "bg-yellow-500/15 text-yellow-400",
                layer.audioModulation === 'high' && "bg-cyan-500/15 text-cyan-400",
                layer.audioModulation === 'none' && "bg-muted/30 text-muted-foreground/40",
              )}>
                {layer.audioModulation === 'none' ? '—' : layer.audioModulation.toUpperCase()}
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); removeLayer(layer.id); }}
                className="text-muted-foreground/30 hover:text-destructive transition-colors"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Selected layer editor */}
      {selectedLayer && (
        <div className="border-t border-border/15 px-4 py-3 space-y-3 overflow-y-auto" style={{ maxHeight: '280px' }}>
          {/* Generator type */}
          <div>
            <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-1 block">Generator</label>
            <div className="grid grid-cols-4 gap-1">
              {(Object.keys(GENERATOR_LABELS) as GeneratorType[]).map(g => (
                <button
                  key={g}
                  onClick={() => updateLayer(selectedLayer.id, { generator: g })}
                  className={cn(
                    "text-[9px] font-semibold py-1.5 rounded-lg border transition-all",
                    selectedLayer.generator === g
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-border/10 text-muted-foreground hover:text-foreground"
                  )}
                >
                  {GENERATOR_LABELS[g]}
                </button>
              ))}
            </div>
          </div>

          {/* Parameters */}
          <div className="space-y-2">
            {(['speed', 'intensity', 'spread', 'offset'] as const).map(param => (
              <div key={param} className="flex items-center gap-3">
                <span className="text-[9px] font-mono-code text-muted-foreground/60 w-14 uppercase">{param}</span>
                <Slider
                  value={[selectedLayer.params[param]]}
                  onValueChange={([v]) => updateParams(selectedLayer.id, param, v)}
                  min={0}
                  max={param === 'speed' ? 12 : 1}
                  step={param === 'speed' ? 0.1 : 0.01}
                  className="flex-1"
                />
                <span className="text-[9px] font-mono-code text-muted-foreground/50 w-8 text-right tabular-nums">
                  {selectedLayer.params[param].toFixed(param === 'speed' ? 1 : 2)}
                </span>
              </div>
            ))}
          </div>

          {/* Colors */}
          <div className="flex items-center gap-3">
            <span className="text-[9px] font-mono-code text-muted-foreground/60 uppercase">Colors</span>
            <input
              type="color"
              value={selectedLayer.params.color1}
              onChange={(e) => updateParams(selectedLayer.id, 'color1', e.target.value)}
              className="w-7 h-7 rounded-lg border border-border/20 cursor-pointer"
            />
            <input
              type="color"
              value={selectedLayer.params.color2}
              onChange={(e) => updateParams(selectedLayer.id, 'color2', e.target.value)}
              className="w-7 h-7 rounded-lg border border-border/20 cursor-pointer"
            />
          </div>

          {/* Blend mode */}
          <div className="flex items-center gap-3">
            <span className="text-[9px] font-mono-code text-muted-foreground/60 w-14 uppercase">Blend</span>
            <div className="flex gap-1">
              {(Object.keys(BLEND_MODE_LABELS) as BlendMode[]).map(m => (
                <button
                  key={m}
                  onClick={() => updateLayer(selectedLayer.id, { blendMode: m })}
                  className={cn(
                    "text-[8px] font-semibold px-2 py-1 rounded-md border transition-all",
                    selectedLayer.blendMode === m
                      ? "border-primary/30 bg-primary/10 text-primary"
                      : "border-border/10 text-muted-foreground hover:text-foreground"
                  )}
                >
                  {BLEND_MODE_LABELS[m]}
                </button>
              ))}
            </div>
          </div>

          {/* Audio modulation */}
          <div className="flex items-center gap-3">
            <span className="text-[9px] font-mono-code text-muted-foreground/60 w-14 uppercase">Audio</span>
            <div className="flex gap-1">
              {AUDIO_BAND_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => updateLayer(selectedLayer.id, { audioModulation: opt.value })}
                  className={cn(
                    "text-[8px] font-bold px-2 py-1 rounded-md border transition-all",
                    selectedLayer.audioModulation === opt.value
                      ? `border-primary/30 bg-primary/10 ${opt.color}`
                      : "border-border/10 text-muted-foreground hover:text-foreground"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Opacity */}
          <div className="flex items-center gap-3">
            <span className="text-[9px] font-mono-code text-muted-foreground/60 w-14 uppercase">Opacity</span>
            <Slider
              value={[selectedLayer.opacity]}
              onValueChange={([v]) => updateLayer(selectedLayer.id, { opacity: v })}
              min={0} max={1} step={0.01}
              className="flex-1"
            />
            <span className="text-[9px] font-mono-code text-muted-foreground/50 w-8 text-right tabular-nums">
              {Math.round(selectedLayer.opacity * 100)}%
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
