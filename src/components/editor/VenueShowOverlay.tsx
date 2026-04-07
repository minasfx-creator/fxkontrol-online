/**
 * VenueShowOverlay — Cinematic fullscreen AR HUD that projects venue intelligence
 * directly over the 3D viewport. Auto-deploys show and self-dissolves.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Users, History, Trophy, Shield, Waves, Heart,
  Lightbulb, FileText, Crosshair, Clock, Sparkles, MapPin,
} from 'lucide-react';
import { useProjectStore } from '@/store/useProjectStore';
import { useSceneStore } from '@/store/useSceneStore';
import { toast } from 'sonner';
import type { WorldShowPreset } from '@/data/worldShowPresets';

interface Props {
  preset: WorldShowPreset;
  onComplete: () => void;
}

const INTEL_SECTIONS = [
  { key: 'population', icon: Users, label: 'POPULAÇÃO' },
  { key: 'lastShows', icon: History, label: 'HISTÓRICO' },
  { key: 'recentWinners', icon: Trophy, label: 'LICITAÇÕES' },
  { key: 'safety', icon: Shield, label: 'SEGURANÇA' },
  { key: 'tides', icon: Waves, label: 'HIDROGRAFIA' },
  { key: 'culture', icon: Heart, label: 'CULTURA' },
  { key: 'insights', icon: Lightbulb, label: 'INSIGHTS' },
  { key: 'regulatory', icon: FileText, label: 'REGULATÓRIO' },
] as const;

function useTypewriter(text: string, speed = 30) {
  const [displayed, setDisplayed] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    setDisplayed('');
    setDone(false);
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) { clearInterval(interval); setDone(true); }
    }, speed);
    return () => clearInterval(interval);
  }, [text, speed]);

  return { displayed, done };
}

export default function VenueShowOverlay({ preset, onComplete }: Props) {
  const [phase, setPhase] = useState<'reveal' | 'deploying' | 'dissolve' | 'done'>('reveal');
  const [visibleSections, setVisibleSections] = useState(0);
  const [opacity, setOpacity] = useState(1);
  const deployed = useRef(false);

  const gpsText = `${preset.gps.lat.toFixed(4)}°S  ${preset.gps.lng.toFixed(4)}°W`;
  const { displayed: gpsDisplayed, done: gpsDone } = useTypewriter(gpsText, 25);

  // Sequential intel reveal
  useEffect(() => {
    if (phase !== 'reveal') return;
    let count = 0;
    const interval = setInterval(() => {
      count++;
      setVisibleSections(count);
      if (count >= INTEL_SECTIONS.length) {
        clearInterval(interval);
        // After all sections revealed, auto-deploy
        setTimeout(() => setPhase('deploying'), 600);
      }
    }, 150);
    return () => clearInterval(interval);
  }, [phase]);

  // Auto-deploy show
  useEffect(() => {
    if (phase !== 'deploying' || deployed.current) return;
    deployed.current = true;

    (async () => {
      try {
        const store = useProjectStore.getState();
        const scene = useSceneStore.getState();
        const { positions, timelineItems } = preset.generate();

        // Clear existing
        const existingTimeline = store.timelineItems.map(t => t.id);
        const existingPositions = store.positions.map(p => p.id);
        if (existingTimeline.length > 0) store.removeMultipleTimelineItems(existingTimeline);
        existingPositions.forEach(id => store.removePosition(id));

        store.setGpsOrigin(preset.gps);
        if (preset.sceneOverrides) scene.updateSettings(preset.sceneOverrides as any);

        positions.forEach(p => store.addPosition(p));

        const BATCH = 50;
        for (let i = 0; i < timelineItems.length; i += BATCH) {
          const batch = timelineItems.slice(i, i + BATCH);
          batch.forEach(item => store.addTimelineItem(item));
          if (i + BATCH < timelineItems.length) await new Promise(r => setTimeout(r, 0));
        }

        store.setDuration(preset.duration);
        store.setProjectName(preset.name);
        store.setCurrentTime(0);

        toast.success(`${preset.flag} ${preset.name}`, {
          description: `${positions.length} posições · ${timelineItems.length} cues · ${Math.round(preset.duration / 60)} min`,
        });

        // Dissolve after deploy
        setTimeout(() => setPhase('dissolve'), 1200);
      } catch (err) {
        console.error('Deploy failed:', err);
        toast.error('Erro ao carregar show');
        onComplete();
      }
    })();
  }, [phase, preset, onComplete]);

  // Dissolve animation
  useEffect(() => {
    if (phase !== 'dissolve') return;
    const start = Date.now();
    const duration = 1500;
    const frame = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      setOpacity(1 - progress);
      if (progress < 1) requestAnimationFrame(frame);
      else { setPhase('done'); onComplete(); }
    };
    requestAnimationFrame(frame);
  }, [phase, onComplete]);

  if (phase === 'done') return null;

  const { intel } = preset;

  const renderIntelValue = (key: string) => {
    switch (key) {
      case 'population': return intel.population;
      case 'lastShows': return intel.lastShows[0] || '';
      case 'recentWinners': return intel.recentWinners[0] || '';
      case 'safety': return intel.safetyNotes[0] || '';
      case 'tides': return intel.tideInfo;
      case 'culture': return intel.culture;
      case 'insights': return intel.keyInsights[0] || '';
      case 'regulatory': return intel.regulatory;
      default: return '';
    }
  };

  return (
    <div
      className="absolute inset-0 z-[35] pointer-events-none"
      style={{ opacity }}
    >
      {/* Scanline overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 3px, hsl(var(--primary) / 0.02) 3px, hsl(var(--primary) / 0.02) 4px)',
          mixBlendMode: 'screen',
        }}
      />

      {/* ═══ Top-Left: City Name + GPS Typewriter ═══ */}
      <div className="absolute top-20 left-6">
        <div className="flex items-center gap-3 mb-1">
          <span className="text-3xl drop-shadow-lg">{preset.flag}</span>
          <div>
            <h1 className="text-xl font-black tracking-tight text-foreground drop-shadow-[0_0_20px_hsl(var(--primary)/0.3)]">
              {preset.name}
            </h1>
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/70">
              <MapPin className="w-3 h-3" />
              <span>{preset.location}, {preset.country}</span>
            </div>
          </div>
        </div>

        {/* GPS Typewriter */}
        <div className="flex items-center gap-2 mt-2 font-mono text-[11px] tracking-[0.2em]" style={{ color: 'hsl(var(--primary) / 0.7)' }}>
          <Crosshair className="w-3.5 h-3.5 animate-pulse" />
          <span>{gpsDisplayed}</span>
          {!gpsDone && <span className="animate-pulse text-primary">|</span>}
        </div>
      </div>

      {/* ═══ Left: Intel Sections (sequential reveal) ═══ */}
      <div className="absolute top-44 left-6 w-[280px] space-y-1.5">
        {INTEL_SECTIONS.map((section, idx) => {
          const Icon = section.icon;
          const visible = idx < visibleSections;
          const value = renderIntelValue(section.key);
          if (!value) return null;

          return (
            <div
              key={section.key}
              className="transition-all duration-500"
              style={{
                opacity: visible ? 1 : 0,
                transform: visible ? 'translateX(0)' : 'translateX(-20px)',
              }}
            >
              <div
                className="rounded-lg px-3 py-2 border-l-2"
                style={{
                  background: 'hsl(var(--background) / 0.25)',
                  backdropFilter: 'blur(8px)',
                  borderColor: 'hsl(var(--primary) / 0.3)',
                  borderTop: '1px solid hsl(var(--primary) / 0.08)',
                  borderRight: '1px solid hsl(var(--primary) / 0.05)',
                  borderBottom: '1px solid hsl(var(--primary) / 0.05)',
                }}
              >
                <div className="flex items-center gap-1.5 mb-0.5">
                  <Icon className="w-3 h-3" style={{ color: 'hsl(var(--primary) / 0.6)' }} />
                  <span className="text-[8px] font-bold tracking-[0.2em]" style={{ color: 'hsl(var(--primary) / 0.5)' }}>
                    {section.label}
                  </span>
                </div>
                <p className="text-[10px] text-foreground/70 leading-relaxed line-clamp-2">{value}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* ═══ Bottom Center: Stats Bar ═══ */}
      <div className="absolute bottom-28 left-1/2 -translate-x-1/2">
        <div
          className="flex items-center gap-6 px-6 py-2.5 rounded-full font-mono text-[11px]"
          style={{
            background: 'hsl(var(--background) / 0.3)',
            backdropFilter: 'blur(12px)',
            border: '1px solid hsl(var(--primary) / 0.15)',
            boxShadow: '0 0 40px hsl(var(--primary) / 0.06)',
            color: 'hsl(var(--primary) / 0.7)',
          }}
        >
          <span className="flex items-center gap-1.5">
            <Crosshair className="w-3.5 h-3.5" />
            {preset.stats.positions} POS
          </span>
          <span className="w-px h-3 bg-primary/20" />
          <span className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            {preset.stats.cues} CUES
          </span>
          <span className="w-px h-3 bg-primary/20" />
          <span className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            {Math.round(preset.duration / 60)} MIN
          </span>
          <span className="w-px h-3 bg-primary/20" />
          <span className="tracking-wider">{preset.stats.calibers}</span>
        </div>
      </div>

      {/* ═══ Bottom Right: Deploy Status ═══ */}
      <div className="absolute bottom-28 right-8">
        <div
          className="flex items-center gap-2 px-4 py-2 rounded-full font-mono text-[10px] tracking-[0.15em] font-bold"
          style={{
            color: phase === 'deploying'
              ? 'hsl(var(--primary))'
              : phase === 'dissolve'
                ? 'hsl(120 60% 50% / 0.8)'
                : 'hsl(var(--primary) / 0.5)',
            background: 'hsl(var(--background) / 0.2)',
            backdropFilter: 'blur(8px)',
            border: `1px solid ${phase === 'deploying' ? 'hsl(var(--primary) / 0.4)' : 'hsl(var(--primary) / 0.1)'}`,
            boxShadow: phase === 'deploying' ? '0 0 30px hsl(var(--primary) / 0.15)' : 'none',
          }}
        >
          {phase === 'reveal' && (
            <><Sparkles className="w-3 h-3 animate-pulse" /> SCANNING...</>
          )}
          {phase === 'deploying' && (
            <><div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" /> DEPLOYING...</>
          )}
          {phase === 'dissolve' && (
            <><Sparkles className="w-3 h-3" /> DEPLOYED ✓</>
          )}
        </div>
      </div>
    </div>
  );
}
