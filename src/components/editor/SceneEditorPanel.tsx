import { useState } from 'react';
import { Sun, Moon, Cloud, CloudRain, Wind, Eye, Thermometer, Droplets, Sparkles, Monitor, Paintbrush, TreePine, Grid3x3, RotateCw, Layers, Zap } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSceneStore, SCENE_PRESETS, type GroundStyle, type WeatherCondition } from '@/store/useSceneStore';
import { useProjectStore } from '@/store/useProjectStore';
import { cn } from '@/lib/utils';

type SectionId = 'quick' | 'presets' | 'sky' | 'ground' | 'weather' | 'effects' | 'lighting' | 'post';

function Section({ title, icon: Icon, children, id, open, onToggle }: { title: string; icon: any; children: React.ReactNode; id: SectionId; open: boolean; onToggle: () => void }) {
  return (
    <div className="border-b border-border/30">
      <button onClick={onToggle} className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-muted/20 transition-colors">
        <Icon className="h-3 w-3 text-muted-foreground" />
        <span className="text-[9px] font-semibold text-foreground uppercase tracking-wider flex-1 text-left">{title}</span>
        <span className="text-[8px] text-muted-foreground">{open ? '▼' : '▶'}</span>
      </button>
      {open && <div className="px-3 pb-2 space-y-2">{children}</div>}
    </div>
  );
}

function SliderRow({ label, value, onChange, min = 0, max = 1, step = 0.01, unit = '' }: {
  label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; unit?: string;
}) {
  return (
    <div>
      <div className="flex justify-between mb-0.5">
        <span className="text-[8px] text-muted-foreground">{label}</span>
        <span className="text-[8px] text-primary font-mono">{value.toFixed(step < 1 ? 2 : 0)}{unit}</span>
      </div>
      <Slider value={[value]} onValueChange={([v]) => onChange(v)} min={min} max={max} step={step} />
    </div>
  );
}

