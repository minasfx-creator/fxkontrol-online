/**
 * VideoEditor — Reference layout for the FXKONTROL "Video Editor" surface.
 *
 * Pure presentation (Show Plane / Experience Plane). NÃO toca CommandBus,
 * FieldBus, SafetyStateMachine ou workMode — é só chrome editorial.
 *
 * Layout (1920×1080 baseline):
 *   ┌─────────────────────────── topbar (h-14) ─────────────────────────────┐
 *   │ left sidebar │  3D viewport (SkyCanvas3D)  │ right inspector sidebar  │
 *   │ (w-64)       │                             │ (w-72)                   │
 *   ├──────────────┴─────────────────────────────┴──────────────────────────┤
 *   │ timeline (h-48, scrollable horizontal)                                │
 *   └───────────────────────────────────────────────────────────────────────┘
 *
 * Tema: Vantablack canônico (#050810) + cyan-dessat 190/70/58 + amber/red
 * para status — mesma paleta operacional. Dark-first, WCAG AA.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Film, Layers, Music2, Sparkles, Wand2, Settings2, Play, Pause, Square,
  SkipBack, SkipForward, Plus, ZoomIn, ZoomOut, Eye, Lock, Trash2,
  Camera, Sun, Cloud, Activity, Volume2, VolumeX,
} from 'lucide-react';

import {
  Sidebar, SidebarProvider, SidebarTrigger,
  SidebarContent, SidebarGroup, SidebarGroupLabel, SidebarGroupContent,
  SidebarMenu, SidebarMenuItem, SidebarMenuButton,
  SidebarHeader, SidebarFooter,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

import { SkyCanvas2 } from '@/components/show3d/v2';
import EffectLibrarySidebar, { FXK_EFFECT_DRAG_TYPE } from '@/components/editor/EffectLibrarySidebar';
import { useProjectStore } from '@/store/useProjectStore';
import { timelineClock } from '@/core/timeline/TimelineClock';
import { useAudioMasterClock } from '@/hooks/useAudioMasterClock';
import { EFFECT_LIBRARY } from '@/data/effectLibrary';

// ──────────────────────────────────────────────────────────────────────────
// Left sidebar — assets/library
// ──────────────────────────────────────────────────────────────────────────

const LIBRARY_GROUPS = [
  { label: 'Sequences', icon: Film, items: ['Reveillon Master', 'Maracanã Hino', 'Libertadores'] },
  { label: 'Effects', icon: Sparkles, items: ['Chrysanthemum 3"', 'Willow 4"', 'Comet 2"', 'Mine 1.2"'] },
  { label: 'Drones', icon: Layers, items: ['Formation A', 'Formation B', 'Spiral Up'] },
  { label: 'Audio', icon: Music2, items: ['Master Track', 'SFX Bed'] },
];

function LeftSidebar() {
  return (
    <Sidebar collapsible="icon" className="border-r border-cyan-500/10">
      <SidebarHeader className="px-3 py-3">
        <div className="flex items-center gap-2 ds-mono text-[11px] tracking-wider text-cyan-300/80">
          <Film className="h-4 w-4" />
          <span>VIDEO · EDITOR</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        {LIBRARY_GROUPS.map((g) => (
          <SidebarGroup key={g.label}>
            <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-zinc-500">
              {g.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {g.items.map((item) => (
                  <SidebarMenuItem key={item}>
                    <SidebarMenuButton className="hover:bg-cyan-500/10">
                      <g.icon className="h-4 w-4 text-cyan-400/80" />
                      <span className="text-[13px]">{item}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter className="px-3 py-2 border-t border-cyan-500/10">
        <Button size="sm" variant="ghost" className="justify-start gap-2 text-cyan-300 hover:text-cyan-100 hover:bg-cyan-500/10">
          <Plus className="h-4 w-4" /> New asset
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Right inspector — properties panel
// ──────────────────────────────────────────────────────────────────────────

function RightInspector() {
  const [intensity, setIntensity] = useState([80]);
  const [exposure, setExposure] = useState([50]);
  return (
    <aside className="w-72 shrink-0 border-l border-cyan-500/10 bg-[#070b14] flex flex-col">
      <div className="px-4 h-12 flex items-center border-b border-cyan-500/10">
        <span className="ds-mono text-[11px] tracking-wider text-cyan-300/80">INSPECTOR</span>
      </div>
      <Tabs defaultValue="cue" className="flex-1 flex flex-col">
        <TabsList className="mx-3 mt-3 grid grid-cols-3 bg-[#0c1322] border border-cyan-500/10">
          <TabsTrigger value="cue">Cue</TabsTrigger>
          <TabsTrigger value="scene">Scene</TabsTrigger>
          <TabsTrigger value="render">Render</TabsTrigger>
        </TabsList>

        <ScrollArea className="flex-1 px-4 py-4">
          <TabsContent value="cue" className="space-y-5 mt-0">
            <div>
              <label className="text-[11px] uppercase tracking-widest text-zinc-500">Name</label>
              <Input
                defaultValue="Chrysanthemum 3″ — pad L"
                className="mt-1 h-8 bg-[#0c1322] border-cyan-500/15 text-[13px]"
              />
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-widest text-zinc-500">Color</label>
              <div className="mt-2 flex gap-2">
                {['#FFD700', '#FF1493', '#00BFFF', '#22ee88', '#ff7700', '#ffffff'].map((c) => (
                  <button
                    key={c}
                    style={{ background: c }}
                    className="h-6 w-6 rounded-full ring-1 ring-white/10 hover:ring-cyan-300"
                  />
                ))}
              </div>
            </div>
            <div>
              <div className="flex justify-between text-[11px] uppercase tracking-widest text-zinc-500">
                <span>Intensity</span><span className="text-cyan-300">{intensity[0]}%</span>
              </div>
              <Slider value={intensity} onValueChange={setIntensity} max={100} step={1} className="mt-2" />
            </div>
            <div>
              <div className="flex justify-between text-[11px] uppercase tracking-widest text-zinc-500">
                <span>Prefire</span><span className="text-cyan-300">2.0 s</span>
              </div>
              <Slider defaultValue={[20]} max={60} step={1} className="mt-2" />
            </div>
            <Separator className="bg-cyan-500/10" />
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[12px] text-zinc-400">
                <span>Position</span><span className="ds-mono text-cyan-300">PYRO-L</span>
              </div>
              <div className="flex items-center justify-between text-[12px] text-zinc-400">
                <span>Caliber</span><span className="ds-mono text-cyan-300">3″</span>
              </div>
              <div className="flex items-center justify-between text-[12px] text-zinc-400">
                <span>Apex</span><span className="ds-mono text-cyan-300">60 m</span>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="scene" className="space-y-5 mt-0">
            <div>
              <label className="text-[11px] uppercase tracking-widest text-zinc-500 flex items-center gap-1">
                <Sun className="h-3 w-3" /> Exposure
              </label>
              <Slider value={exposure} onValueChange={setExposure} max={100} step={1} className="mt-2" />
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-widest text-zinc-500 flex items-center gap-1">
                <Cloud className="h-3 w-3" /> Atmosphere
              </label>
              <Slider defaultValue={[35]} max={100} step={1} className="mt-2" />
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-widest text-zinc-500 flex items-center gap-1">
                <Camera className="h-3 w-3" /> FOV
              </label>
              <Slider defaultValue={[55]} min={20} max={120} step={1} className="mt-2" />
            </div>
          </TabsContent>

          <TabsContent value="render" className="space-y-3 mt-0 text-[12px] text-zinc-400">
            <div className="flex justify-between"><span>Resolution</span><span className="ds-mono text-cyan-300">1920×1080</span></div>
            <div className="flex justify-between"><span>Frame rate</span><span className="ds-mono text-cyan-300">29.97 DF</span></div>
            <div className="flex justify-between"><span>Codec</span><span className="ds-mono text-cyan-300">H.264</span></div>
            <Button size="sm" className="w-full mt-3 bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-200 border border-cyan-500/25">
              <Wand2 className="h-3.5 w-3.5 mr-2" /> Render preview
            </Button>
          </TabsContent>
        </ScrollArea>
      </Tabs>
    </aside>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Topbar
// ──────────────────────────────────────────────────────────────────────────

function Topbar({
  playing, onTogglePlay, onStop, onSeek, time, duration,
  hasAudio, onPickAudio,
}: {
  playing: boolean;
  onTogglePlay: () => void;
  onStop: () => void;
  onSeek: (delta: number) => void;
  time: number;
  duration: number;
  hasAudio: boolean;
  onPickAudio: (file: File) => void;
}) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const fmt = (s: number) => {
    const mm = Math.floor(s / 60).toString().padStart(2, '0');
    const ss = Math.floor(s % 60).toString().padStart(2, '0');
    const ff = Math.floor((s % 1) * 30).toString().padStart(2, '0');
    return `${mm}:${ss}:${ff}`;
  };
  return (
    <header className="h-14 shrink-0 flex items-center gap-3 px-3 border-b border-cyan-500/10 bg-[#070b14]">
      <SidebarTrigger className="text-cyan-300 hover:text-cyan-100" />
      <div className="ds-mono text-[12px] tracking-wider text-cyan-300/90">
        FXKONTROL · VIDEO EDITOR
      </div>
      <Badge variant="outline" className="border-cyan-500/30 text-cyan-300 ds-mono text-[10px]">
        SIM · ADVISORY
      </Badge>
      <div className="flex-1" />

      <div className="flex items-center gap-1">
        <Button size="icon" variant="ghost" className="h-8 w-8 text-zinc-300 hover:text-cyan-200 hover:bg-cyan-500/10" onClick={() => onSeek(-5)}>
          <SkipBack className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          className={cn(
            'h-9 w-9 rounded-full',
            playing
              ? 'bg-amber-500/20 text-amber-200 hover:bg-amber-500/30 border border-amber-500/40'
              : 'bg-cyan-500/20 text-cyan-200 hover:bg-cyan-500/30 border border-cyan-500/40',
          )}
          onClick={onTogglePlay}
        >
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>
        <Button size="icon" variant="ghost" className="h-8 w-8 text-zinc-300 hover:text-rose-300 hover:bg-rose-500/10" onClick={onStop}>
          <Square className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="ghost" className="h-8 w-8 text-zinc-300 hover:text-cyan-200 hover:bg-cyan-500/10" onClick={() => onSeek(5)}>
          <SkipForward className="h-4 w-4" />
        </Button>
      </div>

      <div className="ds-mono text-[12px] text-cyan-300 tabular-nums w-[140px] text-center px-2 py-1 rounded border border-cyan-500/20 bg-[#0c1322]">
        {fmt(time)} / {fmt(duration)}
      </div>

      <Separator orientation="vertical" className="h-6 bg-cyan-500/15" />

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="sm"
            variant="ghost"
            className={cn(
              'gap-2',
              hasAudio
                ? 'text-emerald-300 hover:text-emerald-200 hover:bg-emerald-500/10'
                : 'text-zinc-300 hover:text-cyan-200 hover:bg-cyan-500/10',
            )}
            onClick={() => fileRef.current?.click()}
          >
            {hasAudio ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            {hasAudio ? 'Audio master' : 'Load audio'}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {hasAudio
            ? 'Audio is the master clock — Play follows audio.currentTime'
            : 'Load an audio file to make it the master clock for the timeline'}
        </TooltipContent>
      </Tooltip>
      <input
        ref={fileRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPickAudio(f);
          e.target.value = '';
        }}
      />

      <Button size="sm" variant="ghost" className="text-zinc-300 hover:text-cyan-200 hover:bg-cyan-500/10 gap-2">
        <Settings2 className="h-4 w-4" /> Settings
      </Button>
    </header>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Timeline — drop-aware, reads cues from useProjectStore.timelineItems
// ──────────────────────────────────────────────────────────────────────────

const TRACK_DEFS: { id: 'video' | 'pyro' | 'drone' | 'audio'; label: string; icon: typeof Film; accepts: Set<string> }[] = [
  { id: 'video', label: 'Camera', icon: Camera, accepts: new Set() },
  { id: 'pyro',  label: 'Pyro',   icon: Sparkles, accepts: new Set(['firework']) },
  { id: 'drone', label: 'Drones', icon: Layers,   accepts: new Set(['drone', 'light']) },
  { id: 'audio', label: 'Audio',  icon: Music2,   accepts: new Set(['sfx']) },
];

const EFFECT_BY_ID = Object.fromEntries(EFFECT_LIBRARY.map((e) => [e.id, e]));

function trackAccepts(trackId: string, effectType: string): boolean {
  const def = TRACK_DEFS.find((t) => t.id === trackId);
  if (!def || def.accepts.size === 0) return false;
  return def.accepts.has(effectType);
}

function Timeline({
  time, duration, onScrub,
}: { time: number; duration: number; onScrub: (t: number) => void }) {
  const [zoom, setZoom] = useState(40); // px per second
  const [hoverTrack, setHoverTrack] = useState<string | null>(null);
  const widthPx = duration * zoom;
  const playheadX = time * zoom;

  const timelineItems = useProjectStore((s) => s.timelineItems);
  const positions = useProjectStore((s) => s.positions);
  const addTimelineItem = useProjectStore((s) => s.addTimelineItem);

  // Group cues by track for rendering.
  const clipsByTrack = useMemo(() => {
    const map: Record<string, typeof timelineItems> = { video: [], pyro: [], drone: [], audio: [] };
    for (const item of timelineItems) {
      const eff = EFFECT_BY_ID[item.effectId];
      if (!eff) continue;
      if (eff.type === 'firework') map.pyro.push(item);
      else if (eff.type === 'drone' || eff.type === 'light') map.drone.push(item);
      else if (eff.type === 'sfx') map.audio.push(item);
    }
    return map;
  }, [timelineItems]);

  const handleDrop = (trackId: string) => (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setHoverTrack(null);
    const effectId =
      e.dataTransfer.getData(FXK_EFFECT_DRAG_TYPE) ||
      e.dataTransfer.getData('text/plain');
    if (!effectId) return;
    const effect = EFFECT_BY_ID[effectId];
    if (!effect) return;
    if (!trackAccepts(trackId, effect.type)) return;

    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const startTime = Math.max(
      0,
      Math.min(duration, (e.clientX - rect.left) / zoom),
    );

    // Pick a sensible default position for pyro cues (first matching pad).
    const defaultPyroPad = positions.find((p) => p.type === 'pyro');
    const defaultDronePad = positions.find(
      (p) => p.type === 'drone-pad' || p.type === 'light',
    );
    const pad =
      effect.type === 'firework' ? defaultPyroPad :
      (effect.type === 'drone' || effect.type === 'light') ? defaultDronePad :
      undefined;

    addTimelineItem({
      id: `cue-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      effectId,
      startTime,
      trackIndex: 0,
      position: pad ? { x: pad.x, y: pad.y, z: pad.z } : { x: 0, y: 0, z: 0 },
      positionId: pad?.id,
      colorOverride: undefined,
    });
  };

  const handleDragOver = (trackId: string) => (e: React.DragEvent<HTMLDivElement>) => {
    const types = Array.from(e.dataTransfer.types);
    if (!types.includes(FXK_EFFECT_DRAG_TYPE) && !types.includes('text/plain')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    if (hoverTrack !== trackId) setHoverTrack(trackId);
  };

  return (
    <section className="h-48 shrink-0 border-t border-cyan-500/10 bg-[#070b14] flex flex-col">
      {/* Toolbar */}
      <div className="h-9 shrink-0 px-3 flex items-center gap-2 border-b border-cyan-500/10">
        <span className="ds-mono text-[11px] tracking-wider text-cyan-300/80">TIMELINE</span>
        <Separator orientation="vertical" className="h-4 bg-cyan-500/15 mx-1" />
        <Button size="icon" variant="ghost" className="h-7 w-7 text-zinc-400 hover:text-cyan-200 hover:bg-cyan-500/10" onClick={() => setZoom((z) => Math.max(10, z - 8))}>
          <ZoomOut className="h-3.5 w-3.5" />
        </Button>
        <div className="w-32"><Slider value={[zoom]} min={10} max={120} step={1} onValueChange={(v) => setZoom(v[0])} /></div>
        <Button size="icon" variant="ghost" className="h-7 w-7 text-zinc-400 hover:text-cyan-200 hover:bg-cyan-500/10" onClick={() => setZoom((z) => Math.min(120, z + 8))}>
          <ZoomIn className="h-3.5 w-3.5" />
        </Button>
        <div className="flex-1" />
        <Badge variant="outline" className="border-cyan-500/30 text-cyan-300 ds-mono text-[10px]">
          {duration.toFixed(1)}s · {timelineItems.length} cues
        </Badge>
      </div>

      <div className="flex-1 flex min-h-0">
        {/* Track headers */}
        <div className="w-32 shrink-0 border-r border-cyan-500/10">
          <div className="h-6 border-b border-cyan-500/10" />
          {TRACK_DEFS.map((tr) => (
            <div key={tr.id} className="h-9 px-2 flex items-center gap-2 text-[12px] text-zinc-300 border-b border-cyan-500/5">
              <tr.icon className="h-3.5 w-3.5 text-cyan-400/80" />
              <span className="truncate flex-1">{tr.label}</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="text-zinc-500 hover:text-cyan-300"><Eye className="h-3 w-3" /></button>
                </TooltipTrigger>
                <TooltipContent>Show/Hide</TooltipContent>
              </Tooltip>
              <button className="text-zinc-500 hover:text-amber-300"><Lock className="h-3 w-3" /></button>
            </div>
          ))}
        </div>

        {/* Tracks scroll area */}
        <ScrollArea className="flex-1">
          <div
            className="relative"
            style={{ width: `${widthPx}px`, minWidth: '100%' }}
            onClick={(e) => {
              const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
              const t = (e.clientX - rect.left) / zoom;
              onScrub(Math.max(0, Math.min(duration, t)));
            }}
          >
            {/* Ruler */}
            <div className="h-6 border-b border-cyan-500/10 relative bg-[#0a1120]">
              {Array.from({ length: Math.ceil(duration) + 1 }).map((_, s) => (
                <div
                  key={s}
                  className="absolute top-0 bottom-0 border-l border-cyan-500/15 ds-mono text-[9px] text-zinc-500 pl-1"
                  style={{ left: `${s * zoom}px` }}
                >
                  {s}s
                </div>
              ))}
            </div>

            {/* Track lanes */}
            {TRACK_DEFS.map((tr, idx) => {
              const isHover = hoverTrack === tr.id;
              const clips = clipsByTrack[tr.id] ?? [];
              return (
                <div
                  key={tr.id}
                  onDragOver={handleDragOver(tr.id)}
                  onDragLeave={() => isHover && setHoverTrack(null)}
                  onDrop={handleDrop(tr.id)}
                  className={cn(
                    'h-9 relative border-b border-cyan-500/5 transition-colors',
                    idx % 2 === 0 ? 'bg-[#080d18]' : 'bg-[#0a1120]',
                    isHover && tr.accepts.size > 0 && 'bg-cyan-500/15 ring-1 ring-cyan-400/40 ring-inset',
                    isHover && tr.accepts.size === 0 && 'bg-rose-500/10 ring-1 ring-rose-400/30 ring-inset',
                  )}
                >
                  {clips.map((c) => {
                    const eff = EFFECT_BY_ID[c.effectId];
                    if (!eff) return null;
                    const dur = c.durationOverride ?? eff.duration ?? 1;
                    const color = c.colorOverride ?? eff.color ?? '#2dd4ff';
                    return (
                      <div
                        key={c.id}
                        className="absolute top-1 bottom-1 rounded-sm px-2 flex items-center text-[11px] text-black/80 font-medium overflow-hidden cursor-pointer hover:ring-1 hover:ring-white/40"
                        style={{
                          left: `${c.startTime * zoom}px`,
                          width: `${Math.max(dur * zoom, 4)}px`,
                          background: `linear-gradient(180deg, ${color}f0, ${color}b0)`,
                          boxShadow: `0 0 8px ${color}40`,
                        }}
                        onClick={(e) => e.stopPropagation()}
                        title={`${eff.name} @ ${c.startTime.toFixed(2)}s`}
                      >
                        <span className="truncate">{eff.name}</span>
                      </div>
                    );
                  })}
                </div>
              );
            })}

            {/* Playhead */}
            <div
              className="absolute top-0 bottom-0 w-px bg-cyan-300 pointer-events-none"
              style={{ left: `${playheadX}px`, boxShadow: '0 0 8px #2dd4ff' }}
            >
              <div className="absolute -top-0.5 -left-1.5 w-3 h-3 rotate-45 bg-cyan-300" />
            </div>
          </div>
        </ScrollArea>
      </div>
    </section>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Status bar (optional bottom strip)
