/**
 * MobileWelcomeScreen — Initial location chooser for mobile.
 * Three options: generic world, device GPS, or manual search.
 */
import { useState, useCallback } from 'react';
import { Globe, Navigation, MapPin, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { haptics } from '@/lib/haptics';
import { useSceneStore } from '@/store/useSceneStore';
import { useProjectStore } from '@/store/useProjectStore';
import { triggerFlyTo } from '@/core/geo/GeoCameraController';
import { fetchGeoIntelligence } from '@/services/googleGeoIntelligence';

interface MobileWelcomeScreenProps {
  onComplete: (mode: 'generic' | 'gps' | 'search') => void;
}

const STORAGE_KEY = 'fxk-mobile-location-set';

export function hasCompletedWelcome(): boolean {
  try { return localStorage.getItem(STORAGE_KEY) === '1'; } catch { return false; }
}

export function markWelcomeComplete(): void {
  try { localStorage.setItem(STORAGE_KEY, '1'); } catch {}
}

export default function MobileWelcomeScreen({ onComplete }: MobileWelcomeScreenProps) {
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const updateSettings = useSceneStore(s => s.updateSettings);

  const handleGeneric = useCallback(() => {
    haptics.tap();
    markWelcomeComplete();
    onComplete('generic');
  }, [onComplete]);

  const handleGPS = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsError('GPS não disponível');
      return;
    }
    haptics.select();
    setGpsLoading(true);
    setGpsError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude: lat, longitude: lng } = position.coords;

        window.dispatchEvent(new CustomEvent('viewport-transition', {
          detail: { locationName: 'Sua Localização', holdMs: 1200 },
        }));

        setTimeout(() => {
          updateSettings({
            geoAnchorLat: lat,
            geoAnchorLon: lng,
            geoAnchorAlt: 0,
            floatingOriginEnabled: true,
            google3DTilesEnabled: true,
          });
          const store = useProjectStore.getState();
          store.setGpsOrigin({ lat, lng, heading: 0, altitude: 0 });
          triggerFlyTo({ lat, lng, alt: 300, duration: 2.5, pitch: 45 });

          fetchGeoIntelligence(lat, lng).then((intel) => {
            useProjectStore.getState().setGeoIntelligence({
              locationName: intel.locationShortName || intel.locationName || null,
              timeZoneId: intel.timeZoneId || null,
              timeZoneOffset: intel.totalOffset ?? null,
              terrainElevation: intel.elevation ?? null,
              staticMapUrl: intel.staticMapUrl || null,
            });
          });
        }, 450);

        setGpsLoading(false);
        markWelcomeComplete();
        onComplete('gps');
      },
      (err) => {
        setGpsLoading(false);
        setGpsError(err.code === 1 ? 'Permissão negada' : 'Erro ao obter localização');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [onComplete, updateSettings]);

  const handleSearch = useCallback(() => {
    haptics.tap();
    markWelcomeComplete();
    onComplete('search');
  }, [onComplete]);

  const options = [
    {
      id: 'generic' as const,
      icon: Globe,
      title: 'Mundo Genérico',
      desc: 'Grid isométrico padrão',
      onClick: handleGeneric,
      color: 'primary',
    },
    {
      id: 'gps' as const,
      icon: Navigation,
      title: 'Minha Localização',
      desc: gpsError || 'Usar GPS do dispositivo',
      onClick: handleGPS,
      color: 'accent',
      loading: gpsLoading,
      error: !!gpsError,
    },
    {
      id: 'search' as const,
      icon: MapPin,
      title: 'Escolher Local',
      desc: 'Buscar endereço ou cidade',
      onClick: handleSearch,
      color: 'primary',
    },
  ];

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center pointer-events-auto"
      style={{ background: 'linear-gradient(to top, hsl(var(--background) / 0.95), hsl(var(--background) / 0.6) 50%, transparent)' }}
    >
      <div className="w-full max-w-sm mx-4 mb-8 space-y-3 animate-in slide-in-from-bottom-8 fade-in-0 duration-500"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {/* Title */}
        <div className="text-center mb-6">
          <h2 className="text-lg font-bold text-foreground tracking-tight">Onde vamos criar?</h2>
          <p className="text-[11px] text-muted-foreground mt-1">Escolha como iniciar seu projeto</p>
        </div>

        {/* Options */}
        {options.map(({ id, icon: Icon, title, desc, onClick, color, loading, error }) => (
          <button
            key={id}
            onClick={onClick}
            disabled={loading}
            className={cn(
              "w-full flex items-center gap-4 px-5 py-4 rounded-2xl transition-all active:scale-[0.97]",
              "border border-border/30",
              "disabled:opacity-60",
            )}
            style={{
              background: 'hsl(var(--card) / 0.85)',
              backdropFilter: 'blur(20px) saturate(1.4)',
            }}
          >
            <div className={cn(
              "w-12 h-12 rounded-xl flex items-center justify-center shrink-0",
              color === 'accent' ? 'bg-accent/15' : 'bg-primary/10'
            )}>
              {loading ? (
                <Loader2 className="w-5 h-5 text-accent animate-spin" />
              ) : (
                <Icon className={cn("w-5 h-5", color === 'accent' ? 'text-accent' : 'text-primary', id === 'gps' && gpsLoading && 'animate-pulse')} />
              )}
            </div>
            <div className="flex-1 text-left min-w-0">
              <div className="text-[13px] font-semibold text-foreground">{title}</div>
              <div className={cn("text-[10px] mt-0.5", error ? 'text-destructive' : 'text-muted-foreground/60')}>{desc}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
