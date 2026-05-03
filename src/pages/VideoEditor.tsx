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

import SkyCanvas3D from '@/components/show3d/SkyCanvas3D';
import { useProjectStore } from '@/store/useProjectStore';
import { timelineClock } from '@/core/timeline/TimelineClock';
import { useAudioMasterClock } from '@/hooks/useAudioMasterClock';

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
}: {
  playing: boolean;
  onTogglePlay: () => void;
  onStop: () => void;
  onSeek: (delta: number) => void;
  time: number;
  duration: number;
}) {
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

      <Button size="sm" variant="ghost" className="text-zinc-300 hover:text-cyan-200 hover:bg-cyan-500/10 gap-2">
        <Settings2 className="h-4 w-4" /> Settings
      </Button>
    </header>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Timeline
// ──────────────────────────────────────────────────────────────────────────

interface ClipItem {
  id: string;
  startTime: number;
  duration: number;
  label: string;
  color: string;
}

const TRACKS: { id: string; label: string; icon: typeof Film; clips: ClipItem[] }[] = [
  {
    id: 'video', label: 'Camera', icon: Camera, clips: [
      { id: 'v1', startTime: 0, duration: 12, label: 'Wide opening', color: '#2dd4ff' },
    ],
  },
  {
    id: 'pyro', label: 'Pyro', icon: Sparkles, clips: [
      { id: 'p1', startTime: 1, duration: 2.5, label: 'Chrys 3″', color: '#FFD700' },
      { id: 'p2', startTime: 4, duration: 3.5, label: 'Willow 4″', color: '#FFA500' },
      { id: 'p3', startTime: 8, duration: 2.5, label: 'Crossette', color: '#FF4500' },
    ],
  },
  {
    id: 'drone', label: 'Drones', icon: Layers, clips: [
      { id: 'd1', startTime: 0, duration: 12, label: 'Formation A', color: '#22ee88' },
    ],
  },
  {
    id: 'audio', label: 'Audio', icon: Music2, clips: [
      { id: 'a1', startTime: 0, duration: 12, label: 'Master', color: '#a78bfa' },
    ],
  },
];

function Timeline({
  time, duration, onScrub,
}: { time: number; duration: number; onScrub: (t: number) => void }) {
  const [zoom, setZoom] = useState(40); // px per second
  const widthPx = duration * zoom;
  const playheadX = time * zoom;

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
          {duration.toFixed(1)}s · {TRACKS.length} tracks
        </Badge>
      </div>

      <div className="flex-1 flex min-h-0">
        {/* Track headers */}
        <div className="w-32 shrink-0 border-r border-cyan-500/10">
          <div className="h-6 border-b border-cyan-500/10" />
          {TRACKS.map((tr) => (
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
            {TRACKS.map((tr, idx) => (
              <div
                key={tr.id}
                className={cn(
                  'h-9 relative border-b border-cyan-500/5',
                  idx % 2 === 0 ? 'bg-[#080d18]' : 'bg-[#0a1120]',
                )}
              >
                {tr.clips.map((c) => (
                  <div
                    key={c.id}
                    className="absolute top-1 bottom-1 rounded-sm px-2 flex items-center text-[11px] text-black/80 font-medium overflow-hidden cursor-pointer hover:ring-1 hover:ring-white/40"
                    style={{
                      left: `${c.startTime * zoom}px`,
                      width: `${Math.max(c.duration * zoom, 4)}px`,
                      background: `linear-gradient(180deg, ${c.color}f0, ${c.color}b0)`,
                      boxShadow: `0 0 8px ${c.color}40`,
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span className="truncate">{c.label}</span>
                  </div>
                ))}
              </div>
            ))}

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
  // Local playback (presentation only — does NOT touch SafetyStateMachine).
  const currentTime = useProjectStore((s) => s.currentTime);
  const duration = useProjectStore((s) => s.duration) || 12;
  const isPlaying = useProjectStore((s) => s.isPlaying);

  const seedDemo = useMemo(() => {
    if (useProjectStore.getState().positions.length === 0) {
      useProjectStore.setState({
        positions: [
          { id: 'pyro-L', name: 'Pyro L', type: 'pyro', x: -20, y: 0, z: 0, heading: 0, pitch: 0, roll: 0, color: '#ff7700' },
          { id: 'pyro-R', name: 'Pyro R', type: 'pyro', x: 20, y: 0, z: 0, heading: 0, pitch: 0, roll: 0, color: '#ff7700' },
          { id: 'drone-A', name: 'Drone A', type: 'drone-pad', x: -10, y: 12, z: -10, heading: 0, pitch: 0, roll: 0, color: '#2dd4ff' },
          { id: 'drone-B', name: 'Drone B', type: 'drone-pad', x: 10, y: 12, z: -10, heading: 0, pitch: 0, roll: 0, color: '#22ee88' },
        ],
        timelineItems: [
          { id: 'p1', effectId: 'mort-01', startTime: 1, trackIndex: 0, position: { x: -20, y: 0, z: 0 }, positionId: 'pyro-L' },
          { id: 'p2', effectId: 'mort-02', startTime: 4, trackIndex: 0, position: { x: 20, y: 0, z: 0 }, positionId: 'pyro-R' },
          { id: 'p3', effectId: 'shell-04', startTime: 8, trackIndex: 0, position: { x: -20, y: 0, z: 0 }, positionId: 'pyro-L' },
        ],
        duration: 12,
      });
    }
    return true;
  }, []);
  void seedDemo;

  // Local play loop (no audio bridge, no Show3DEngine RAF)
  const togglePlay = () => {
    const s = useProjectStore.getState();
    useProjectStore.setState({ isPlaying: !s.isPlaying });
    if (!s.isPlaying) tick();
  };
  const stop = () => useProjectStore.setState({ isPlaying: false, currentTime: 0 });
  const seek = (t: number) => useProjectStore.setState({ currentTime: Math.max(0, Math.min(duration, t)) });
  const seekDelta = (d: number) => seek(currentTime + d);

  function tick() {
    const startWall = performance.now();
    const startTime = useProjectStore.getState().currentTime;
    const dur = useProjectStore.getState().duration || 12;
    const id = window.setInterval(() => {
      const s = useProjectStore.getState();
      if (!s.isPlaying) { window.clearInterval(id); return; }
      const t = startTime + (performance.now() - startWall) / 1000;
      if (t >= dur) {
        useProjectStore.setState({ currentTime: 0 });
      } else {
        useProjectStore.setState({ currentTime: t });
      }
    }, 33);
  }

  return (
    <TooltipProvider delayDuration={200}>
      <SidebarProvider defaultOpen>
        <div className="flex h-screen w-full bg-[#050810] text-zinc-200">
          <LeftSidebar />

          <div className="flex-1 flex flex-col min-w-0">
            <Topbar
              playing={isPlaying}
              onTogglePlay={togglePlay}
              onStop={stop}
              onSeek={seekDelta}
              time={currentTime}
              duration={duration}
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
                    LIVE
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
        </div>
      </SidebarProvider>
    </TooltipProvider>
  );
}
