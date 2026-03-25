import { useState, useCallback, useEffect } from 'react';
import { unrealBridge } from '@/core/sync/unrealBridge';
import { useProjectStore } from '@/store/useProjectStore';
import { useSceneStore } from '@/store/useSceneStore';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X, Cog, MapPin, Clock, Users, Radio, Shield, Save, Globe, Thermometer, Wind, ChevronDown, ChevronRight, Zap, Cpu, Navigation, FileText, Hash, Calendar, Building, Eye, EyeOff, Lock, Ruler, RotateCcw, Palette, Trash2, Star, Map } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface ShowSettingsProps {
  onClose: () => void;
}

/* ── Apple-style section card ─────────────────────────────── */
function SettingsSection({ title, icon: Icon, children, defaultOpen = true }: {
  title: string; icon: React.ElementType; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl border border-border/12 overflow-hidden" style={{ background: 'hsl(var(--card))' }}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2.5 px-4 py-3 text-left transition-colors hover:bg-surface-1/30"
      >
        <div className="w-7 h-7 rounded-xl flex items-center justify-center" style={{ background: 'hsl(var(--primary) / 0.1)' }}>
          <Icon className="w-3.5 h-3.5 text-primary" />
        </div>
        <span className="text-[12px] font-bold text-foreground tracking-wide uppercase font-display flex-1">{title}</span>
        {open ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground/40" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40" />}
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-border/8 pt-3">
          {children}
        </div>
      )}
    </div>
  );
}

/* ── Form field ───────────────────────────────────────────── */
function Field({ label, value, onChange, placeholder, type = 'text', mono = false, disabled = false, suffix }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; mono?: boolean; disabled?: boolean; suffix?: string;
}) {
  return (
    <div>
      <label className="text-[10px] text-muted-foreground/70 font-semibold uppercase tracking-wider mb-1 block font-display">{label}</label>
      <div className="relative">
        <Input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            "h-9 text-[12px] bg-surface-0/60 border-border/15 rounded-xl focus:border-primary/30 focus:ring-1 focus:ring-primary/10 transition-all",
            mono && "font-mono-code",
            disabled && "opacity-50"
          )}
        />
        {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground/40 font-mono-code">{suffix}</span>}
      </div>
    </div>
  );
}