// ──────────────────────────────────────────────────────────────────────────

function StatusBar() {
  return (
    <div className="h-6 shrink-0 px-3 flex items-center gap-3 text-[10px] ds-mono text-zinc-500 border-t border-cyan-500/10 bg-[#050810]">
      <span className="flex items-center gap-1 text-emerald-400">
        <Activity className="h-3 w-3" /> 60 FPS
      </span>
      <span>WebGL2</span>
      <span>DPR 1.5</span>
      <div className="flex-1" />
      <span>WORK MODE: <span className="text-cyan-300">SIMULATION</span></span>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Page
// ──────────────────────────────────────────────────────────────────────────

export default function VideoEditor() {
  // Canonical store reads — currentTime is driven by `timelineClock`,
  // which itself is driven by either:
  //   a) `useAudioMasterClock` when an <audio> is loaded + playing (master), or
  //   b) the local RAF below (`timelineClock.tick(dt)`) when no audio.
  const currentTime = useProjectStore((s) => s.currentTime);
  const duration = useProjectStore((s) => s.duration) || 12;
  const isPlaying = useProjectStore((s) => s.isPlaying);
  const setPlaying = useProjectStore((s) => s.setPlaying);
  const setCurrentTime = useProjectStore((s) => s.setCurrentTime);
  const audioUrl = useProjectStore((s) => s.audioUrl);

  // ── Demo seed (one-shot) ────────────────────────────────────────────
  useEffect(() => {
    if (useProjectStore.getState().positions.length > 0) return;
    useProjectStore.setState({
      positions: [
        { id: 'pyro-L', name: 'Pyro L', type: 'pyro', x: -20, y: 0, z: 0, heading: 0, pitch: 0, roll: 0, color: '#ff7700' },
        { id: 'pyro-R', name: 'Pyro R', type: 'pyro', x: 20, y: 0, z: 0, heading: 0, pitch: 0, roll: 0, color: '#ff7700' },
        { id: 'drone-A', name: 'Drone A', type: 'drone-pad', x: -10, y: 12, z: -10, heading: 0, pitch: 0, roll: 0, color: '#2dd4ff' },
        { id: 'drone-B', name: 'Drone B', type: 'drone-pad' as const, x: 10, y: 12, z: -10, heading: 0, pitch: 0, roll: 0, color: '#22ee88' },
      ],
      timelineItems: [
        { id: 'p1', effectId: 'mort-01', startTime: 1, trackIndex: 0, position: { x: -20, y: 0, z: 0 }, positionId: 'pyro-L' },
        { id: 'p2', effectId: 'mort-02', startTime: 4, trackIndex: 0, position: { x: 20, y: 0, z: 0 }, positionId: 'pyro-R' },
        { id: 'p3', effectId: 'shell-04', startTime: 8, trackIndex: 0, position: { x: -20, y: 0, z: 0 }, positionId: 'pyro-L' },
      ],
      duration: 12,
    });
    timelineClock.setDuration(12);
  }, []);

  // ── Audio element + master clock binding ────────────────────────────
  // <audio> stays mounted (hidden). When `audioUrl` is set, the element
  // streams it; `useAudioMasterClock` then makes `audio.currentTime` the
  // master clock for the whole timeline (source becomes 'external').
  // Without audio it stays local and the RAF below ticks the clock.
  const audioRef = useRef<HTMLAudioElement | null>(null);
  useAudioMasterClock(audioRef, audioUrl);

  // Drive <audio> play/pause to mirror the store. When the operator hits
  // Play and an audio is loaded, we call `audio.play()` so the master
  // clock has something to follow. If the play promise rejects (autoplay
  // gesture not present yet), the lockstep fallback below keeps showing
  // the show — exactly like the editor's hardened path.
  useEffect(() => {
    const a = audioRef.current;
    if (!a || !audioUrl) return;
    if (isPlaying) {
      const p = a.play();
      if (p && typeof p.catch === 'function') p.catch(() => { /* fallback to RAF */ });
    } else {
      a.pause();
    }
  }, [isPlaying, audioUrl]);

  // Mirror scrubs from the store back to the audio element.
  useEffect(() => {
    const a = audioRef.current;
    if (!a || !audioUrl) return;
    // Only push scrubs when the delta is significant (>120 ms) — we don't
    // want to fight the master pump's per-RAF writes.
    if (Math.abs(a.currentTime - currentTime) > 0.12) {
      try { a.currentTime = currentTime; } catch { /* not seekable yet */ }
    }
  }, [currentTime, audioUrl]);

  // ── Local RAF fallback: ticks `timelineClock.tick(dt)` while playing
  // and the clock is *local* (no audio master). This is what spawns the
  // Particle Explosions / Light Points in SkyCanvas3D in the no-audio
  // case — by advancing `currentTime` through the canonical clock so
  // every subscriber (3D viewport, timeline playhead, transport time)
  // moves in lockstep.
  useEffect(() => {
    if (!isPlaying) return;
    let rafId = 0;
    let last = performance.now();
    const pump = () => {
      const now = performance.now();
      const dt = (now - last) / 1000;
      last = now;
      // Skip ticking when audio owns the clock — `useAudioMasterClock`
      // pushes `syncExternalTime` every RAF and source flips to 'external'.
      if (timelineClock.getState().source === 'local') {
        timelineClock.tick(dt);
      }
      if (useProjectStore.getState().isPlaying) {
        rafId = requestAnimationFrame(pump);
      }
    };
    rafId = requestAnimationFrame(pump);
    return () => cancelAnimationFrame(rafId);
  }, [isPlaying]);

  // ── Transport actions (canonical, never touch SafetyStateMachine) ──
  const togglePlay = () => setPlaying(!isPlaying);
  const stop = () => { setPlaying(false); setCurrentTime(0); };
  const seek = (t: number) => setCurrentTime(Math.max(0, Math.min(duration, t)));
  const seekDelta = (d: number) => seek(currentTime + d);

  // ── Audio file picker (operator drops/loads music) ─────────────────
  const onPickAudio = (file: File) => {
    const url = URL.createObjectURL(file);
    useProjectStore.setState({ audioUrl: url });
  };

  return (
    <TooltipProvider delayDuration={200}>
      <SidebarProvider defaultOpen>
        <div className="flex h-screen w-full bg-[#050810] text-zinc-200">
          <EffectLibrarySidebar />

          <div className="flex-1 flex flex-col min-w-0">
            <Topbar
              playing={isPlaying}
              onTogglePlay={togglePlay}
              onStop={stop}
              onSeek={seekDelta}
              time={currentTime}
              duration={duration}
              hasAudio={!!audioUrl}
              onPickAudio={onPickAudio}
            />

            <div className="flex-1 flex min-h-0">
              {/* Viewport */}
              <main className="flex-1 relative bg-black min-w-0">
                <SkyCanvas3D />
                {/* Viewport HUD */}
                <div className="absolute top-3 left-3 z-10 flex gap-2">
                  <Badge className="bg-black/60 border border-cyan-500/30 text-cyan-300 ds-mono text-[10px]">
                    PREVIEW · 1080p
                  </Badge>
                  <Badge className="bg-black/60 border border-emerald-500/30 text-emerald-300 ds-mono text-[10px]">
                    {audioUrl ? 'AUDIO MASTER' : 'LOCAL CLOCK'}
                  </Badge>
                </div>
                <div className="absolute bottom-3 left-3 z-10 ds-mono text-[10px] text-cyan-300/80 bg-black/60 px-2 py-1 rounded border border-cyan-500/20">
                  drag = orbit · wheel = zoom · right = pan
                </div>
              </main>

              <RightInspector />
            </div>

            <Timeline time={currentTime} duration={duration} onScrub={seek} />
            <StatusBar />
          </div>

          {/* Hidden audio element — master clock source when loaded. */}
          <audio
            ref={audioRef}
            src={audioUrl ?? undefined}
            preload="auto"
            className="sr-only"
          />
        </div>
      </SidebarProvider>
    </TooltipProvider>
  );
}
