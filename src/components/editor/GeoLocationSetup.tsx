/**
 * GeoLocationSetup — Overlay HTML leve para seleção de local.
 * Substitui o GlobeSelector pesado (Canvas 3D separado).
 * Fix de Performance WebGL / Contexto único.
 */
import { useState, useCallback, useMemo } from 'react';
import { triggerFlyTo } from '@/core/geo/GeoCameraController';
import { Search, X, MapPin, Navigation } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useSceneStore } from '@/store/useSceneStore';
import { useProjectStore } from '@/store/useProjectStore';
import { cn } from '@/lib/utils';

// Reutiliza a base de cidades do GlobeSelector
const CITIES = [
  { name: 'São Paulo, Brasil', lat: -23.5505, lng: -46.6333, icon: '🇧🇷' },
  { name: 'Rio de Janeiro, Brasil', lat: -22.9068, lng: -43.1729, icon: '🇧🇷' },
  { name: 'Copacabana Beach, Rio', lat: -22.9711, lng: -43.1823, icon: '🏖️' },
  { name: 'Angra dos Reis, Brasil', lat: -23.007, lng: -44.318, icon: '🏝️' },
  { name: 'Brasília, Brasil', lat: -15.7801, lng: -47.9292, icon: '🇧🇷' },
  { name: 'Belo Horizonte, Brasil', lat: -19.9167, lng: -43.9345, icon: '🇧🇷' },
  { name: 'Florianópolis, Brasil', lat: -27.5954, lng: -48.548, icon: '🇧🇷' },
  { name: 'Dubai, UAE', lat: 25.2048, lng: 55.2708, icon: '🇦🇪' },
  { name: 'New York, USA', lat: 40.7128, lng: -74.006, icon: '🇺🇸' },
  { name: 'Las Vegas, USA', lat: 36.1699, lng: -115.1398, icon: '🎰' },
  { name: 'London, UK', lat: 51.5074, lng: -0.1278, icon: '🇬🇧' },
  { name: 'Paris, France', lat: 48.8566, lng: 2.3522, icon: '🇫🇷' },
  { name: 'Tokyo, Japan', lat: 35.6762, lng: 139.6503, icon: '🇯🇵' },
  { name: 'Sydney, Australia', lat: -33.8688, lng: 151.2093, icon: '🇦🇺' },
  { name: 'Singapore', lat: 1.3521, lng: 103.8198, icon: '🇸🇬' },
  { name: 'Cape Town, South Africa', lat: -33.9249, lng: 18.4241, icon: '🇿🇦' },
  { name: 'NEOM, Saudi Arabia', lat: 28.0, lng: 35.0, icon: '🏗️' },
  { name: 'Buenos Aires, Argentina', lat: -34.6037, lng: -58.3816, icon: '🇦🇷' },
  { name: 'Mexico City, Mexico', lat: 19.4326, lng: -99.1332, icon: '🇲🇽' },
  { name: 'Seoul, South Korea', lat: 37.5665, lng: 126.978, icon: '🇰🇷' },
];

interface GeoLocationSetupProps {
  onClose: () => void;
}

export default function GeoLocationSetup({ onClose }: GeoLocationSetupProps) {
  const [search, setSearch] = useState('');
  const { updateSettings, settings } = useSceneStore();

  const filtered = useMemo(() => {
    if (!search.trim()) return CITIES;
    const q = search.toLowerCase();
    return CITIES.filter(c => c.name.toLowerCase().includes(q));
  }, [search]);

  const handleSelect = useCallback((city: typeof CITIES[0]) => {
    // Atualiza anchor do geo-engine
    updateSettings({
      geoAnchorLat: city.lat,
      geoAnchorLon: city.lng,
      geoAnchorAlt: 0,
      floatingOriginEnabled: true,
      google3DTilesEnabled: true,
    });
    // Atualiza GPS origin no project store
    useProjectStore.getState().setGpsOrigin({
      lat: city.lat,
      lng: city.lng,
      heading: 0,
      altitude: 0,
    });
    // Fly-to suave com easing — transição cinematográfica
    triggerFlyTo({
      lat: city.lat,
      lng: city.lng,
      alt: 300,
      duration: 3,
      pitch: 45,
    });
    // Delay para o usuário ver o início da animação
    setTimeout(onClose, 500);
  }, [updateSettings, onClose]);

  return (
    <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 w-[380px] max-w-[90vw]">
      <div
        className="rounded-xl border border-border/40 shadow-2xl overflow-hidden"
        style={{
          background: 'hsl(var(--card) / 0.92)',
          backdropFilter: 'blur(20px) saturate(1.4)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/20">
          <div className="flex items-center gap-2">
            <Navigation className="w-3.5 h-3.5 text-primary" />
            <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-foreground/80">
              Geo-Location Setup
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-muted/30 transition-colors"
          >
            <X className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 pt-3 pb-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search Location (Google Earth) | Angra dos Reis, RJ, Brazil"
              className="h-8 text-[11px] pl-8 bg-muted/10 border-border/20 placeholder:text-muted-foreground/40"
              autoFocus
            />
          </div>
          {/* Coordenadas atuais */}
          <div className="flex items-center gap-1.5 mt-1.5 px-1">
            <MapPin className="w-2.5 h-2.5 text-primary/60" />
            <span className="text-[9px] font-mono text-muted-foreground/60">
              Lat: {settings.geoAnchorLat.toFixed(4)}, Lon: {settings.geoAnchorLon.toFixed(4)}
            </span>
          </div>
        </div>

        {/* Lista de cidades */}
        <div className="max-h-[280px] overflow-y-auto px-2 pb-2">
          {filtered.map(city => (
            <button
              key={city.name}
              onClick={() => handleSelect(city)}
              className={cn(
                "w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all",
                "hover:bg-primary/10 border border-transparent hover:border-primary/20",
                settings.geoAnchorLat === city.lat && settings.geoAnchorLon === city.lng
                  ? "bg-primary/15 border-primary/30"
                  : ""
              )}
            >
              <span className="text-base">{city.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-semibold text-foreground truncate">{city.name}</div>
                <div className="text-[9px] font-mono text-muted-foreground/50">
                  {city.lat.toFixed(4)}, {city.lng.toFixed(4)}
                </div>
              </div>
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="text-center py-6">
              <span className="text-[10px] text-muted-foreground/40">Nenhum local encontrado</span>
            </div>
          )}
        </div>

        {/* Footer — Skip */}
        <div className="px-4 py-2.5 border-t border-border/20 flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-7 text-[10px] uppercase tracking-wider text-muted-foreground/60 hover:text-foreground"
          >
            Skip →
          </Button>
        </div>
      </div>
    </div>
  );
}
