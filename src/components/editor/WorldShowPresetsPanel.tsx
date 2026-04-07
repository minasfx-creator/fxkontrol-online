import { useState, useMemo, useCallback } from 'react';
import { X, Globe, MapPin, Clock, Crosshair, Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { WORLD_SHOW_PRESETS, CONTINENT_LABELS, type WorldShowPreset } from '@/data/worldShowPresets';
import { useProjectStore } from '@/store/useProjectStore';
import { useSceneStore } from '@/store/useSceneStore';
import { toast } from 'sonner';

interface Props {
  onClose: () => void;
}

export default function WorldShowPresetsPanel({ onClose }: Props) {
  const [loading, setLoading] = useState<string | null>(null);
  const [filter, setFilter] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const groups: Record<string, WorldShowPreset[]> = {};
    for (const preset of WORLD_SHOW_PRESETS) {
      if (filter && preset.continent !== filter) continue;
      (groups[preset.continent] ??= []).push(preset);
    }
    return groups;
  }, [filter]);

  const handleLoad = useCallback(async (preset: WorldShowPreset) => {
    if (!window.confirm(
      `Carregar "${preset.name}"?\n\nIsso limpará as posições e timeline atuais.`
    )) return;

    setLoading(preset.id);

    // Small delay so UI shows loading state
    await new Promise(r => setTimeout(r, 50));

    try {
      const store = useProjectStore.getState();
      const scene = useSceneStore.getState();

      // Generate show data
      const { positions, timelineItems } = preset.generate();

      // Clear existing data
      const existingPositions = store.positions.map(p => p.id);
      const existingTimeline = store.timelineItems.map(t => t.id);
      if (existingTimeline.length > 0) store.removeMultipleTimelineItems(existingTimeline);
      existingPositions.forEach(id => store.removePosition(id));

      // Set GPS origin
      store.setGpsOrigin(preset.gps);

      // Apply scene overrides
      if (preset.sceneOverrides) {
        scene.updateSettings(preset.sceneOverrides as any);
      }

      // Add positions
      positions.forEach(p => store.addPosition(p));

      // Add timeline items in batches for performance
      const BATCH = 50;
      for (let i = 0; i < timelineItems.length; i += BATCH) {
        const batch = timelineItems.slice(i, i + BATCH);
        batch.forEach(item => store.addTimelineItem(item));
        if (i + BATCH < timelineItems.length) {
          await new Promise(r => setTimeout(r, 0)); // yield to UI
        }
      }

      // Set duration and project name
      store.setDuration(preset.duration);
      store.setProjectName(preset.name);
      store.setCurrentTime(0);

      toast.success(`${preset.flag} ${preset.name} carregado!`, {
        description: `${positions.length} posições · ${timelineItems.length} cues · ${Math.round(preset.duration / 60)} min`,
      });
    } catch (err) {
      console.error('Failed to load preset:', err);
      toast.error('Erro ao carregar preset');
    } finally {
      setLoading(null);
    }
  }, []);

  const continents = Object.keys(CONTINENT_LABELS);

  return (
    <div className="flex flex-col h-full bg-surface-1 text-foreground">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/40">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-bold tracking-tight">World Famous Shows</h2>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Continent Filter */}
      <div className="flex gap-1 px-3 py-2 flex-wrap border-b border-border/20">
        <Badge
          variant={filter === null ? 'default' : 'outline'}
          className="cursor-pointer text-[10px] px-2 py-0.5"
          onClick={() => setFilter(null)}
        >
          Todos
        </Badge>
        {continents.map(c => (
          <Badge
            key={c}
            variant={filter === c ? 'default' : 'outline'}
            className="cursor-pointer text-[10px] px-2 py-0.5"
            onClick={() => setFilter(c)}
          >
            {CONTINENT_LABELS[c]}
          </Badge>
        ))}
      </div>

      {/* Show List */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-4">
          {Object.entries(grouped).map(([continent, presets]) => (
            <div key={continent}>
              <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-1 mb-1.5">
                {CONTINENT_LABELS[continent]}
              </h3>
              <div className="space-y-1.5">
                {presets.map(preset => (
                  <ShowCard
                    key={preset.id}
                    preset={preset}
                    loading={loading === preset.id}
                    onLoad={() => handleLoad(preset)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

function ShowCard({ preset, loading, onLoad }: { preset: WorldShowPreset; loading: boolean; onLoad: () => void }) {
  return (
    <div className="bg-surface-2 rounded-md border border-border/30 p-2.5 hover:border-primary/40 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-base">{preset.flag}</span>
            <h4 className="text-xs font-bold truncate">{preset.name}</h4>
          </div>
          <div className="flex items-center gap-1 mt-0.5 text-[10px] text-muted-foreground">
            <MapPin className="w-3 h-3" />
            <span className="truncate">{preset.location}</span>
          </div>
        </div>
        <Button
          size="sm"
          className="h-7 text-[10px] px-2.5 shrink-0"
          onClick={onLoad}
          disabled={loading}
        >
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3 mr-1" />}
          {loading ? 'Carregando...' : 'Carregar'}
        </Button>
      </div>

      <p className="text-[10px] text-muted-foreground mt-1.5 leading-relaxed line-clamp-2">
        {preset.description}
      </p>

      <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
        <div className="flex items-center gap-0.5">
          <Crosshair className="w-3 h-3" />
          <span>{preset.stats.positions} pos</span>
        </div>
        <div className="flex items-center gap-0.5">
          <Sparkles className="w-3 h-3" />
          <span>{preset.stats.cues} cues</span>
        </div>
        <div className="flex items-center gap-0.5">
          <Clock className="w-3 h-3" />
          <span>{Math.round(preset.duration / 60)} min</span>
        </div>
        <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">
          {preset.stats.calibers}
        </Badge>
      </div>
    </div>
  );
}