/* ── Info row (read-only) ─────────────────────────────────── */
function InfoRow({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-[10px] text-muted-foreground/60 font-medium">{label}</span>
      <span className={cn("text-[11px] font-mono-code font-semibold tabular-nums", accent ? "text-primary" : "text-foreground/80")}>{value}</span>
    </div>
  );
}
/* ── Environment Settings — ShowSim / Finale 3D style ────── */
function EnvironmentSettingsSection() {
  const { environment, updateEnvironment } = useSceneStore();

  return (
    <SettingsSection title="Environment" icon={Eye} defaultOpen={false}>
      {/* Sky Rotation */}
      <div>
        <label className="text-[10px] text-muted-foreground/70 font-semibold uppercase tracking-wider mb-1.5 block font-display flex items-center gap-1.5">
          <RotateCcw className="w-3 h-3" /> Sky Rotation
        </label>
        <div className="flex items-center gap-3">
          <Slider
            value={[environment.skyRotation]}
            onValueChange={([v]) => updateEnvironment({ skyRotation: v })}
            min={0} max={360} step={1}
            className="flex-1"
          />
          <span className="text-[10px] font-mono-code text-muted-foreground w-10 text-right">{environment.skyRotation}°</span>
        </div>
      </div>

      {/* Smoke Intensity */}
      <div>
        <label className="text-[10px] text-muted-foreground/70 font-semibold uppercase tracking-wider mb-1.5 block font-display">Smoke Intensity</label>
        <div className="flex items-center gap-3">
          <Slider
            value={[environment.smokeIntensity * 100]}
            onValueChange={([v]) => updateEnvironment({ smokeIntensity: v / 100 })}
            min={0} max={100} step={1}
            className="flex-1"
          />
          <span className="text-[10px] font-mono-code text-muted-foreground w-10 text-right">{Math.round(environment.smokeIntensity * 100)}%</span>
        </div>
      </div>

      {/* Ground Color Override */}
      <div>
        <label className="text-[10px] text-muted-foreground/70 font-semibold uppercase tracking-wider mb-1.5 block font-display flex items-center gap-1.5">
          <Palette className="w-3 h-3" /> Ground Color Override
        </label>
        <div className="flex items-center gap-2">
          <Switch
            checked={environment.groundColorOverride !== null}
            onCheckedChange={(on) => updateEnvironment({ groundColorOverride: on ? '#1a1a2e' : null })}
          />
          {environment.groundColorOverride !== null && (
            <input
              type="color"
              value={environment.groundColorOverride}
              onChange={e => updateEnvironment({ groundColorOverride: e.target.value })}
              className="w-8 h-8 rounded-lg border border-border/20 cursor-pointer bg-transparent"
            />
          )}
          <span className="text-[10px] text-muted-foreground font-mono-code">{environment.groundColorOverride || 'Auto'}</span>
        </div>
      </div>

      {/* Toggle switches */}
      <div className="space-y-2.5 pt-1 border-t border-border/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lock className="w-3 h-3 text-warning/60" />
            <span className="text-[11px] font-semibold text-foreground">Lock Positions</span>
          </div>
          <Switch checked={environment.lockPositions} onCheckedChange={(v) => updateEnvironment({ lockPositions: v })} />
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Ruler className="w-3 h-3 text-primary/60" />
            <span className="text-[11px] font-semibold text-foreground">Show Rulers</span>
          </div>
          <Switch checked={environment.showRulers} onCheckedChange={(v) => updateEnvironment({ showRulers: v })} />
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <EyeOff className="w-3 h-3 text-muted-foreground/60" />
            <span className="text-[11px] font-semibold text-foreground">Disable Smoke</span>
          </div>
          <Switch checked={environment.disableSmoke} onCheckedChange={(v) => updateEnvironment({ disableSmoke: v })} />
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <EyeOff className="w-3 h-3 text-muted-foreground/60" />
            <span className="text-[11px] font-semibold text-foreground">Disable Lighting</span>
          </div>
          <Switch checked={environment.disableLighting} onCheckedChange={(v) => updateEnvironment({ disableLighting: v })} />
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-3 h-3 text-accent/60" />
            <span className="text-[11px] font-semibold text-foreground">Low Quality Mode</span>
          </div>
          <Switch checked={environment.lowQualityMode} onCheckedChange={(v) => updateEnvironment({ lowQualityMode: v })} />
        </div>
      </div>

      {environment.lowQualityMode && (
        <div className="bg-warning/10 border border-warning/20 rounded-xl px-3 py-2 text-[10px] text-warning font-medium">
          ⚡ Low quality: particles -50%, smoke off, trails shorter
        </div>
      )}
    </SettingsSection>
  );
}

