/**
 * GeoLocationSetup — Location selection overlay.
 * Responsive: fullscreen bottom sheet on mobile, centered card on desktop.
 * Includes Google Places search and device geolocation.
 */
import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { triggerFlyTo } from '@/core/geo/GeoCameraController';
import { fetchGeoIntelligence } from '@/services/googleGeoIntelligence';
import { Search, X, MapPin, Navigation, Globe, Loader2, Crosshair } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useSceneStore } from '@/store/useSceneStore';
import { useProjectStore } from '@/store/useProjectStore';
import { supabase } from '@/integrations/supabase/client';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

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

interface PlaceResult {
  name: string;
  lat: number;
  lng: number;
  formattedAddress: string;
}

interface GeoLocationSetupProps {
  onClose: () => void;
}

export default function GeoLocationSetup({ onClose }: GeoLocationSetupProps) {
  const isMobile = useIsMobile();
  const [search, setSearch] = useState('');
  const [apiResults, setApiResults] = useState<PlaceResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const updateSettings = useSceneStore(s => s.updateSettings);
  const settings = useSceneStore(s => s.settings);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const filtered = useMemo(() => {
    if (!search.trim()) return CITIES;
    const q = search.toLowerCase();
    return CITIES.filter(c => c.name.toLowerCase().includes(q));
  }, [search]);

  // Debounced Google Places search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (search.trim().length < 3) {
      setApiResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const { data, error } = await supabase.functions.invoke('google-places-search', {
          body: { query: search.trim() },
        });
        if (error) { setApiResults([]); }
        else { setApiResults(data?.results || []); }
      } catch { setApiResults([]); }
      finally { setSearching(false); }
    }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search]);

  const handleSelect = useCallback((city: { lat: number; lng: number; name?: string }) => {
    window.dispatchEvent(new CustomEvent('viewport-transition', {
      detail: { locationName: city.name || 'New Location', holdMs: 1200 },
    }));
    setTimeout(() => {
      updateSettings({
        geoAnchorLat: city.lat,
        geoAnchorLon: city.lng,
        geoAnchorAlt: 0,
        floatingOriginEnabled: true,
        google3DTilesEnabled: true,
      });
      const store = useProjectStore.getState();
      store.setGpsOrigin({ lat: city.lat, lng: city.lng, heading: 0, altitude: 0 });
      triggerFlyTo({ lat: city.lat, lng: city.lng, alt: 300, duration: 2.5, pitch: 45 });
      fetchGeoIntelligence(city.lat, city.lng).then((intel) => {
        useProjectStore.getState().setGeoIntelligence({
          locationName: intel.locationShortName || intel.locationName || city.name || null,
          timeZoneId: intel.timeZoneId || null,
          timeZoneOffset: intel.totalOffset ?? null,
          terrainElevation: intel.elevation ?? null,
          staticMapUrl: intel.staticMapUrl || null,
        });
      });
    }, 450);
    setTimeout(onClose, 600);
  }, [updateSettings, onClose]);

  const handleDeviceGPS = useCallback(() => {
    if (!navigator.geolocation) { setGpsError('GPS não disponível'); return; }
    setGpsLoading(true);
    setGpsError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsLoading(false);
        handleSelect({ lat: pos.coords.latitude, lng: pos.coords.longitude, name: 'Sua Localização' });
      },
      (err) => {
        setGpsLoading(false);
        setGpsError(err.code === 1 ? 'Permissão negada' : 'Erro ao obter GPS');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [handleSelect]);

  const hasSearch = search.trim().length > 0;
  const noResults = hasSearch && filtered.length === 0 && apiResults.length === 0 && !searching;

  // Mobile: fullscreen bottom sheet
  const wrapperClass = isMobile
    ? "fixed inset-0 z-[60] flex flex-col"
    : "absolute top-16 left-1/2 -translate-x-1/2 z-50 w-[380px] max-w-[90vw]";

  const cardClass = isMobile
    ? "flex-1 flex flex-col rounded-t-2xl mt-auto max-h-[85vh] border border-border/40 shadow-2xl overflow-hidden"
    : "rounded-xl border border-border/40 shadow-2xl overflow-hidden";

  return (
    <div className={wrapperClass}>
      {/* Mobile backdrop */}
      {isMobile && <div className="flex-1 min-h-[15vh]" onClick={onClose} />}

      <div className={cardClass}
        style={{ background: 'hsl(var(--card) / 0.92)', backdropFilter: 'blur(20px) saturate(1.4)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/20 shrink-0">
          <div className="flex items-center gap-2">
            <Navigation className="w-3.5 h-3.5 text-primary" />
            <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-foreground/80">
              Geo-Location Setup
            </span>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted/30 transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 pt-3 pb-2 shrink-0">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar endereço..."
              className="h-9 text-[12px] pl-8 pr-8 bg-muted/10 border-border/20 placeholder:text-muted-foreground/40"
              autoFocus={!isMobile}
            />
            {searching && (
              <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-primary animate-spin" />
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-1.5 px-1">
            <MapPin className="w-2.5 h-2.5 text-primary/60" />
            <span className="text-[9px] font-mono text-muted-foreground/60">
              Lat: {settings.geoAnchorLat.toFixed(4)}, Lon: {settings.geoAnchorLon.toFixed(4)}
            </span>
          </div>
        </div>

        {/* Scrollable list */}
        <div className="flex-1 overflow-y-auto px-2 pb-2 min-h-0">
          {/* Device GPS button */}
          <button
            onClick={handleDeviceGPS}
            disabled={gpsLoading}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-3 rounded-lg mb-1 transition-all",
              "bg-accent/10 border border-accent/20 hover:bg-accent/15 active:scale-[0.98]",
              "disabled:opacity-50"
            )}
          >
            {gpsLoading ? (
              <Loader2 className="w-4 h-4 text-accent animate-spin shrink-0" />
            ) : (
              <Crosshair className="w-4 h-4 text-accent shrink-0" />
            )}
            <div className="flex-1 text-left min-w-0">
              <div className="text-[11px] font-semibold text-accent">📍 Usar Minha Localização</div>
              <div className={cn("text-[9px]", gpsError ? 'text-destructive' : 'text-muted-foreground/50')}>
                {gpsError || 'GPS do dispositivo'}
              </div>
            </div>
          </button>

          {/* Preset cities */}
          {filtered.length > 0 && (
            <>
              {hasSearch && apiResults.length > 0 && (
                <div className="px-2 pt-1 pb-0.5">
                  <span className="text-[8px] font-bold uppercase tracking-wider text-muted-foreground/50">Presets</span>
                </div>
              )}
              {filtered.map(city => (
                <button
                  key={city.name}
                  onClick={() => handleSelect(city)}
                  className={cn(
                    "w-full text-left flex items-center gap-2.5 px-3 py-2.5 rounded-lg transition-all min-h-[44px]",
                    "hover:bg-primary/10 border border-transparent hover:border-primary/20 active:scale-[0.98]",
                    settings.geoAnchorLat === city.lat && settings.geoAnchorLon === city.lng
                      ? "bg-primary/15 border-primary/30" : ""
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
            </>
          )}

          {/* Google Places results */}
          {apiResults.length > 0 && (
            <>
              <div className="px-2 pt-2 pb-0.5">
                <div className="flex items-center gap-1">
                  <Globe className="w-2.5 h-2.5 text-primary/60" />
                  <span className="text-[8px] font-bold uppercase tracking-wider text-muted-foreground/50">Google Places</span>
                </div>
              </div>
              {apiResults.map((place, i) => (
                <button
                  key={`${place.lat}-${place.lng}-${i}`}
                  onClick={() => handleSelect(place)}
                  className={cn(
                    "w-full text-left flex items-center gap-2.5 px-3 py-2.5 rounded-lg transition-all min-h-[44px]",
                    "hover:bg-primary/10 border border-transparent hover:border-primary/20 active:scale-[0.98]"
                  )}
                >
                  <Globe className="w-4 h-4 text-primary/70 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-semibold text-foreground truncate">{place.name}</div>
                    <div className="text-[9px] text-muted-foreground/50 truncate">{place.formattedAddress}</div>
                  </div>
                </button>
              ))}
            </>
          )}

          {noResults && (
            <div className="text-center py-6">
              <span className="text-[10px] text-muted-foreground/40">Nenhum local encontrado</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-border/20 flex justify-end shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 text-[10px] uppercase tracking-wider text-muted-foreground/60 hover:text-foreground"
          >
            Fechar →
          </Button>
        </div>
      </div>
    </div>
  );
}
