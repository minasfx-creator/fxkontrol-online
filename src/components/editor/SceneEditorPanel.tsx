import { useState, useRef, useCallback } from 'react';
import { Sun, Moon, Cloud, CloudRain, Wind, Eye, Thermometer, Droplets, Sparkles, Monitor, Paintbrush, TreePine, Grid3x3, RotateCw, Layers, Zap, Image, Upload, Trash2, X, Mountain, Cloudy, Snowflake, CloudFog, Flame, Compass } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSceneStore, SCENE_PRESETS, QUALITY_PRESETS, type GroundStyle, type WeatherCondition, type QualityPreset, type ViewTransform } from '@/store/useSceneStore';
import { getAllViewTransforms } from '@/lib/niagaraBlenderRules';
import { useProjectStore } from '@/store/useProjectStore';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type SectionId = 'quick' | 'presets' | 'sky' | 'ground' | 'weather' | 'effects' | 'pyro' | 'lighting' | 'post' | 'background';

function Section({ title, icon: Icon, children, id, open, onToggle }: { title: string; icon: any; children: React.ReactNode; id: SectionId; open: boolean; onToggle: () => void }) {
  return (
    <div className="border-b border-border/20">
      <button onClick={onToggle} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-primary/5 transition-colors group">
        <div className="w-5 h-5 rounded flex items-center justify-center bg-primary/10 group-hover:bg-primary/20 transition-colors">
          <Icon className="h-3 w-3 text-primary" />
        </div>
        <span className="text-[10px] font-bold text-foreground uppercase tracking-widest flex-1 text-left">{title}</span>
        <span className={cn("text-[8px] text-muted-foreground transition-transform", open && "rotate-90")}>▶</span>
      </button>
      {open && <div className="px-3 pb-3 space-y-2.5 animate-in slide-in-from-top-1 duration-150">{children}</div>}
    </div>
  );
}

function SliderRow({ label, value, onChange, min = 0, max = 1, step = 0.01, unit = '' }: {
  label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; unit?: string;
}) {
  return (
    <div>
      <div className="flex justify-between mb-1">
        <span className="text-[9px] text-muted-foreground font-medium">{label}</span>
        <span className="text-[9px] text-primary font-mono tabular-nums">{value.toFixed(step < 1 ? 2 : 0)}{unit}</span>
      </div>
      <Slider value={[value]} onValueChange={([v]) => onChange(v)} min={min} max={max} step={step} className="py-0.5" />
    </div>
  );
}

interface BgImage {
  id: string;
  name: string;
  url: string;
  opacity: number;
  position: 'horizon' | 'skybox' | 'ground';
}