export default function SceneEditorPanel({ onClose }: { onClose: () => void }) {
  const { settings, updateSettings, applyPreset, resetToDefault } = useSceneStore();
  const { droneFormations, positions, showTrajectories, setShowTrajectories, showFormations, setShowFormations } = useProjectStore();
  const [openSections, setOpenSections] = useState<Set<SectionId>>(new Set(['quick', 'presets', 'sky']));

  const toggleSection = (id: SectionId) => {
    setOpenSections(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <div className="h-full flex flex-col bg-card border-l border-border">
      <div className="px-3 py-2 border-b border-border flex items-center gap-2">
        <Paintbrush className="h-3.5 w-3.5 text-muted-foreground" />
        <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider flex-1">Scene Editor</h2>
        <button onClick={resetToDefault} className="text-[8px] text-muted-foreground hover:text-foreground">Reset</button>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xs">✕</button>
      </div>

      <ScrollArea className="flex-1">
        {/* ═══ QUICK ACCESS ═══ */}
        <Section title="Quick Controls" icon={Zap} id="quick" open={openSections.has('quick')} onToggle={() => toggleSection('quick')}>
          <div className="space-y-2">
            {/* Visibility toggles */}
            <div className="space-y-1">
              <span className="text-[8px] text-muted-foreground font-semibold uppercase">Visibilidade</span>
              <div className="grid grid-cols-2 gap-1">
                <div className="flex items-center justify-between px-1.5 py-1 bg-surface-2 rounded-sm">
                  <span className="text-[8px] text-muted-foreground">Trajetórias</span>
                  <Switch checked={showTrajectories} onCheckedChange={setShowTrajectories} className="scale-[0.6]" />
                </div>
                <div className="flex items-center justify-between px-1.5 py-1 bg-surface-2 rounded-sm">
                  <span className="text-[8px] text-muted-foreground">Formações</span>
                  <Switch checked={showFormations} onCheckedChange={setShowFormations} className="scale-[0.6]" />
                </div>
                <div className="flex items-center justify-between px-1.5 py-1 bg-surface-2 rounded-sm">
                  <span className="text-[8px] text-muted-foreground">Grid</span>
                  <Switch checked={settings.showGrid} onCheckedChange={v => updateSettings({ showGrid: v })} className="scale-[0.6]" />
                </div>
                <div className="flex items-center justify-between px-1.5 py-1 bg-surface-2 rounded-sm">
                  <span className="text-[8px] text-muted-foreground">Árvores</span>
                  <Switch checked={settings.showTreeline} onCheckedChange={v => updateSettings({ showTreeline: v })} className="scale-[0.6]" />
                </div>
              </div>
            </div>

            {/* Scene stats */}
            <div className="bg-surface-2 rounded-sm p-1.5 text-[8px] font-mono text-muted-foreground space-y-0.5">
              <div className="flex justify-between">
                <span>Posições</span>
                <span className="text-foreground">{positions.length}</span>
              </div>
              <div className="flex justify-between">
                <span>Drones</span>
                <span className="text-primary">{positions.filter(p => p.type === 'drone-pad').length}</span>
              </div>
              <div className="flex justify-between">
                <span>Formações</span>
                <span className="text-foreground">{droneFormations.length}</span>
              </div>
              <div className="flex justify-between">
                <span>Duração</span>
                <span className="text-foreground">{droneFormations.reduce((s, f) => s + f.transitionDuration + f.holdDuration, 0).toFixed(0)}s</span>
              </div>
            </div>

            {/* Quick ambient controls */}
            <SliderRow label="Brightness" value={settings.ambientIntensity} onChange={v => updateSettings({ ambientIntensity: v })} max={0.5} />
            <SliderRow label="Fog" value={settings.fogDensity} onChange={v => updateSettings({ fogDensity: v })} />
          </div>
        </Section>

        {/* ═══ PRESETS ═══ */}
        <Section title="Scene Presets" icon={Monitor} id="presets" open={openSections.has('presets')} onToggle={() => toggleSection('presets')}>
          <div className="grid grid-cols-2 gap-1">
            {Object.entries(SCENE_PRESETS).map(([id, preset]) => (
              <button
                key={id}
                onClick={() => applyPreset(id)}
                className="text-left p-1.5 rounded border border-border/30 hover:border-primary/40 hover:bg-primary/5 transition-colors"
              >
                <div className="text-[9px] font-semibold">{preset.name}</div>
                <div className="text-[7px] text-muted-foreground leading-tight">{preset.description}</div>
              </button>
            ))}
          </div>
        </Section>

        {/* ═══ SKY & ATMOSPHERE ═══ */}
        <Section title="Sky & Atmosphere" icon={Moon} id="sky" open={openSections.has('sky')} onToggle={() => toggleSection('sky')}>
          <SliderRow label="Ambient Light" value={settings.ambientIntensity} onChange={v => updateSettings({ ambientIntensity: v })} max={0.5} />
          <SliderRow label="Moon Intensity" value={settings.moonIntensity} onChange={v => updateSettings({ moonIntensity: v })} max={2} />
          <div>
            <span className="text-[8px] text-muted-foreground">Moon Color</span>
            <input type="color" value={settings.moonColor} onChange={e => updateSettings({ moonColor: e.target.value })} className="w-full h-5 rounded border border-border/30 cursor-pointer" />
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
            <span className="text-[8px] text-muted-foreground">Ground Style</span>
            <Select value={settings.groundStyle} onValueChange={v => updateSettings({ groundStyle: v as GroundStyle })}>
              <SelectTrigger className="h-6 text-[9px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="finale-dark" className="text-[9px]">🌑 Finale Dark</SelectItem>
                <SelectItem value="google-earth" className="text-[9px]">🌍 Google Earth</SelectItem>
                <SelectItem value="flat-black" className="text-[9px]">⬛ Flat Black</SelectItem>
                <SelectItem value="concrete" className="text-[9px]">🏗️ Concrete</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <SliderRow label="Ground Brightness" value={settings.groundBrightness} onChange={v => updateSettings({ groundBrightness: v })} max={2} />
          <SliderRow label="Grid Opacity" value={settings.gridOpacity} onChange={v => updateSettings({ gridOpacity: v })} />
          <SliderRow label="Ground Fog" value={settings.groundFogIntensity} onChange={v => updateSettings({ groundFogIntensity: v })} />
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[8px] text-muted-foreground">Show Grid</span>
              <Switch checked={settings.showGrid} onCheckedChange={v => updateSettings({ showGrid: v })} className="scale-75" />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[8px] text-muted-foreground">Origin Marker</span>
              <Switch checked={settings.showOriginMarker} onCheckedChange={v => updateSettings({ showOriginMarker: v })} className="scale-75" />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[8px] text-muted-foreground">Scale Poles</span>
              <Switch checked={settings.showScalePoles} onCheckedChange={v => updateSettings({ showScalePoles: v })} className="scale-75" />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[8px] text-muted-foreground">Treeline</span>
              <Switch checked={settings.showTreeline} onCheckedChange={v => updateSettings({ showTreeline: v })} className="scale-75" />
            </div>
          </div>
        </Section>

        {/* ═══ WEATHER ═══ */}
        <Section title="Weather Conditions" icon={Cloud} id="weather" open={openSections.has('weather')} onToggle={() => toggleSection('weather')}>
          <div>
            <span className="text-[8px] text-muted-foreground">Condition</span>
            <Select value={settings.weather} onValueChange={v => updateSettings({ weather: v as WeatherCondition })}>
              <SelectTrigger className="h-6 text-[9px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="clear" className="text-[9px]">☀️ Clear</SelectItem>
                <SelectItem value="haze" className="text-[9px]">🌫️ Haze</SelectItem>
                <SelectItem value="fog" className="text-[9px]">🌁 Fog</SelectItem>
                <SelectItem value="light-rain" className="text-[9px]">🌧️ Light Rain</SelectItem>
                <SelectItem value="heavy-rain" className="text-[9px]">⛈️ Heavy Rain</SelectItem>
                <SelectItem value="snow" className="text-[9px]">❄️ Snow</SelectItem>
                <SelectItem value="wind-only" className="text-[9px]">💨 Wind Only</SelectItem>
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
          <SliderRow label="Effect Height Scale" value={settings.effectScale} onChange={v => updateSettings({ effectScale: v })} max={2} />
          <SliderRow label="Effect Brightness" value={settings.effectBrightness} onChange={v => updateSettings({ effectBrightness: v })} max={2} />
          <SliderRow label="Trail Length" value={settings.trailLength} onChange={v => updateSettings({ trailLength: v })} max={2} />
          <SliderRow label="Particle Density" value={settings.particleDensity} onChange={v => updateSettings({ particleDensity: v })} min={0.5} max={2} />
          <SliderRow label="Smoke Opacity" value={settings.smokeOpacity} onChange={v => updateSettings({ smokeOpacity: v })} />
          <SliderRow label="Bloom Strength" value={settings.bloomStrength} onChange={v => updateSettings({ bloomStrength: v })} max={2} />
        </Section>

        {/* ═══ LIGHTING ═══ */}
        <Section title="Lighting" icon={Sun} id="lighting" open={openSections.has('lighting')} onToggle={() => toggleSection('lighting')}>
          <div className="flex items-center justify-between">
            <span className="text-[8px] text-muted-foreground">Shadows</span>
            <Switch checked={settings.shadowsEnabled} onCheckedChange={v => updateSettings({ shadowsEnabled: v })} className="scale-75" />
          </div>
          <div>
            <span className="text-[8px] text-muted-foreground">Shadow Quality</span>
            <Select value={settings.shadowQuality} onValueChange={v => updateSettings({ shadowQuality: v as any })}>
              <SelectTrigger className="h-6 text-[9px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="low" className="text-[9px]">Low (1024)</SelectItem>
                <SelectItem value="medium" className="text-[9px]">Medium (2048)</SelectItem>
                <SelectItem value="high" className="text-[9px]">High (4096)</SelectItem>
                <SelectItem value="ultra" className="text-[9px]">Ultra (8192)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <SliderRow label="Rim Light" value={settings.rimLightIntensity} onChange={v => updateSettings({ rimLightIntensity: v })} />
          <SliderRow label="Fill Light" value={settings.fillLightIntensity} onChange={v => updateSettings({ fillLightIntensity: v })} />
        </Section>

        {/* ═══ POST-PROCESSING ═══ */}
        <Section title="Post-Processing" icon={Eye} id="post" open={openSections.has('post')} onToggle={() => toggleSection('post')}>
          <div className="flex items-center justify-between">
            <span className="text-[8px] text-muted-foreground">Vignette</span>
            <Switch checked={settings.vignetteEnabled} onCheckedChange={v => updateSettings({ vignetteEnabled: v })} className="scale-75" />
          </div>
          {settings.vignetteEnabled && (
            <SliderRow label="Vignette Intensity" value={settings.vignetteIntensity} onChange={v => updateSettings({ vignetteIntensity: v })} />
          )}
          <div className="flex items-center justify-between">
            <span className="text-[8px] text-muted-foreground">Chromatic Aberration</span>
            <Switch checked={settings.chromaticAberration} onCheckedChange={v => updateSettings({ chromaticAberration: v })} className="scale-75" />
          </div>
          <SliderRow label="Film Grain" value={settings.filmGrain} onChange={v => updateSettings({ filmGrain: v })} />
        </Section>
      </ScrollArea>
    </div>
  );
}
