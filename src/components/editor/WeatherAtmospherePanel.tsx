import { useState } from 'react';
import { Sun, Moon, Cloud, CloudRain, Wind, Droplets, Thermometer, Eye, X, Clock, Waves, Zap, Sparkles, CloudFog, Snowflake } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSceneStore, type WeatherCondition } from '@/store/useSceneStore';
import { evaluateTimeOfDay, TOD_PRESETS } from '@/render_ultra/environment/timeOfDay';
import { cn } from '@/lib/utils';

type SectionId = 'tod' | 'sky-engine' | 'clouds' | 'weather' | 'water' | 'fluids';

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

const PHASE_LABELS: Record<string, { emoji: string; label: string }> = {
  'night': { emoji: '🌑', label: 'Night' },
  'dawn': { emoji: '🌅', label: 'Dawn' },
  'golden-hour': { emoji: '🌄', label: 'Golden Hour' },
  'day': { emoji: '☀️', label: 'Day' },
  'sunset': { emoji: '🌇', label: 'Sunset' },
  'twilight': { emoji: '🌆', label: 'Twilight' },
  'blue-hour': { emoji: '🔵', label: 'Blue Hour' },
};

const TOD_QUICK_PRESETS = [
  { label: '🎆 Firework Show', hour: 21.5 },
  { label: '🌇 Sunset', hour: 18 },
  { label: '🌄 Golden Hour', hour: 6.5 },
  { label: '☀️ Noon', hour: 12 },
  { label: '🌑 Midnight', hour: 0 },
];

const CLOUD_QUICK_PRESETS = [
  { label: 'Clear', coverage: 0.1, density: 0.5 },
  { label: 'Scattered', coverage: 0.35, density: 0.8 },
  { label: 'Overcast', coverage: 0.75, density: 1.5 },
  { label: 'Dramatic', coverage: 0.55, density: 1.2 },
  { label: 'Stormy', coverage: 0.85, density: 1.8 },
];