export default function SceneEditorPanel({ onClose }: { onClose: () => void }) {
  const { settings, updateSettings, applyPreset, applyQualityPreset, qualityPreset, resetToDefault } = useSceneStore();
  const { droneFormations, positions, showTrajectories, setShowTrajectories, showFormations, setShowFormations } = useProjectStore();
  const [openSections, setOpenSections] = useState<Set<SectionId>>(new Set(['quick', 'presets']));
  const [bgImages, setBgImages] = useState<BgImage[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const toggleSection = (id: SectionId) => {
    setOpenSections(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleBgImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setBgImages(prev => [...prev, { id: `bg-${Date.now()}`, name: file.name, url, opacity: 0.8, position: 'horizon' }]);
    toast.success(`Background: ${file.name}`);
    if (fileRef.current) fileRef.current.value = '';
  }, []);

  const WEATHER_ICONS: Record<WeatherCondition, typeof Sun> = {
    'clear': Sun,
    'haze': CloudFog,
    'fog': CloudFog,
    'light-rain': CloudRain,
    'heavy-rain': CloudRain,
    'snow': Snowflake,
    'wind-only': Wind,
  };

  return (
    <div className="h-full flex flex-col bg-card/95 backdrop-blur-sm border-l border-border/50">
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-border/30 flex items-center gap-2 bg-card">
        <div className="w-6 h-6 rounded-md bg-primary/15 flex items-center justify-center">
          <Paintbrush className="h-3.5 w-3.5 text-primary" />
        </div>
        <div className="flex-1">
          <h2 className="text-[11px] font-bold text-foreground uppercase tracking-widest">Scene Editor</h2>
          <p className="text-[8px] text-muted-foreground">Environment & Rendering</p>
        </div>
        <button onClick={resetToDefault} className="text-[8px] text-muted-foreground hover:text-primary px-1.5 py-0.5 rounded hover:bg-primary/10 transition-colors">RESET</button>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground w-5 h-5 flex items-center justify-center rounded hover:bg-muted/30"><X className="w-3 h-3" /></button>
      </div>

      <ScrollArea className="flex-1">
        {/* ═══ QUICK ACCESS ═══ */}
        <Section title="Quick Controls" icon={Zap} id="quick" open={openSections.has('quick')} onToggle={() => toggleSection('quick')}>
          <div className="space-y-2.5">
            {/* Visibility toggles */}
            <div className="space-y-1.5">
              <span className="text-[8px] text-muted-foreground font-bold uppercase tracking-wider">Visibility</span>
              <div className="grid grid-cols-2 gap-1">
                {[
                  { label: 'Trajectories', checked: showTrajectories, onChange: setShowTrajectories },
                  { label: 'Formations', checked: showFormations, onChange: setShowFormations },
                  { label: 'Grid', checked: settings.showGrid, onChange: (v: boolean) => updateSettings({ showGrid: v }) },
                  { label: 'Treeline', checked: settings.showTreeline, onChange: (v: boolean) => updateSettings({ showTreeline: v }) },
                  { label: 'Origin', checked: settings.showOriginMarker, onChange: (v: boolean) => updateSettings({ showOriginMarker: v }) },
                  { label: 'Scale Poles', checked: settings.showScalePoles, onChange: (v: boolean) => updateSettings({ showScalePoles: v }) },
                ].map(item => (
                  <div key={item.label} className="flex items-center justify-between px-2 py-1 bg-muted/20 rounded border border-border/10 hover:border-border/30 transition-colors">
                    <span className="text-[8px] text-muted-foreground">{item.label}</span>
                    <Switch checked={item.checked} onCheckedChange={item.onChange} className="scale-[0.55]" />
                  </div>
                ))}
              </div>
            </div>

            {/* Scene stats */}
            <div className="bg-muted/15 rounded border border-border/10 p-2 space-y-1">
              <span className="text-[8px] text-muted-foreground font-bold uppercase tracking-wider">Stats</span>
              {[
                { label: 'Positions', value: positions.length, color: 'text-foreground' },
                { label: 'Drones', value: positions.filter(p => p.type === 'drone-pad').length, color: 'text-primary' },
                { label: 'Formations', value: droneFormations.length, color: 'text-foreground' },
                { label: 'Duration', value: `${droneFormations.reduce((s, f) => s + f.transitionDuration + f.holdDuration, 0).toFixed(0)}s`, color: 'text-foreground' },
              ].map(stat => (
                <div key={stat.label} className="flex justify-between text-[9px] font-mono">
                  <span className="text-muted-foreground">{stat.label}</span>
                  <span className={stat.color}>{stat.value}</span>
                </div>
              ))}
            </div>

            <SliderRow label="Ambient" value={settings.ambientIntensity} onChange={v => updateSettings({ ambientIntensity: v })} max={0.5} />
            <SliderRow label="Fog" value={settings.fogDensity} onChange={v => updateSettings({ fogDensity: v })} />
          </div>
        </Section>

        {/* ═══ PRESETS ═══ */}
        <Section title="Scene Presets" icon={Monitor} id="presets" open={openSections.has('presets')} onToggle={() => toggleSection('presets')}>
          <div className="grid grid-cols-2 gap-1.5">
            {Object.entries(SCENE_PRESETS).map(([id, preset]) => (
              <button
                key={id}
                onClick={() => applyPreset(id)}
                className="text-left p-2 rounded-md border border-border/20 hover:border-primary/50 hover:bg-primary/5 transition-all group"
              >
                <div className="text-[9px] font-bold text-foreground group-hover:text-primary transition-colors">{preset.name}</div>
                <div className="text-[7px] text-muted-foreground leading-tight mt-0.5">{preset.description}</div>
              </button>
            ))}
          </div>
        </Section>

        {/* ═══ SKY & ATMOSPHERE ═══ */}
        <Section title="Sky & Atmosphere" icon={Moon} id="sky" open={openSections.has('sky')} onToggle={() => toggleSection('sky')}>
          <SliderRow label="Ambient Light" value={settings.ambientIntensity} onChange={v => updateSettings({ ambientIntensity: v })} max={0.5} />
          <SliderRow label="Moon Intensity" value={settings.moonIntensity} onChange={v => updateSettings({ moonIntensity: v })} max={2} />
          <div>
            <span className="text-[9px] text-muted-foreground font-medium">Moon Color</span>
            <div className="flex items-center gap-2 mt-1">
              <input type="color" value={settings.moonColor} onChange={e => updateSettings({ moonColor: e.target.value })} className="w-6 h-6 rounded border border-border/30 cursor-pointer" />
              <span className="text-[8px] font-mono text-muted-foreground">{settings.moonColor}</span>
            </div>
          </div>
          <SliderRow label="Sky Brightness" value={settings.skyBrightness} onChange={v => updateSettings({ skyBrightness: v })} max={2} />
          <SliderRow label="Star Density" value={settings.starDensity} onChange={v => updateSettings({ starDensity: v })} max={2} />
          <SliderRow label="Horizon Glow" value={settings.horizonGlow} onChange={v => updateSettings({ horizonGlow: v })} />
          <SliderRow label="Fog Density" value={settings.fogDensity} onChange={v => updateSettings({ fogDensity: v })} />
          <SliderRow label="Fog Far" value={settings.fogFar} onChange={v => updateSettings({ fogFar: v })} min={100} max={3000} step={50} />
        </Section>

        {/* ═══ GROUND ═══ */}
        <Section title="Ground & Grid" icon={Grid3x3} id="ground" open={openSections.has('ground')} onToggle={() => toggleSection('ground')}>
          <div>
            <span className="text-[9px] text-muted-foreground font-medium">Ground Style</span>
            <Select value={settings.groundStyle} onValueChange={v => updateSettings({ groundStyle: v as GroundStyle })}>
              <SelectTrigger className="h-7 text-[10px] mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="finale-dark" className="text-[10px]">Finale Dark</SelectItem>
                <SelectItem value="google-earth" className="text-[10px]">Google Earth</SelectItem>
                <SelectItem value="flat-black" className="text-[10px]">Flat Black</SelectItem>
                <SelectItem value="concrete" className="text-[10px]">Concrete</SelectItem>
                <SelectItem value="sfx-stage" className="text-[10px]">🎭 SFX Stage</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <SliderRow label="Ground Brightness" value={settings.groundBrightness} onChange={v => updateSettings({ groundBrightness: v })} max={2} />
          <SliderRow label="Grid Opacity" value={settings.gridOpacity} onChange={v => updateSettings({ gridOpacity: v })} />
          <SliderRow label="Ground Fog" value={settings.groundFogIntensity} onChange={v => updateSettings({ groundFogIntensity: v })} />
        </Section>

        {/* ═══ WEATHER ═══ */}
        <Section title="Weather" icon={Cloud} id="weather" open={openSections.has('weather')} onToggle={() => toggleSection('weather')}>
          <div>
            <span className="text-[9px] text-muted-foreground font-medium">Condition</span>
            <Select value={settings.weather} onValueChange={v => updateSettings({ weather: v as WeatherCondition })}>
              <SelectTrigger className="h-7 text-[10px] mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="clear" className="text-[10px]">Clear</SelectItem>
                <SelectItem value="haze" className="text-[10px]">Haze</SelectItem>
                <SelectItem value="fog" className="text-[10px]">Fog</SelectItem>
                <SelectItem value="light-rain" className="text-[10px]">Light Rain</SelectItem>
                <SelectItem value="heavy-rain" className="text-[10px]">Heavy Rain</SelectItem>
                <SelectItem value="snow" className="text-[10px]">Snow</SelectItem>
                <SelectItem value="wind-only" className="text-[10px]">Wind Only</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <SliderRow label="Rain Intensity" value={settings.rainIntensity} onChange={v => updateSettings({ rainIntensity: v })} />
          <SliderRow label="Wind Effect" value={settings.windEffect} onChange={v => updateSettings({ windEffect: v })} />
          <SliderRow label="Humidity" value={settings.humidity} onChange={v => updateSettings({ humidity: v })} />
          <SliderRow label="Temperature" value={settings.temperature} onChange={v => updateSettings({ temperature: v })} min={-10} max={45} step={1} unit="°C" />
          <SliderRow label="Visibility" value={settings.visibility} onChange={v => updateSettings({ visibility: v })} />
        </Section>

        {/* ═══ EFFECTS RENDERING ═══ */}
        <Section title="Effects Rendering" icon={Sparkles} id="effects" open={openSections.has('effects')} onToggle={() => toggleSection('effects')}>
          {/* Quality Presets */}
          <div className="space-y-1.5">
            <span className="text-[8px] text-muted-foreground font-bold uppercase tracking-wider">Quality Preset</span>
            <div className="grid grid-cols-3 gap-1">
              {(Object.entries(QUALITY_PRESETS) as [QualityPreset, typeof QUALITY_PRESETS[QualityPreset]][]).map(([key, qp]) => (
                <button
                  key={key}
                  onClick={() => applyQualityPreset(key)}
                  className={cn(
                    "flex flex-col items-center p-2 rounded-md border transition-all text-center",
                    qualityPreset === key
                      ? "bg-primary/15 border-primary/40 text-primary"
                      : "bg-muted/20 border-border/20 text-muted-foreground hover:border-primary/30 hover:text-foreground"
                  )}
                >
                  <span className="text-[9px] font-bold">{qp.name}</span>
                  <span className="text-[7px] leading-tight mt-0.5 opacity-70">{qp.description.split('—')[0].trim()}</span>
                </button>
              ))}
            </div>
          </div>

          <SliderRow label="Effect Height Scale" value={settings.effectScale} onChange={v => updateSettings({ effectScale: v })} max={2} />
          <SliderRow label="Effect Brightness" value={settings.effectBrightness} onChange={v => updateSettings({ effectBrightness: v })} max={2} />
          <SliderRow label="Trail Length" value={settings.trailLength} onChange={v => updateSettings({ trailLength: v })} max={2} />
          <SliderRow label="Particle Density" value={settings.particleDensity} onChange={v => updateSettings({ particleDensity: v })} min={0.5} max={2} />
          <SliderRow label="Smoke Opacity" value={settings.smokeOpacity} onChange={v => updateSettings({ smokeOpacity: v })} />
          <SliderRow label="Bloom Strength" value={settings.bloomStrength} onChange={v => updateSettings({ bloomStrength: v })} max={2} />
        </Section>

        {/* ═══ PYRO RENDERING (GPU) ═══ */}
        <Section title="Pyro Rendering" icon={Flame} id="pyro" open={openSections.has('pyro')} onToggle={() => toggleSection('pyro')}>
          <div className="space-y-2.5">
            <span className="text-[8px] text-muted-foreground font-bold uppercase tracking-wider">Shell Burst GPU</span>
            <SliderRow label="HDR Multiplier" value={settings.hdrMultiplier} onChange={v => updateSettings({ hdrMultiplier: v })} min={1} max={8} step={0.1} unit="×" />
            <SliderRow label="Star Drag" value={settings.starDrag} onChange={v => updateSettings({ starDrag: v })} min={0.01} max={0.3} step={0.005} />
            <SliderRow label="Thermal Speed" value={settings.thermalTransitionSpeed} onChange={v => updateSettings({ thermalTransitionSpeed: v })} min={0.5} max={3} step={0.1} unit="×" />
            <SliderRow label="Burst Flash" value={settings.burstFlashIntensity} onChange={v => updateSettings({ burstFlashIntensity: v })} max={2} step={0.05} />
            
            <span className="text-[8px] text-muted-foreground font-bold uppercase tracking-wider">Afterglow</span>
            <SliderRow label="Duration" value={settings.afterglowDuration} onChange={v => updateSettings({ afterglowDuration: v })} min={0.5} max={8} step={0.25} unit="s" />
            <SliderRow label="Intensity" value={settings.afterglowIntensity} onChange={v => updateSettings({ afterglowIntensity: v })} max={1} step={0.01} />

            <span className="text-[8px] text-muted-foreground font-bold uppercase tracking-wider">Wind (Particles)</span>
            <SliderRow label="Speed" value={settings.windSpeed} onChange={v => updateSettings({ windSpeed: v })} max={5} step={0.1} unit=" m/s" />
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-[9px] text-muted-foreground font-medium">Direction</span>
                <span className="text-[9px] text-primary font-mono tabular-nums">{settings.windDirection.toFixed(0)}°</span>
              </div>
              <div className="flex items-center gap-2">
                <Slider value={[settings.windDirection]} onValueChange={([v]) => updateSettings({ windDirection: v })} min={0} max={360} step={5} className="flex-1 py-0.5" />
                <div className="w-6 h-6 rounded-full border border-border/30 flex items-center justify-center relative">
                  <Compass className="w-3.5 h-3.5 text-muted-foreground" style={{ transform: `rotate(${settings.windDirection}deg)` }} />
                </div>
              </div>
              <div className="flex justify-between mt-0.5">
                {['N', 'E', 'S', 'W'].map((dir, i) => (
                  <button
                    key={dir}
                    onClick={() => updateSettings({ windDirection: i * 90 })}
                    className="text-[7px] text-muted-foreground hover:text-primary px-1 rounded hover:bg-primary/10 transition-colors"
                  >
                    {dir}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Section>

        {/* ═══ LIGHTING ═══ */}
        <Section title="Lighting" icon={Sun} id="lighting" open={openSections.has('lighting')} onToggle={() => toggleSection('lighting')}>
          <div className="flex items-center justify-between">
            <span className="text-[9px] text-muted-foreground font-medium">Shadows</span>
            <Switch checked={settings.shadowsEnabled} onCheckedChange={v => updateSettings({ shadowsEnabled: v })} className="scale-[0.65]" />
          </div>
          <div>
            <span className="text-[9px] text-muted-foreground font-medium">Shadow Quality</span>
            <Select value={settings.shadowQuality} onValueChange={v => updateSettings({ shadowQuality: v as any })}>
              <SelectTrigger className="h-7 text-[10px] mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="low" className="text-[10px]">Low (1024)</SelectItem>
                <SelectItem value="medium" className="text-[10px]">Medium (2048)</SelectItem>
                <SelectItem value="high" className="text-[10px]">High (4096)</SelectItem>
                <SelectItem value="ultra" className="text-[10px]">Ultra (8192)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <SliderRow label="Rim Light" value={settings.rimLightIntensity} onChange={v => updateSettings({ rimLightIntensity: v })} />
          <SliderRow label="Fill Light" value={settings.fillLightIntensity} onChange={v => updateSettings({ fillLightIntensity: v })} />
        </Section>

        {/* ═══ POST-PROCESSING ═══ */}
        <Section title="Post-Processing" icon={Eye} id="post" open={openSections.has('post')} onToggle={() => toggleSection('post')}>
          {/* V-Ray / Blender View Transform */}
          <div>
            <span className="text-[9px] text-muted-foreground font-medium">View Transform</span>
            <Select value={settings.viewTransform || 'aces-filmic'} onValueChange={v => updateSettings({ viewTransform: v as ViewTransform })}>
              <SelectTrigger className="h-7 text-[10px] mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {getAllViewTransforms().map(vt => (
                  <SelectItem key={vt.id} value={vt.id} className="text-[10px]">{vt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <SliderRow label="Exposure Compensation" value={(settings.exposureCompensation ?? 0) / 4 + 0.5} onChange={v => updateSettings({ exposureCompensation: (v - 0.5) * 4 })} />
          <div className="text-[8px] text-muted-foreground text-right">{((settings.exposureCompensation ?? 0) >= 0 ? '+' : '') + (settings.exposureCompensation ?? 0).toFixed(1)} EV</div>
          <div className="flex items-center justify-between">
            <span className="text-[9px] text-muted-foreground font-medium">Vignette</span>
            <Switch checked={settings.vignetteEnabled} onCheckedChange={v => updateSettings({ vignetteEnabled: v })} className="scale-[0.65]" />
          </div>
          {settings.vignetteEnabled && (
            <SliderRow label="Vignette Intensity" value={settings.vignetteIntensity} onChange={v => updateSettings({ vignetteIntensity: v })} />
          )}
          <div className="flex items-center justify-between">
            <span className="text-[9px] text-muted-foreground font-medium">Chromatic Aberration</span>
            <Switch checked={settings.chromaticAberration} onCheckedChange={v => updateSettings({ chromaticAberration: v })} className="scale-[0.65]" />
          </div>
          <SliderRow label="Film Grain" value={settings.filmGrain} onChange={v => updateSettings({ filmGrain: v })} />
        </Section>

        {/* ═══ BACKGROUND IMAGES ═══ */}
        <Section title="Background Images" icon={Image} id="background" open={openSections.has('background')} onToggle={() => toggleSection('background')}>
          <input ref={fileRef} type="file" accept="image/*" onChange={handleBgImport} className="hidden" />
          <Button size="sm" variant="outline" className="w-full h-7 text-[9px] border-dashed" onClick={() => fileRef.current?.click()}>
            <Upload className="w-3 h-3 mr-1.5" /> Import Background
          </Button>
          <div className="text-[8px] text-muted-foreground">Panoramic, skyline, venue photos</div>

          {bgImages.length === 0 ? (
            <div className="text-center py-4">
              <Image className="w-6 h-6 text-muted-foreground/20 mx-auto mb-1" />
              <p className="text-[8px] text-muted-foreground">No backgrounds loaded</p>
            </div>
          ) : bgImages.map(img => (
            <div key={img.id} className="p-2 bg-muted/15 rounded border border-border/10 space-y-1.5">
              <div className="flex items-center gap-2">
                <img src={img.url} alt={img.name} className="w-10 h-6 object-cover rounded" />
                <div className="flex-1 min-w-0">
                  <div className="text-[9px] text-foreground truncate">{img.name}</div>
                  <div className="text-[7px] text-muted-foreground uppercase">{img.position}</div>
                </div>
                <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setBgImages(prev => prev.filter(i => i.id !== img.id))}>
                  <Trash2 className="w-2.5 h-2.5" />
                </Button>
              </div>
              <SliderRow
                label="Opacity"
                value={img.opacity}
                onChange={v => setBgImages(prev => prev.map(i => i.id === img.id ? { ...i, opacity: v } : i))}
              />
            </div>
          ))}
        </Section>
      </ScrollArea>
    </div>
  );
}
