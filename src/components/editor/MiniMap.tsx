import { useEffect, useRef, useState } from 'react';
import { useProjectStore } from '@/store/useProjectStore';
import { supabase } from '@/integrations/supabase/client';
import { MapPin, Maximize2, Minimize2 } from 'lucide-react';
import { cn } from '@/lib/utils';

function loadGoogleMapsScript(apiKey: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as any).google?.maps) { resolve(); return; }
    const existing = document.getElementById('google-maps-script');
    if (existing) {
      existing.addEventListener('load', () => resolve());
      return;
    }
    const script = document.createElement('script');
    script.id = 'google-maps-script';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,geometry&v=weekly`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Maps'));
    document.head.appendChild(script);
  });
}

export default function MiniMap() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const circleRef = useRef<google.maps.Circle | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState(false);
  const gpsOrigin = useProjectStore((s) => s.gpsOrigin);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        const { data, error: fnError } = await supabase.functions.invoke('get-maps-key');
        if (fnError || !data?.key || cancelled) { setError(true); return; }
        await loadGoogleMapsScript(data.key);
        if (cancelled || !mapRef.current) return;

        const map = new google.maps.Map(mapRef.current, {
          center: { lat: gpsOrigin.lat, lng: gpsOrigin.lng },
          zoom: 16,
          mapTypeId: 'satellite',
          disableDefaultUI: true,
          gestureHandling: 'greedy',
          keyboardShortcuts: false,
          backgroundColor: '#0a0a0a',
        });

        const marker = new google.maps.Marker({
          position: { lat: gpsOrigin.lat, lng: gpsOrigin.lng },
          map,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: '#f97316',
            fillOpacity: 1,
            strokeColor: '#fff',
            strokeWeight: 2,
          },
          title: 'Show Origin',
        });

        const circle = new google.maps.Circle({
          map,
          center: { lat: gpsOrigin.lat, lng: gpsOrigin.lng },
          radius: 80,
          fillColor: '#3b82f6',
          fillOpacity: 0.08,
          strokeColor: '#3b82f6',
          strokeWeight: 1,
          strokeOpacity: 0.4,
        });

        mapInstanceRef.current = map;
        markerRef.current = marker;
        circleRef.current = circle;
        setLoaded(true);
      } catch {
        setError(true);
      }
    }
    init();
    return () => { cancelled = true; };
  }, []);

  // Update position when gpsOrigin changes
  useEffect(() => {
    if (!mapInstanceRef.current || !markerRef.current || !circleRef.current) return;
    const pos = { lat: gpsOrigin.lat, lng: gpsOrigin.lng };
    mapInstanceRef.current.panTo(pos);
    markerRef.current.setPosition(pos);
    circleRef.current.setCenter(pos);
  }, [gpsOrigin.lat, gpsOrigin.lng]);

  if (error) return null;

  return (
    <div
      className={cn(
        "absolute bottom-12 left-3 rounded-lg overflow-hidden border border-border/40 shadow-2xl transition-all duration-300 group",
        expanded ? "w-72 h-52" : "w-40 h-28"
      )}
    >
      {/* Map container */}
      <div ref={mapRef} className="w-full h-full bg-surface-0" />

      {/* Overlay controls */}
      <div className="absolute top-1.5 left-1.5 flex items-center gap-1">
        <div className="bg-surface-0/80 backdrop-blur-sm rounded px-1.5 py-0.5 flex items-center gap-1">
          <MapPin className="w-2.5 h-2.5 text-safety" />
          <span className="text-[8px] font-mono-code text-foreground/80">
            {gpsOrigin.lat.toFixed(3)}°, {gpsOrigin.lng.toFixed(3)}°
          </span>
        </div>
      </div>

      <button
        onClick={() => setExpanded(!expanded)}
        className="absolute top-1.5 right-1.5 w-5 h-5 bg-surface-0/80 backdrop-blur-sm rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
      >
        {expanded
          ? <Minimize2 className="w-3 h-3 text-foreground/70" />
          : <Maximize2 className="w-3 h-3 text-foreground/70" />
        }
      </button>

      {!loaded && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-surface-0">
          <div className="w-4 h-4 border border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}
