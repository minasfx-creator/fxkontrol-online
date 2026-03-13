/// <reference types="google.maps" />
import { useEffect, useRef, useState, useCallback } from 'react';
import { useProjectStore } from '@/store/useProjectStore';
import { MapPin, Navigation, Crosshair, Layers, X, Globe, Locate, Copy, Ruler, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { exportFormationsToKML, downloadFile } from '@/lib/exportEngine';

interface GeoLocation {
  lat: number;
  lng: number;
  heading: number; // degrees from north
  altitude: number; // meters
}

const DEFAULT_LOCATION: GeoLocation = {
  lat: -23.5505, lng: -46.6333, heading: 0, altitude: 0, // São Paulo
};

// Load Google Maps script dynamically
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

export default function GoogleMapsPanel({ onClose }: { onClose: () => void }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const circleRef = useRef<google.maps.Circle | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mapType, setMapType] = useState<'satellite' | 'hybrid' | 'terrain'>('hybrid');
  const [showDrones, setShowDrones] = useState(true);
  const [showGeofence, setShowGeofence] = useState(true);

  const positions = useProjectStore((s) => s.positions);
  const droneFormations = useProjectStore((s) => s.droneFormations);
  const trajectories = useProjectStore((s) => s.trajectories);
  const projectName = useProjectStore((s) => s.projectName);
  const gpsOrigin = useProjectStore((s) => s.gpsOrigin);
  const setGpsOrigin = useProjectStore((s) => s.setGpsOrigin);

  const location = gpsOrigin;

  // Initialize map
  useEffect(() => {
    async function init() {
      try {
        const { data, error: fnError } = await supabase.functions.invoke('get-maps-key');
        if (fnError || !data?.key) {
          setError('Google Maps API Key não configurada');
          return;
        }

        await loadGoogleMapsScript(data.key);
        if (!mapRef.current) return;

        const map = new google.maps.Map(mapRef.current, {
          center: { lat: location.lat, lng: location.lng },
          zoom: 18,
          mapTypeId: mapType,
          tilt: 45,
          heading: location.heading,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          zoomControl: true,
          styles: [
            { elementType: 'labels', stylers: [{ visibility: 'simplified' }] },
            { featureType: 'poi', stylers: [{ visibility: 'off' }] },
          ],
        });

        mapInstanceRef.current = map;

        map.addListener('click', (e: google.maps.MapMouseEvent) => {
          if (!e.latLng) return;
          const lat = e.latLng.lat();
          const lng = e.latLng.lng();
          setGpsOrigin({ ...gpsOrigin, lat, lng });
          toast.success(`Origem: ${lat.toFixed(6)}, ${lng.toFixed(6)}`);
        });

        setLoaded(true);
      } catch (err: any) {
        setError(err.message || 'Erro ao carregar Google Maps');
      }
    }
    init();
  }, []);

  // Update map type
  useEffect(() => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setMapTypeId(mapType);
    }
  }, [mapType]);

  // Update markers for drone positions
  useEffect(() => {
    if (!mapInstanceRef.current || !loaded || !showDrones) return;

    // Clear old markers
    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];

    // Add position markers
    positions.forEach((pos) => {
      const latOffset = pos.z * 0.000009; // ~1m in lat
      const lngOffset = pos.x * 0.000011; // ~1m in lng at mid-latitudes
      const marker = new google.maps.Marker({
        position: {
          lat: location.lat + latOffset,
          lng: location.lng + lngOffset,
        },
        map: mapInstanceRef.current!,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 4,
          fillColor: pos.color || '#00B4D8',
          fillOpacity: 0.9,
          strokeColor: '#ffffff',
          strokeWeight: 1,
        },
        title: pos.name,
      });
      markersRef.current.push(marker);
    });

    // Add formation drone markers if available
    if (droneFormations.length > 0) {
      const formation = droneFormations[0];
      formation.points.slice(0, Math.min(formation.droneCount, 200)).forEach((pt, i) => {
        const latOffset = pt.z * 0.000009;
        const lngOffset = pt.x * 0.000011;
        const marker = new google.maps.Marker({
          position: {
            lat: location.lat + latOffset,
            lng: location.lng + lngOffset,
          },
          map: mapInstanceRef.current!,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 3,
            fillColor: formation.color || '#00ff88',
            fillOpacity: 0.7,
            strokeColor: '#ffffff',
            strokeWeight: 0.5,
          },
          title: `Drone ${i + 1}`,
        });
        markersRef.current.push(marker);
      });
    }
  }, [positions, droneFormations, location, loaded, showDrones]);

  // Update geofence circle
  useEffect(() => {
    if (!mapInstanceRef.current || !loaded) return;

    if (circleRef.current) circleRef.current.setMap(null);

    if (showGeofence) {
      circleRef.current = new google.maps.Circle({
        map: mapInstanceRef.current,
        center: { lat: location.lat, lng: location.lng },
        radius: 80, // 80m geofence
        fillColor: '#ff4444',
        fillOpacity: 0.08,
        strokeColor: '#ff4444',
        strokeWeight: 1.5,
        strokeOpacity: 0.5,
      });

      // Inner safe zone
      new google.maps.Circle({
        map: mapInstanceRef.current,
        center: { lat: location.lat, lng: location.lng },
        radius: 40,
        fillColor: '#00ff44',
        fillOpacity: 0.05,
        strokeColor: '#00ff44',
        strokeWeight: 1,
        strokeOpacity: 0.3,
      });
    }
  }, [location, loaded, showGeofence]);

  const handleLocateMe = useCallback(() => {
    if (!navigator.geolocation) {
      toast.error('Geolocalização não suportada');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const newLoc = {
          ...location,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        setGpsOrigin(newLoc);
        mapInstanceRef.current?.panTo({ lat: newLoc.lat, lng: newLoc.lng });
        toast.success('Localização atualizada');
      },
      () => toast.error('Permissão de localização negada'),
    );
  }, [location]);

  const copyCoords = useCallback(() => {
    navigator.clipboard.writeText(`${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`);
    toast.success('Coordenadas copiadas');
  }, [location]);

  const handleExportKML = useCallback(() => {
    const kml = exportFormationsToKML(droneFormations, trajectories, positions, location, projectName);
    downloadFile(kml, `${projectName.replace(/\s+/g, '_')}_show.kml`, 'application/vnd.google-earth.kml+xml');
    toast.success('KML exportado — abra no Google Earth Pro');
  }, [droneFormations, trajectories, positions, location, projectName]);

  return (
    <div className="h-full flex flex-col bg-surface-0 border-l border-border">
      {/* Header */}
      <div className="flex items-center justify-between p-2 border-b border-border bg-surface-1">
        <div className="flex items-center gap-1.5">
          <Globe className="w-3.5 h-3.5 text-primary" />
          <span className="text-[10px] font-bold font-mono-code text-foreground tracking-wider uppercase">
            Google Maps · Site Survey
          </span>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Map container */}
      <div className="flex-1 relative min-h-0">
        {error ? (
          <div className="w-full h-full flex items-center justify-center p-4">
            <div className="text-center">
              <Globe className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">{error}</p>
            </div>
          </div>
        ) : (
          <div ref={mapRef} className="w-full h-full" />
        )}

        {/* Map overlay controls */}
        {loaded && (
          <div className="absolute top-2 left-2 flex flex-col gap-1">
            <button
              onClick={handleLocateMe}
              className="bg-surface-1/90 backdrop-blur p-1.5 rounded border border-border/50 hover:bg-surface-2 transition-all"
              title="Minha localização"
            >
              <Locate className="w-3.5 h-3.5 text-foreground" />
            </button>
            <button
              onClick={() => setMapType(t => t === 'hybrid' ? 'satellite' : t === 'satellite' ? 'terrain' : 'hybrid')}
              className="bg-surface-1/90 backdrop-blur p-1.5 rounded border border-border/50 hover:bg-surface-2 transition-all"
              title="Alternar tipo de mapa"
            >
              <Layers className="w-3.5 h-3.5 text-foreground" />
            </button>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="p-2 border-t border-border bg-surface-1 space-y-2">
        {/* Coordinates */}
        <div className="flex items-center gap-1.5">
          <MapPin className="w-3 h-3 text-primary flex-shrink-0" />
          <span className="text-[9px] font-mono-code text-muted-foreground flex-1">
            {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
          </span>
          <button onClick={copyCoords} className="text-muted-foreground hover:text-foreground" title="Copiar">
            <Copy className="w-3 h-3" />
          </button>
        </div>

        {/* Heading */}
        <div className="flex items-center gap-1.5">
          <Navigation className="w-3 h-3 text-primary flex-shrink-0" />
          <label className="text-[9px] font-mono-code text-muted-foreground">Heading</label>
          <input
            type="number"
            value={location.heading}
            onChange={(e) => {
              const h = Number(e.target.value) % 360;
              setGpsOrigin({ ...location, heading: h });
              mapInstanceRef.current?.setHeading(h);
            }}
            className="w-12 h-5 text-[9px] bg-surface-0 border border-border rounded px-1 text-foreground font-mono-code"
            min={0} max={359}
          />
          <span className="text-[8px] text-muted-foreground">°</span>
        </div>

        {/* Toggle buttons */}
        <div className="flex gap-1">
          <Button
            variant={showDrones ? 'outline' : 'ghost'}
            size="sm"
            className="flex-1 h-5 text-[8px] gap-0.5"
            onClick={() => setShowDrones(!showDrones)}
          >
            <Crosshair className="w-2.5 h-2.5" />
            Drones
          </Button>
          <Button
            variant={showGeofence ? 'outline' : 'ghost'}
            size="sm"
            className="flex-1 h-5 text-[8px] gap-0.5"
            onClick={() => setShowGeofence(!showGeofence)}
          >
            <Ruler className="w-2.5 h-2.5" />
            Geofence
          </Button>
        </div>

        {/* KML Export */}
        <Button
          variant="outline"
          size="sm"
          className="w-full h-6 text-[8px] gap-1"
          onClick={handleExportKML}
        >
          <Download className="w-2.5 h-2.5" />
          Exportar KML (Google Earth)
        </Button>
        <div className="flex gap-1 flex-wrap">
          {[
            { label: 'São Paulo', lat: -23.5505, lng: -46.6333 },
            { label: 'Copacabana', lat: -22.9711, lng: -43.1822 },
            { label: 'Dubai', lat: 25.2048, lng: 55.2708 },
            { label: 'Las Vegas', lat: 36.1699, lng: -115.1398 },
          ].map((preset) => (
            <button
              key={preset.label}
            onClick={() => {
                setGpsOrigin({ ...location, lat: preset.lat, lng: preset.lng });
                mapInstanceRef.current?.panTo({ lat: preset.lat, lng: preset.lng });
              }}
              className="text-[7px] font-mono-code px-1.5 py-0.5 rounded bg-surface-0 border border-border/50 text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-all"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