/* ── Unreal Engine Bridge Section ────────────────────────── */
function UnrealBridgeSection() {
  const [endpoint, setEndpoint] = useState('ws://localhost:8765');
  const [connected, setConnected] = useState(false);

  const toggleConnection = useCallback(() => {
    if (connected) {
      unrealBridge.disconnect();
      setConnected(false);
    } else {
      unrealBridge.connect(endpoint);
      setConnected(true);
    }
  }, [connected, endpoint]);

  const state = unrealBridge.getState();

  return (
    <SettingsSection title="Unreal Engine Bridge" icon={Cpu} defaultOpen={false}>
      <Field label="Endpoint" value={endpoint} onChange={setEndpoint} placeholder="ws://localhost:8765" mono />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={cn("w-2 h-2 rounded-full", connected ? "bg-green-500" : "bg-muted-foreground/30")} />
          <span className="text-[10px] text-foreground font-medium">
            {connected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
        <Button variant="outline" size="sm" className="h-6 text-[9px]" onClick={toggleConnection}>
          {connected ? 'Disconnect' : 'Connect'}
        </Button>
      </div>
      {connected && (
        <div className="space-y-0.5 text-[8px] font-mono text-muted-foreground/50">
          <div>Frames sent: {state.framesSent}</div>
          <div>Latency: {state.latencyMs.toFixed(0)}ms</div>
          <div>Buffered: {state.bufferedFrames}</div>
        </div>
      )}
    </SettingsSection>
  );
}

export default function ShowSettingsPanel({ onClose }: ShowSettingsProps) {
  const { duration, gpsOrigin, projectName } = useProjectStore();

  // ── Show metadata ──
  const [showName, setShowName] = useState(projectName || 'Untitled Show');
  const [client, setClient] = useState('');
  const [venue, setVenue] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');
  const [showDate, setShowDate] = useState('');
  const [showTime, setShowTime] = useState('21:00');
  const [timezone, setTimezone] = useState('America/Sao_Paulo');
  const [director, setDirector] = useState('');
  const [safetyOfficer, setSafetyOfficer] = useState('');
  const [permitNumber, setPermitNumber] = useState('');
  const [insurancePolicy, setInsurancePolicy] = useState('');
  const [notes, setNotes] = useState('');

  // ── Finale 3D / Skybrush config ──
  const [nfpaCategory, setNfpaCategory] = useState<'1.4G' | '1.3G' | '1.1G'>('1.3G');
  const [safetyDistance, setSafetyDistance] = useState('100');
  const [falloutRadius, setFalloutRadius] = useState('150');
  const [maxAltitude, setMaxAltitude] = useState('120');
  const [firingSystem, setFiringSystem] = useState('Cobra 18R2');
  const [moduleCount, setModuleCount] = useState('4');
  const [channelsPerModule, setChannelsPerModule] = useState('18');

  // ── Skybrush drone config ──
  const [skybrushEnabled, setSkybrushEnabled] = useState(false);
  const [droneFleetSize, setDroneFleetSize] = useState('100');
  const [skybrushServer, setSkybrushServer] = useState('localhost:5000');
  const [flockwaveVersion, setFlockwaveVersion] = useState('1.0');
  const [startMethod, setStartMethod] = useState<'rc' | 'auto' | 'smpte'>('auto');
  const [geoFenceRadius, setGeoFenceRadius] = useState('200');
  const [maxWindSpeed, setMaxWindSpeed] = useState('8');
  const [ledFrameRate, setLedFrameRate] = useState('20');

  // ── Weather conditions ──
  const [weatherCondition, setWeatherCondition] = useState<'clear' | 'cloudy' | 'windy' | 'rain'>('clear');
  const [temperature, setTemperature] = useState('22');
  const [humidity, setHumidity] = useState('65');
  const [windSpeed, setWindSpeed] = useState('5');
  const [windDirection, setWindDirection] = useState('NE');

  const handleSave = useCallback(() => {
    toast.success('Show settings saved');
  }, []);

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const totalChannels = parseInt(moduleCount || '0') * parseInt(channelsPerModule || '0');

  return (
    <div className="h-full flex flex-col" style={{ background: 'hsl(var(--background))' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/10" style={{ background: 'hsl(var(--card))' }}>
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, hsl(var(--primary) / 0.15), hsl(var(--accent) / 0.1))' }}>
            <Cog className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h2 className="text-[12px] font-bold text-foreground uppercase tracking-[0.12em] font-display leading-none">Show Settings</h2>
            <p className="text-[9px] text-muted-foreground/40 mt-0.5 font-mono-code">Configuration & metadata</p>
          </div>
        </div>
        <button onClick={onClose} className="w-6 h-6 rounded-lg flex items-center justify-center text-muted-foreground/40 hover:text-foreground hover:bg-surface-1/60 transition-all">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-2.5">

          {/* ── General Information ──────────────────────────── */}
          <SettingsSection title="General" icon={Radio}>
            <Field label="Show Name" value={showName} onChange={setShowName} placeholder="Grand Finale 2026" />
            <div className="grid grid-cols-2 gap-2.5">
              <Field label="Client" value={client} onChange={setClient} placeholder="Acme Events" />
              <Field label="Director" value={director} onChange={setDirector} placeholder="John Smith" />
            </div>
            {/* Editable Duration */}
            <div>
              <label className="text-[10px] text-muted-foreground/70 font-semibold uppercase tracking-wider mb-1.5 block font-display flex items-center gap-1.5">
                <Clock className="w-3 h-3" /> Duration
              </label>
              <div className="flex items-center gap-2 mb-2">
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    min={0}
                    max={10}
                    value={Math.floor(duration / 60)}
                    onChange={e => {
                      const mins = Math.max(0, parseInt(e.target.value) || 0);
                      const secs = Math.floor(duration % 60);
                      useProjectStore.getState().setDuration(mins * 60 + secs);
                    }}
                    className="w-14 h-8 text-[12px] text-center font-mono-code bg-surface-0/60 border-border/15 rounded-lg"
                  />
                  <span className="text-[10px] text-muted-foreground/50 font-mono-code">min</span>
                </div>
                <span className="text-foreground/30 font-bold">:</span>
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    min={0}
                    max={59}
                    value={Math.floor(duration % 60)}
                    onChange={e => {
                      const mins = Math.floor(duration / 60);
                      const secs = Math.min(59, Math.max(0, parseInt(e.target.value) || 0));
                      useProjectStore.getState().setDuration(mins * 60 + secs);
                    }}
                    className="w-14 h-8 text-[12px] text-center font-mono-code bg-surface-0/60 border-border/15 rounded-lg"
                  />
                  <span className="text-[10px] text-muted-foreground/50 font-mono-code">sec</span>
                </div>
                <Badge variant="outline" className="ml-auto text-[9px] font-mono-code text-primary border-primary/20">
                  {formatDuration(duration)}
                </Badge>
              </div>
              <Slider
                value={[duration]}
                onValueChange={([v]) => useProjectStore.getState().setDuration(v)}
                min={0}
                max={600}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between mt-1">
                <span className="text-[8px] text-muted-foreground/30 font-mono-code">0:00</span>
                <span className="text-[8px] text-muted-foreground/30 font-mono-code">10:00</span>
              </div>
            </div>
            <InfoRow label="Project" value={projectName} />
          </SettingsSection>

          {/* ── Location ────────────────────────────────────── */}
          <SettingsSection title="Location" icon={MapPin}>
            <Field label="Venue / Site" value={venue} onChange={setVenue} placeholder="Central Park Main Field" />
            <div className="grid grid-cols-2 gap-2.5">
              <Field label="City" value={city} onChange={setCity} placeholder="New York" />
              <Field label="Country" value={country} onChange={setCountry} placeholder="USA" />
            </div>
            <div className="rounded-xl bg-surface-0/50 p-3 border border-border/10">
              <div className="flex items-center gap-1.5 mb-2">
                <Globe className="w-3 h-3 text-primary/50" />
                <span className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-wider font-display">GPS Origin</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <InfoRow label="Latitude" value={gpsOrigin.lat.toFixed(6) + '°'} accent />
                <InfoRow label="Longitude" value={gpsOrigin.lng.toFixed(6) + '°'} accent />
              </div>
              <InfoRow label="Altitude" value={`${(gpsOrigin.altitude || 0).toFixed(1)} m`} />
            </div>
          </SettingsSection>

          {/* ── Digital Twin — Radius & Saved Locations ──────── */}
          <DigitalTwinSection />

          {/* ── Schedule ────────────────────────────────────── */}
          <SettingsSection title="Schedule" icon={Calendar}>
            <div className="grid grid-cols-2 gap-2.5">
              <Field label="Show Date" value={showDate} onChange={setShowDate} placeholder="2026-07-04" type="date" />
              <Field label="Start Time" value={showTime} onChange={setShowTime} placeholder="21:00" type="time" />
            </div>
            <Field label="Timezone" value={timezone} onChange={setTimezone} placeholder="America/Sao_Paulo" />
          </SettingsSection>

          {/* ── Weather Conditions ───────────────────────────── */}
          <SettingsSection title="Weather" icon={Thermometer} defaultOpen={false}>
            <div className="flex gap-1 p-0.5 rounded-xl bg-surface-0/50">
              {(['clear', 'cloudy', 'windy', 'rain'] as const).map(c => (
                <button
                  key={c}
                  onClick={() => setWeatherCondition(c)}
                  className={cn(
                    "flex-1 py-2 rounded-lg text-[10px] font-semibold uppercase transition-all",
                    weatherCondition === c
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground/40 hover:text-muted-foreground/70"
                  )}
                >
                  {c === 'clear' ? '☀️' : c === 'cloudy' ? '☁️' : c === 'windy' ? '💨' : '🌧️'} {c}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <Field label="Temperature" value={temperature} onChange={setTemperature} suffix="°C" />
              <Field label="Humidity" value={humidity} onChange={setHumidity} suffix="%" />
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <Field label="Wind Speed" value={windSpeed} onChange={setWindSpeed} suffix="m/s" />
              <Field label="Wind Dir" value={windDirection} onChange={setWindDirection} placeholder="NE" />
            </div>
          </SettingsSection>

          {/* ── Pyro / Finale 3D Config ──────────────────────── */}
          <SettingsSection title="Pyro System" icon={Zap}>
            {/* NFPA Category */}
            <div>
              <label className="text-[10px] text-muted-foreground/70 font-semibold uppercase tracking-wider mb-1 block font-display">NFPA Category</label>
              <div className="flex gap-1 p-0.5 rounded-xl bg-surface-0/50">
                {(['1.4G', '1.3G', '1.1G'] as const).map(cat => (
                  <button
                    key={cat}
                    onClick={() => setNfpaCategory(cat)}
                    className={cn(
                      "flex-1 py-2 rounded-lg text-[11px] font-bold transition-all font-mono-code",
                      nfpaCategory === cat
                        ? "bg-card text-accent shadow-sm"
                        : "text-muted-foreground/40 hover:text-muted-foreground/70"
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <Field label="Safety Distance" value={safetyDistance} onChange={setSafetyDistance} suffix="m" mono />
              <Field label="Fallout Radius" value={falloutRadius} onChange={setFalloutRadius} suffix="m" mono />
            </div>
            <Field label="Max Altitude" value={maxAltitude} onChange={setMaxAltitude} suffix="m AGL" mono />

            <div className="border-t border-border/8 pt-3 mt-1">
              <div className="flex items-center gap-1.5 mb-2">
                <Cpu className="w-3 h-3 text-accent/50" />
                <span className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-wider font-display">Firing System</span>
              </div>
              <Field label="System" value={firingSystem} onChange={setFiringSystem} placeholder="Cobra 18R2" />
              <div className="grid grid-cols-2 gap-2.5 mt-2.5">
                <Field label="Modules" value={moduleCount} onChange={setModuleCount} mono />
                <Field label="Ch / Module" value={channelsPerModule} onChange={setChannelsPerModule} mono />
              </div>
              <InfoRow label="Total Channels" value={totalChannels.toString()} accent />
            </div>
          </SettingsSection>

          {/* ── Skybrush / Drone Config ──────────────────────── */}
          <SettingsSection title="Skybrush Live" icon={Navigation} defaultOpen={false}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: skybrushEnabled ? 'hsl(var(--success))' : 'hsl(var(--muted-foreground) / 0.3)' }} />
                <span className="text-[11px] font-semibold text-foreground">Enable Skybrush</span>
              </div>
              <Switch checked={skybrushEnabled} onCheckedChange={setSkybrushEnabled} />
            </div>

            {skybrushEnabled && (
              <div className="space-y-3 pt-1">
                <div className="grid grid-cols-2 gap-2.5">
                  <Field label="Fleet Size" value={droneFleetSize} onChange={setDroneFleetSize} mono />
                  <Field label="Flockwave Ver" value={flockwaveVersion} onChange={setFlockwaveVersion} mono disabled />
                </div>
                <Field label="Server" value={skybrushServer} onChange={setSkybrushServer} mono placeholder="localhost:5000" />

                {/* Start method */}
                <div>
                  <label className="text-[10px] text-muted-foreground/70 font-semibold uppercase tracking-wider mb-1 block font-display">Start Method</label>
                  <div className="flex gap-1 p-0.5 rounded-xl bg-surface-0/50">
                    {([
                      { id: 'rc' as const, label: 'RC', desc: 'Manual' },
                      { id: 'auto' as const, label: 'AUTO', desc: 'Scheduled' },
                      { id: 'smpte' as const, label: 'SMPTE', desc: 'Timecode' },
                    ]).map(m => (
                      <button
                        key={m.id}
                        onClick={() => setStartMethod(m.id)}
                        className={cn(
                          "flex-1 py-2 rounded-lg text-center transition-all",
                          startMethod === m.id
                            ? "bg-card text-foreground shadow-sm"
                            : "text-muted-foreground/40 hover:text-muted-foreground/70"
                        )}
                      >
                        <div className="text-[10px] font-bold font-mono-code">{m.label}</div>
                        <div className="text-[8px] text-muted-foreground/40">{m.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <Field label="Geofence Radius" value={geoFenceRadius} onChange={setGeoFenceRadius} suffix="m" mono />
                  <Field label="Max Wind" value={maxWindSpeed} onChange={setMaxWindSpeed} suffix="m/s" mono />
                </div>
                <Field label="LED Frame Rate" value={ledFrameRate} onChange={setLedFrameRate} suffix="fps" mono />

                {/* Protocol info */}
                <div className="rounded-xl bg-surface-0/40 p-3 border border-border/8 space-y-1">
                  <InfoRow label="Protocol" value="Flockwave JSON-RPC" />
                  <InfoRow label="Envelope" value="$fw.version: 1.0" />
                  <InfoRow label="Telemetry Rate" value="10 Hz" />
                  <InfoRow label="Clock Sync" value="NTP + SMPTE" />
                </div>
              </div>
            )}
          </SettingsSection>

          {/* ── Safety & Permits ─────────────────────────────── */}
          <SettingsSection title="Safety & Permits" icon={Shield} defaultOpen={false}>
            <Field label="Safety Officer" value={safetyOfficer} onChange={setSafetyOfficer} placeholder="Jane Doe" />
            <Field label="Permit Number" value={permitNumber} onChange={setPermitNumber} placeholder="PYR-2026-0042" mono />
            <Field label="Insurance Policy" value={insurancePolicy} onChange={setInsurancePolicy} placeholder="INS-PYRO-2026-001" mono />
          </SettingsSection>

          {/* ── Environment Settings (ShowSim + Finale 3D) ───── */}
          <EnvironmentSettingsSection />

          {/* ── Unreal Engine Bridge ─────────────────────────── */}
          <UnrealBridgeSection />

          {/* ── Notes ────────────────────────────────────────── */}
          <SettingsSection title="Notes" icon={FileText} defaultOpen={false}>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Additional notes, special requirements, crew assignments..."
              className="w-full h-24 bg-surface-0/50 border border-border/12 rounded-xl p-3 text-[12px] text-foreground placeholder:text-muted-foreground/30 resize-none focus:outline-none focus:border-primary/30 focus:ring-1 focus:ring-primary/10 transition-all"
            />
          </SettingsSection>
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="px-3 py-3 border-t border-border/10" style={{ background: 'hsl(var(--card))' }}>
        <Button onClick={handleSave} size="sm" className="w-full h-10 rounded-xl text-[12px] font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-all">
          <Save className="w-4 h-4 mr-2" />
          Save Configuration
        </Button>
      </div>
    </div>
  );
}
