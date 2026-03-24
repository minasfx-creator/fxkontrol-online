/**
 * GeoSearchPanel — Location search with preset venues & manual GPS dropper.
 * No Google API key required — uses a curated preset database.
 */
import { useState, useCallback } from 'react';
import { MapPin, Search, Navigation, Copy, Check } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useSceneStore } from '@/store/useSceneStore';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface GeoPreset {
  name: string;
  lat: number;
  lon: number;
  alt: number;
  description: string;
  emoji: string;
}

const GEO_PRESETS: GeoPreset[] = [
  { name: 'Angra dos Reis', lat: -23.007, lon: -44.318, alt: 0, description: 'Baía da Ilha Grande — Balsas', emoji: '🏝️' },
  { name: 'Copacabana', lat: -22.9711, lon: -43.1822, alt: 0, description: 'Réveillon — Orla', emoji: '🎆' },
  { name: 'Marina da Glória', lat: -22.9244, lon: -43.1729, alt: 0, description: 'Rio de Janeiro — Marina', emoji: '⛵' },
  { name: 'Lagoa Rodrigo de Freitas', lat: -22.9714, lon: -43.2057, alt: 0, description: 'Árvore de Natal — Lagoa', emoji: '🎄' },
  { name: 'Ponte JK — Brasília', lat: -15.8267, lon: -47.8286, alt: 1000, description: 'Lago Paranoá', emoji: '🌉' },
  { name: 'Ibirapuera — São Paulo', lat: -23.5874, lon: -46.6576, alt: 760, description: 'Parque Ibirapuera', emoji: '🏞️' },
  { name: 'Dubai Festival City', lat: 25.2285, lon: 55.3521, alt: 0, description: 'Creek — Waterfront', emoji: '🏙️' },
  { name: 'Sydney Harbour', lat: -33.8568, lon: 151.2153, alt: 0, description: 'Opera House — NYE', emoji: '🎇' },
  { name: 'Custom', lat: 0, lon: 0, alt: 0, description: 'Enter GPS manually', emoji: '📍' },
];

function toDMS(decimal: number, isLat: boolean): string {
  const abs = Math.abs(decimal);
  const d = Math.floor(abs);
  const m = Math.floor((abs - d) * 60);
  const s = ((abs - d - m / 60) * 3600).toFixed(1);
  const dir = isLat ? (decimal >= 0 ? 'N' : 'S') : (decimal >= 0 ? 'E' : 'W');
  return `${d}°${m}'${s}"${dir}`;
}

export default function GeoSearchPanel() {
  const { settings, updateSettings } = useSceneStore();
  const [query, setQuery] = useState('');
  const [copied, setCopied] = useState(false);

  const filtered = query.trim()
    ? GEO_PRESETS.filter(p =>
        p.name.toLowerCase().includes(query.toLowerCase()) ||
        p.description.toLowerCase().includes(query.toLowerCase())
      )
    : GEO_PRESETS;

  const applyPreset = useCallback((preset: GeoPreset) => {
    if (preset.name === 'Custom') return;
    updateSettings({
      geoAnchorLat: preset.lat,
      geoAnchorLon: preset.lon,
      geoAnchorAlt: preset.alt,
      floatingOriginEnabled: true,
    });
    setQuery('');
    toast.success(`📍 Origem: ${preset.name}`);
  }, [updateSettings]);

  const copyCoords = useCallback(() => {
    const text = `${settings.geoAnchorLat.toFixed(6)}, ${settings.geoAnchorLon.toFixed(6)}, ${settings.geoAnchorAlt.toFixed(1)}m`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
    toast.success('Coordenadas copiadas');
  }, [settings.geoAnchorLat, settings.geoAnchorLon, settings.geoAnchorAlt]);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <Navigation className="w-3 h-3 text-primary" />
        <span className="text-[8px] text-muted-foreground font-bold uppercase tracking-wider">Geo Search</span>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground/50" />
        <Input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Buscar local..."
          className="h-7 text-[10px] pl-7 bg-muted/10 border-border/20"
        />
      </div>

      {/* Presets */}
      {(query.trim() || !settings.floatingOriginEnabled) && (
        <div className="max-h-32 overflow-y-auto space-y-0.5 rounded-md border border-border/10 bg-card/10 p-1">
          {filtered.map(p => {
            const isActive =
              settings.geoAnchorLat === p.lat &&
              settings.geoAnchorLon === p.lon;
            return (
              <button
                key={p.name}
                onClick={() => applyPreset(p)}
                disabled={p.name === 'Custom'}
                className={cn(
                  "w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-md transition-all",
                  isActive
                    ? "bg-primary/15 border border-primary/30"
                    : "hover:bg-muted/20 border border-transparent",
                  p.name === 'Custom' && "opacity-40"
                )}
              >
                <span className="text-sm">{p.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-[9px] font-bold text-foreground truncate">{p.name}</div>
                  <div className="text-[7px] text-muted-foreground truncate">{p.description}</div>
                </div>
                {isActive && <MapPin className="w-3 h-3 text-primary shrink-0" />}
              </button>
            );
          })}
          {filtered.length === 0 && (
            <div className="text-center py-2">
              <span className="text-[8px] text-muted-foreground/50">Nenhum local encontrado</span>
            </div>
          )}
        </div>
      )}

      {/* Current Anchor Display */}
      {settings.floatingOriginEnabled && (
        <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-md border border-primary/10 bg-primary/5">
          <MapPin className="w-3 h-3 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-[8px] font-mono text-foreground/80 truncate">
              {toDMS(settings.geoAnchorLat, true)} {toDMS(settings.geoAnchorLon, false)}
            </div>
            <div className="text-[7px] text-muted-foreground">
              Alt: {settings.geoAnchorAlt.toFixed(1)}m MSL
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-5 w-5 p-0"
            onClick={copyCoords}
          >
            {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3 text-muted-foreground" />}
          </Button>
        </div>
      )}
    </div>
  );
}
