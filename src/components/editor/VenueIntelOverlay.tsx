import { useState, useEffect } from 'react';
import {
  ArrowLeft, Users, History, Trophy, Shield, Waves, Heart,
  Lightbulb, FileText, Crosshair, Clock, Sparkles, Loader2, MapPin,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { WorldShowPreset } from '@/data/worldShowPresets';

interface Props {
  preset: WorldShowPreset;
  onBack: () => void;
  onDeploy: () => void;
  deploying: boolean;
}

const SECTIONS = [
  { key: 'population', icon: Users, label: 'POPULAÇÃO & PÚBLICO' },
  { key: 'lastShows', icon: History, label: 'ÚLTIMOS SHOWS' },
  { key: 'recentWinners', icon: Trophy, label: 'LICITAÇÕES RECENTES' },
  { key: 'safety', icon: Shield, label: 'SEGURANÇA & TERRENO' },
  { key: 'tides', icon: Waves, label: 'MARÉS & HIDROGRAFIA' },
  { key: 'culture', icon: Heart, label: 'CULTURA LOCAL' },
  { key: 'insights', icon: Lightbulb, label: 'INSIGHTS ESTRATÉGICOS' },
  { key: 'regulatory', icon: FileText, label: 'REGULATÓRIO' },
] as const;

export default function VenueIntelOverlay({ preset, onBack, onDeploy, deploying }: Props) {
  const [visibleSections, setVisibleSections] = useState(0);

  useEffect(() => {
    setVisibleSections(0);
    let count = 0;
    const interval = setInterval(() => {
      count++;
      setVisibleSections(count);
      if (count >= SECTIONS.length) clearInterval(interval);
    }, 120);
    return () => clearInterval(interval);
  }, [preset.id]);

  const { intel } = preset;

  const renderSectionContent = (key: string) => {
    switch (key) {
      case 'population':
        return <p className="text-[11px] text-foreground/80">{intel.population}</p>;
      case 'lastShows':
        return (
          <ul className="space-y-0.5">
            {intel.lastShows.map((s, i) => (
              <li key={i} className="text-[10px] text-foreground/70 flex items-start gap-1">
                <span className="text-primary/60 mt-0.5">▸</span>{s}
              </li>
            ))}
          </ul>
        );
      case 'recentWinners':
        return (
          <ul className="space-y-0.5">
            {intel.recentWinners.map((w, i) => (
              <li key={i} className="text-[10px] text-foreground/70 flex items-start gap-1">
                <span className="text-primary/60 mt-0.5">▸</span>{w}
              </li>
            ))}
          </ul>
        );
      case 'safety':
        return (
          <div className="space-y-1">
            <p className="text-[10px] text-foreground/70">{intel.terrain}</p>
            <ul className="space-y-0.5">
              {intel.safetyNotes.map((n, i) => (
                <li key={i} className="text-[10px] text-destructive/80 flex items-start gap-1">
                  <span className="mt-0.5">⚠</span>{n}
                </li>
              ))}
            </ul>
          </div>
        );
      case 'tides':
        return <p className="text-[10px] text-foreground/70">{intel.tideInfo}</p>;
      case 'culture':
        return <p className="text-[10px] text-foreground/70">{intel.culture}</p>;
      case 'insights':
        return (
          <ul className="space-y-0.5">
            {intel.keyInsights.map((ins, i) => (
              <li key={i} className="text-[10px] text-primary/80 flex items-start gap-1">
                <span className="mt-0.5">★</span>{ins}
              </li>
            ))}
          </ul>
        );
      case 'regulatory':
        return <p className="text-[10px] text-foreground/70">{intel.regulatory}</p>;
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-full bg-background/95 backdrop-blur-sm text-foreground">
      {/* Header HUD */}
      <div className="border-b border-primary/20 px-3 py-2">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" className="h-6 text-[10px] px-1.5 gap-1" onClick={onBack}>
            <ArrowLeft className="w-3 h-3" /> VOLTAR
          </Button>
          <div className="flex items-center gap-1 text-[9px] text-primary/60 font-mono">
            <Crosshair className="w-3 h-3" />
            {preset.gps.lat.toFixed(4)}° {preset.gps.lng.toFixed(4)}°
          </div>
        </div>

        <div className="flex items-center gap-2 mt-1">
          <span className="text-xl">{preset.flag}</span>
          <div>
            <h2 className="text-sm font-bold tracking-tight">{preset.name}</h2>
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <MapPin className="w-3 h-3" />
              {preset.location}, {preset.country}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 mt-1.5 text-[10px] text-muted-foreground font-mono">
          <span className="flex items-center gap-0.5"><Crosshair className="w-3 h-3" />{preset.stats.positions} pos</span>
          <span className="flex items-center gap-0.5"><Sparkles className="w-3 h-3" />{preset.stats.cues} cues</span>
          <span className="flex items-center gap-0.5"><Clock className="w-3 h-3" />{Math.round(preset.duration / 60)} min</span>
          <span className="px-1 py-0 border border-border/40 rounded text-[9px]">{preset.stats.calibers}</span>
        </div>
      </div>

      {/* Intel Sections */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-2 space-y-2">
          {SECTIONS.map((section, idx) => {
            const Icon = section.icon;
            const visible = idx < visibleSections;
            return (
              <div
                key={section.key}
                className="transition-all duration-300"
                style={{
                  opacity: visible ? 1 : 0,
                  transform: visible ? 'translateY(0)' : 'translateY(8px)',
                }}
              >
                <div className="border border-primary/15 rounded-md bg-surface-2/50 p-2">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Icon className="w-3 h-3 text-primary/70" />
                    <span className="text-[9px] font-bold tracking-widest text-primary/70">{section.label}</span>
                  </div>
                  {renderSectionContent(section.key)}
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>

      {/* Deploy Button */}
      <div className="border-t border-primary/20 p-2">
        <Button
          className="w-full h-9 text-xs font-bold tracking-wider"
          onClick={onDeploy}
          disabled={deploying}
        >
          {deploying ? (
            <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> CARREGANDO...</>
          ) : (
            <><Sparkles className="w-3.5 h-3.5 mr-1" /> DEPLOY SHOW</>
          )}
        </Button>
      </div>
    </div>
  );
}