export default function WeatherAtmospherePanel({ onClose }: { onClose: () => void }) {
  const { settings, updateSettings } = useSceneStore();
  const [openSections, setOpenSections] = useState<Set<SectionId>>(new Set(['tod', 'clouds']));

  const toggleSection = (id: SectionId) => {
    setOpenSections(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const todState = evaluateTimeOfDay(settings.timeOfDay);
  const phase = PHASE_LABELS[todState.phase] || PHASE_LABELS.night;

  const formatHour = (h: number) => {
    const hrs = Math.floor(h);
    const mins = Math.round((h - hrs) * 60);
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  };

  return (
    <div className="h-full flex flex-col bg-card/95 backdrop-blur-sm border-l border-border/50">
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-border/30 flex items-center gap-2 bg-card">
        <div className="w-6 h-6 rounded-md bg-primary/15 flex items-center justify-center">
          <Cloud className="h-3.5 w-3.5 text-primary" />
        </div>
        <div className="flex-1">
          <h2 className="text-[11px] font-bold text-foreground uppercase tracking-widest">Weather & Atmosphere</h2>
          <p className="text-[8px] text-muted-foreground">Environment v2 · UE5.7</p>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground w-5 h-5 flex items-center justify-center rounded hover:bg-muted/30">
          <X className="w-3 h-3" />
        </button>
      </div>

      <ScrollArea className="flex-1">
        {/* ═══ TIME OF DAY ═══ */}
        <Section title="Time of Day" icon={Clock} id="tod" open={openSections.has('tod')} onToggle={() => toggleSection('tod')}>
          <div className="flex items-center justify-between">
            <span className="text-[9px] text-muted-foreground font-medium">Enable Time-of-Day</span>
            <Switch checked={settings.timeOfDayEnabled} onCheckedChange={v => updateSettings({ timeOfDayEnabled: v })} className="scale-[0.65]" />
          </div>

          {/* Time slider */}
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-[9px] text-muted-foreground font-medium">Hour</span>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px]">{phase.emoji}</span>
                <span className="text-[9px] text-primary font-mono tabular-nums">{formatHour(settings.timeOfDay)}</span>
                <span className="text-[8px] text-muted-foreground">{phase.label}</span>
              </div>
            </div>
            <Slider
              value={[settings.timeOfDay]}
              onValueChange={([v]) => updateSettings({ timeOfDay: v })}
              min={0} max={24} step={0.1}
              className="py-0.5"
            />
            {/* Visual time bar */}
            <div className="h-1.5 rounded-full mt-1 overflow-hidden flex">
              <div className="flex-1 bg-gradient-to-r from-[hsl(var(--muted))] via-[hsl(var(--primary)/0.3)] via-25% via-[hsl(40,100%,50%/0.4)] via-30% via-[hsl(200,80%,70%/0.3)] via-50% via-[hsl(20,90%,50%/0.4)] via-75% to-[hsl(var(--muted))]" />
            </div>
          </div>

          {/* Quick presets */}
          <div className="flex flex-wrap gap-1 mt-1">
            {TOD_QUICK_PRESETS.map(p => (
              <button
                key={p.label}
                onClick={() => updateSettings({ timeOfDay: p.hour, timeOfDayEnabled: true })}
                className={cn(
                  "px-2 py-1 rounded text-[8px] border transition-all",
                  Math.abs(settings.timeOfDay - p.hour) < 0.5 && settings.timeOfDayEnabled
                    ? "bg-primary/15 border-primary/40 text-primary font-bold"
                    : "bg-muted/20 border-border/20 text-muted-foreground hover:border-primary/30 hover:text-foreground"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* ToD info panel */}
          {settings.timeOfDayEnabled && (
            <div className="bg-muted/15 rounded border border-border/10 p-2 space-y-1 mt-1">
              <span className="text-[8px] text-muted-foreground font-bold uppercase tracking-wider">Current State</span>
              {[
                { label: 'Sun Intensity', value: todState.sunIntensity.toFixed(2) },
                { label: 'Ambient', value: todState.ambientIntensity.toFixed(3) },
                { label: 'Stars', value: todState.starBrightness.toFixed(1) },
                { label: 'Fog Density', value: todState.fogDensity.toFixed(2) },
                { label: 'Shadow', value: todState.shadowIntensity.toFixed(2) },
                { label: 'Exposure', value: `${todState.exposureBias.toFixed(1)} EV` },
              ].map(s => (
                <div key={s.label} className="flex justify-between text-[9px] font-mono">
                  <span className="text-muted-foreground">{s.label}</span>
                  <span className="text-foreground">{s.value}</span>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* ═══ SKY ENGINE ═══ */}
        <Section title="Sky Engine" icon={Sparkles} id="sky-engine" open={openSections.has('sky-engine')} onToggle={() => toggleSection('sky-engine')}>
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[9px] text-foreground font-medium">Sky Atmosphere V2</span>
              <p className="text-[7px] text-muted-foreground">Rayleigh + Mie scattering</p>
            </div>
            <Switch checked={settings.skyEngineV2} onCheckedChange={v => updateSettings({ skyEngineV2: v })} className="scale-[0.65]" />
          </div>
          {settings.skyEngineV2 && (
            <div className="bg-muted/10 rounded border border-border/10 p-2 mt-1">
              <div className="flex items-center gap-1.5 mb-2">
                <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                <span className="text-[7px] text-green-400 font-bold uppercase tracking-wider">V2 Active</span>
              </div>
              <p className="text-[8px] text-muted-foreground">Physically-based sky with sun/moon disc, stars, multi-scatter approximation. Driven by Time-of-Day when enabled.</p>
            </div>
          )}
        </Section>

        {/* ═══ CLOUDS ═══ */}
        <Section title="Volumetric Clouds" icon={Cloud} id="clouds" open={openSections.has('clouds')} onToggle={() => toggleSection('clouds')}>
          <SliderRow label="Coverage" value={settings.cloudCoverage} onChange={v => updateSettings({ cloudCoverage: v })} />
          <SliderRow label="Density" value={settings.cloudDensity} onChange={v => updateSettings({ cloudDensity: v })} max={2} step={0.05} />
          <SliderRow label="Wind Speed" value={settings.cloudWindSpeed} onChange={v => updateSettings({ cloudWindSpeed: v })} max={20} step={0.5} unit=" m/s" />

          <div className="flex flex-wrap gap-1 mt-1">
            {CLOUD_QUICK_PRESETS.map(p => (
              <button
                key={p.label}
                onClick={() => updateSettings({ cloudCoverage: p.coverage, cloudDensity: p.density })}
                className={cn(
                  "px-2 py-1 rounded text-[8px] border transition-all",
                  Math.abs(settings.cloudCoverage - p.coverage) < 0.05
                    ? "bg-primary/15 border-primary/40 text-primary font-bold"
                    : "bg-muted/20 border-border/20 text-muted-foreground hover:border-primary/30 hover:text-foreground"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        </Section>

        {/* ═══ WEATHER ═══ */}
        <Section title="Weather" icon={CloudRain} id="weather" open={openSections.has('weather')} onToggle={() => toggleSection('weather')}>
          <div>
            <span className="text-[9px] text-muted-foreground font-medium">Condition</span>
            <Select value={settings.weather} onValueChange={v => updateSettings({ weather: v as WeatherCondition })}>
              <SelectTrigger className="h-7 text-[10px] mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="clear" className="text-[10px]">☀️ Clear</SelectItem>
                <SelectItem value="haze" className="text-[10px]">🌫️ Haze</SelectItem>
                <SelectItem value="fog" className="text-[10px]">🌁 Fog</SelectItem>
                <SelectItem value="light-rain" className="text-[10px]">🌦️ Light Rain</SelectItem>
                <SelectItem value="heavy-rain" className="text-[10px]">🌧️ Heavy Rain</SelectItem>
                <SelectItem value="snow" className="text-[10px]">❄️ Snow</SelectItem>
                <SelectItem value="wind-only" className="text-[10px]">💨 Wind Only</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <SliderRow label="Rain Intensity" value={settings.rainIntensity} onChange={v => updateSettings({ rainIntensity: v })} />
          <SliderRow label="Wind Effect" value={settings.windEffect} onChange={v => updateSettings({ windEffect: v })} />
          <SliderRow label="Humidity" value={settings.humidity} onChange={v => updateSettings({ humidity: v })} />
          <SliderRow label="Temperature" value={settings.temperature} onChange={v => updateSettings({ temperature: v })} min={-10} max={45} step={1} unit="°C" />
          <SliderRow label="Visibility" value={settings.visibility} onChange={v => updateSettings({ visibility: v })} />
        </Section>

        {/* ═══ WATER ═══ */}
        <Section title="Water" icon={Waves} id="water" open={openSections.has('water')} onToggle={() => toggleSection('water')}>
          <div className="flex items-center justify-between">
            <span className="text-[9px] text-muted-foreground font-medium">Enable Water</span>
            <Switch checked={settings.waterEnabled} onCheckedChange={v => updateSettings({ waterEnabled: v })} className="scale-[0.65]" />
          </div>
          {settings.waterEnabled && (
            <>
              <SliderRow label="Water Level" value={settings.waterLevel} onChange={v => updateSettings({ waterLevel: v })} min={-5} max={5} step={0.1} unit=" m" />
              <div>
                <span className="text-[9px] text-muted-foreground font-medium">Preset</span>
                <Select value={settings.waterPreset} onValueChange={v => updateSettings({ waterPreset: v as any })}>
                  <SelectTrigger className="h-7 text-[10px] mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lake" className="text-[10px]">🏞️ Lake</SelectItem>
                    <SelectItem value="river" className="text-[10px]">🏞️ River</SelectItem>
                    <SelectItem value="ocean" className="text-[10px]">🌊 Ocean</SelectItem>
                    <SelectItem value="puddle" className="text-[10px]">💧 Puddle</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
        </Section>

        {/* ═══ NIAGARA FLUIDS ═══ */}
        <Section title="Niagara Fluids" icon={Zap} id="fluids" open={openSections.has('fluids')} onToggle={() => toggleSection('fluids')}>
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[9px] text-foreground font-medium">GPU Fluid Advection</span>
              <p className="text-[7px] text-muted-foreground">Smoke drift reacts to wind & explosions</p>
            </div>
            <Switch checked={settings.niagaraFluidsEnabled} onCheckedChange={v => updateSettings({ niagaraFluidsEnabled: v })} className="scale-[0.65]" />
          </div>
          {settings.niagaraFluidsEnabled && (
            <div className="bg-muted/10 rounded border border-border/10 p-2 space-y-1">
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                <span className="text-[7px] text-green-400 font-bold uppercase tracking-wider">Fluid Sim Active</span>
              </div>
              <p className="text-[8px] text-muted-foreground">64×64 velocity grid • density advection • buoyancy • pressure projection</p>
            </div>
          )}

          {/* Decals toggle */}
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/20">
            <span className="text-[9px] text-muted-foreground font-medium">Ground Decals</span>
            <Switch checked={settings.decalsEnabled} onCheckedChange={v => updateSettings({ decalsEnabled: v })} className="scale-[0.65]" />
          </div>
        </Section>
      </ScrollArea>
    </div>
  );
}
