/// <reference types="google.maps" />
import { useEffect, useRef, useState, useCallback } from 'react';
import { useProjectStore } from '@/store/useProjectStore';
import { MapPin, Navigation, Crosshair, Layers, X, Globe, Locate, Copy, Ruler, Download, Search, Play, Pause, SkipForward, Eye, EyeOff, Maximize2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { exportFormationsToKML, downloadFile } from '@/lib/exportEngine';
import { computeDronePositions } from './DroneChoreography';
import { pushLog } from './ViewportTerminal';

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
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,geometry,drawing&v=weekly`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Maps'));
    document.head.appendChild(script);
  });
}

const METERS_TO_LAT = 1 / 111320;
function metersToLng(lat: number) {
  return 1 / (111320 * Math.cos((lat * Math.PI) / 180));
}

function localToGps(
  x: number, y: number, z: number,
  origin: { lat: number; lng: number; heading: number },
) {
  const rad = (-origin.heading * Math.PI) / 180;
  const rx = x * Math.cos(rad) - z * Math.sin(rad);
  const rz = x * Math.sin(rad) + z * Math.cos(rad);
  return {
    lat: origin.lat - rz * METERS_TO_LAT,
    lng: origin.lng + rx * metersToLng(origin.lat),
    alt: y,
  };
}

// Formation color palette
const FORMATION_COLORS = [
  '#00B4D8', '#00ff88', '#FF6B6B', '#FFD93D', '#6BCB77',
  '#4D96FF', '#FF6EC7', '#845EC2', '#FF9671', '#00C9A7',
];

export default function GoogleMapsPanel({ onClose }: { onClose: () => void }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const liveMarkersRef = useRef<google.maps.Marker[]>([]);
  const circlesRef = useRef<google.maps.Circle[]>([]);
  const polylineRef = useRef<google.maps.Polyline | null>(null);
  const originMarkerRef = useRef<google.maps.Marker | null>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mapType, setMapType] = useState<'satellite' | 'hybrid' | 'terrain'>('hybrid');
  const [showDrones, setShowDrones] = useState(true);
  const [showGeofence, setShowGeofence] = useState(true);
  const [liveSync, setLiveSync] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFormationIdx, setActiveFormationIdx] = useState(0);
  const [showAllFormations, setShowAllFormations] = useState(false);
  const [measuring, setMeasuring] = useState(false);
  const [measurePoints, setMeasurePoints] = useState<google.maps.LatLng[]>([]);
  const [measureDist, setMeasureDist] = useState<number | null>(null);
  const liveSyncRef = useRef(false);

  const positions = useProjectStore((s) => s.positions);
  const droneFormations = useProjectStore((s) => s.droneFormations);
  const trajectories = useProjectStore((s) => s.trajectories);
  const projectName = useProjectStore((s) => s.projectName);
  const gpsOrigin = useProjectStore((s) => s.gpsOrigin);
  const setGpsOrigin = useProjectStore((s) => s.setGpsOrigin);
  const currentTime = useProjectStore((s) => s.currentTime);
  const isPlaying = useProjectStore((s) => s.isPlaying);

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

          // Measuring mode
          if (measuring) {
            setMeasurePoints(prev => {
              const next = [...prev, e.latLng!];
              if (next.length >= 2) {
                const dist = google.maps.geometry.spherical.computeDistanceBetween(next[0], next[next.length - 1]);
                setMeasureDist(dist);
              }
              return next;
            });
            return;
          }

          const lat = e.latLng.lat();
          const lng = e.latLng.lng();
          setGpsOrigin({ ...gpsOrigin, lat, lng });
          pushLog(`GPS origin → ${lat.toFixed(6)}, ${lng.toFixed(6)}`, 'info');
          toast.success(`Origem: ${lat.toFixed(6)}, ${lng.toFixed(6)}`);
        });

        // Setup Places Autocomplete
        if (searchInputRef.current) {
          const autocomplete = new google.maps.places.Autocomplete(searchInputRef.current, {
            fields: ['geometry', 'name', 'formatted_address'],
          });
          autocomplete.bindTo('bounds', map);
          autocomplete.addListener('place_changed', () => {
            const place = autocomplete.getPlace();
            if (!place.geometry?.location) {
              toast.error('Local não encontrado');
              return;
            }
            const lat = place.geometry.location.lat();
            const lng = place.geometry.location.lng();
            map.panTo({ lat, lng });
            map.setZoom(18);
            setGpsOrigin({ ...gpsOrigin, lat, lng });
            setSearchQuery(place.name || place.formatted_address || '');
            pushLog(`📍 Navegou para ${place.name || 'local'}`, 'success');
            toast.success(`📍 ${place.name || 'Local selecionado'}`);
          });
          autocompleteRef.current = autocomplete;
        }

        setLoaded(true);
        pushLog('Google Maps inicializado — clique para definir origem GPS', 'info');
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

  // Origin marker
  useEffect(() => {
    if (!mapInstanceRef.current || !loaded) return;
    if (originMarkerRef.current) originMarkerRef.current.setMap(null);

    originMarkerRef.current = new google.maps.Marker({
      position: { lat: location.lat, lng: location.lng },
      map: mapInstanceRef.current,
      icon: {
        path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
        scale: 5,
        rotation: location.heading,
        fillColor: '#FFD700',
        fillOpacity: 1,
        strokeColor: '#000000',
        strokeWeight: 1.5,
      },
      title: 'GPS Origin',
      zIndex: 999,
    });
  }, [location.lat, location.lng, location.heading, loaded]);

  // Update static markers for positions & formations
  useEffect(() => {
    if (!mapInstanceRef.current || !loaded || !showDrones || liveSync) return;

    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];

    // Positions (pyro/drone pads)
    positions.forEach((pos) => {
      const gps = localToGps(pos.x, pos.y, pos.z, location);
      const marker = new google.maps.Marker({
        position: { lat: gps.lat, lng: gps.lng },
        map: mapInstanceRef.current!,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 5,
          fillColor: pos.color || '#00B4D8',
          fillOpacity: 0.9,
          strokeColor: '#ffffff',
          strokeWeight: 1.5,
        },
        title: `${pos.name} (${pos.type})`,
      });
      markersRef.current.push(marker);
    });

    // Formations
    const formationsToShow = showAllFormations
      ? droneFormations
      : droneFormations.length > activeFormationIdx
        ? [droneFormations[activeFormationIdx]]
        : [];

    formationsToShow.forEach((formation, fIdx) => {
      const color = FORMATION_COLORS[fIdx % FORMATION_COLORS.length];
      const maxPoints = Math.min(formation.droneCount, 300);
      formation.points.slice(0, maxPoints).forEach((pt, i) => {
        const gps = localToGps(pt.x, formation.height, pt.z, location);
        const marker = new google.maps.Marker({
          position: { lat: gps.lat, lng: gps.lng },
          map: mapInstanceRef.current!,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: showAllFormations ? 2 : 3,
            fillColor: formation.color || color,
            fillOpacity: showAllFormations ? 0.5 : 0.8,
            strokeColor: '#ffffff',
            strokeWeight: 0.5,
          },
          title: `${formation.formationType} · Drone ${i + 1} · ${formation.height}m`,
        });
        markersRef.current.push(marker);
      });
    });
  }, [positions, droneFormations, location, loaded, showDrones, liveSync, activeFormationIdx, showAllFormations]);

  // Live sync
  useEffect(() => {
    liveSyncRef.current = liveSync;
  }, [liveSync]);

  useEffect(() => {
    if (!mapInstanceRef.current || !loaded || !liveSyncRef.current || !showDrones) return;

    const livePositions = computeDronePositions(droneFormations, currentTime);
    if (!livePositions) {
      liveMarkersRef.current.forEach(m => m.setMap(null));
      liveMarkersRef.current = [];
      return;
    }

    while (liveMarkersRef.current.length > livePositions.length) {
      liveMarkersRef.current.pop()?.setMap(null);
    }

    livePositions.forEach((dp, i) => {
      const gps = localToGps(dp.x, dp.y, dp.z, location);
      const pos = { lat: gps.lat, lng: gps.lng };

      if (i < liveMarkersRef.current.length) {
        liveMarkersRef.current[i].setPosition(pos);
        liveMarkersRef.current[i].setIcon({
          path: google.maps.SymbolPath.CIRCLE,
          scale: 3,
          fillColor: dp.color,
          fillOpacity: 0.9,
          strokeColor: '#ffffff',
          strokeWeight: 0.5,
        });
      } else {
        const marker = new google.maps.Marker({
          position: pos,
          map: mapInstanceRef.current!,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 3,
            fillColor: dp.color,
            fillOpacity: 0.9,
            strokeColor: '#ffffff',
            strokeWeight: 0.5,
          },
        });
        liveMarkersRef.current.push(marker);
      }
    });
  }, [currentTime, droneFormations, location, loaded, showDrones]);

  // Hide live markers when off
  useEffect(() => {
    if (!liveSync) {
      liveMarkersRef.current.forEach(m => m.setMap(null));
      liveMarkersRef.current = [];
    }
  }, [liveSync]);

  // Geofence circles
  useEffect(() => {
    if (!mapInstanceRef.current || !loaded) return;
    circlesRef.current.forEach(c => c.setMap(null));
    circlesRef.current = [];

    if (showGeofence) {
      [
        { radius: 120, color: '#ff2222', opacity: 0.04, strokeOpacity: 0.3, label: 'No-Fly Zone' },
        { radius: 80, color: '#ff8800', opacity: 0.06, strokeOpacity: 0.4, label: 'Safety Buffer' },
        { radius: 40, color: '#00ff44', opacity: 0.05, strokeOpacity: 0.3, label: 'Performance Zone' },
      ].forEach(({ radius, color, opacity, strokeOpacity }) => {
        const circle = new google.maps.Circle({
          map: mapInstanceRef.current!,
          center: { lat: location.lat, lng: location.lng },
          radius,
          fillColor: color,
          fillOpacity: opacity,
          strokeColor: color,
          strokeWeight: 1.5,
          strokeOpacity,
        });
        circlesRef.current.push(circle);
      });
    }
  }, [location, loaded, showGeofence]);

  // Measuring polyline
  useEffect(() => {
    if (!mapInstanceRef.current || !loaded) return;
    if (polylineRef.current) polylineRef.current.setMap(null);

    if (measurePoints.length >= 2) {
      polylineRef.current = new google.maps.Polyline({
        path: measurePoints,
        map: mapInstanceRef.current,
        strokeColor: '#FFD700',
        strokeWeight: 2,
        strokeOpacity: 0.9,
        geodesic: true,
      });
    }
  }, [measurePoints, loaded]);

  const handleLocateMe = useCallback(() => {
    if (!navigator.geolocation) {
      toast.error('Geolocalização não suportada');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const newLoc = { ...location, lat: pos.coords.latitude, lng: pos.coords.longitude };
        setGpsOrigin(newLoc);
        mapInstanceRef.current?.panTo({ lat: newLoc.lat, lng: newLoc.lng });
        pushLog(`GPS atualizado: ${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`, 'success');
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
    pushLog(`KML exportado: ${projectName}`, 'success');
    toast.success('KML exportado — abra no Google Earth Pro');
  }, [droneFormations, trajectories, positions, location, projectName]);

  const toggleMeasure = useCallback(() => {
    if (measuring) {
      setMeasuring(false);
      setMeasurePoints([]);
      setMeasureDist(null);
      if (polylineRef.current) polylineRef.current.setMap(null);
    } else {
      setMeasuring(true);
      setMeasurePoints([]);
      setMeasureDist(null);
      toast.info('Clique em 2 pontos no mapa para medir distância');
    }
  }, [measuring]);

  const nextFormation = useCallback(() => {
    if (droneFormations.length > 0) {
      setActiveFormationIdx(prev => (prev + 1) % droneFormations.length);
    }
  }, [droneFormations.length]);

  const centerOnFormation = useCallback(() => {
    if (!mapInstanceRef.current || droneFormations.length === 0) return;
    mapInstanceRef.current.panTo({ lat: location.lat, lng: location.lng });
    mapInstanceRef.current.setZoom(18);
  }, [location, droneFormations]);

  return (
    <div className="h-full flex flex-col bg-surface-0 border-l border-border">
      {/* Header */}
      <div className="flex items-center justify-between p-2 border-b border-border bg-surface-1">
        <div className="flex items-center gap-1.5">
          <Globe className="w-3.5 h-3.5 text-primary" />
          <span className="text-[10px] font-bold font-mono-code text-foreground tracking-wider uppercase">
            Site Survey
          </span>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Search bar */}
      <div className="p-1.5 border-b border-border bg-surface-1">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Buscar local... (cidade, endereço, ponto)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-6 text-[9px] bg-surface-0 border border-border rounded pl-6 pr-2 text-foreground font-mono-code placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
        </div>
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
            <button
              onClick={toggleMeasure}
              className={cn(
                "bg-surface-1/90 backdrop-blur p-1.5 rounded border border-border/50 hover:bg-surface-2 transition-all",
                measuring && "ring-1 ring-primary bg-primary/20"
              )}
              title="Medir distância"
            >
              <Ruler className="w-3.5 h-3.5 text-foreground" />
            </button>
            <button
              onClick={centerOnFormation}
              className="bg-surface-1/90 backdrop-blur p-1.5 rounded border border-border/50 hover:bg-surface-2 transition-all"
              title="Centralizar"
            >
              <Maximize2 className="w-3.5 h-3.5 text-foreground" />
            </button>
          </div>
        )}

        {/* Live sync badge */}
        {liveSync && isPlaying && (
          <div className="absolute top-2 right-2 flex items-center gap-1 bg-destructive/90 backdrop-blur px-2 py-0.5 rounded-full">
            <div className="w-1.5 h-1.5 bg-destructive-foreground rounded-full animate-pulse" />
            <span className="text-[8px] font-mono-code text-destructive-foreground font-bold">LIVE</span>
          </div>
        )}

        {/* Measurement badge */}
        {measuring && measureDist !== null && (
          <div className="absolute bottom-2 left-2 bg-surface-0/90 backdrop-blur px-2 py-1 rounded border border-primary/30">
            <span className="text-[9px] font-mono-code text-primary font-bold">
              📏 {measureDist < 1000 ? `${measureDist.toFixed(1)}m` : `${(measureDist / 1000).toFixed(2)}km`}
            </span>
          </div>
        )}
      </div>

      {/* Formation navigator */}
      {droneFormations.length > 0 && !liveSync && (
        <div className="px-2 py-1 border-t border-border bg-surface-1/50">
          <div className="flex items-center gap-1">
            <span className="text-[8px] font-mono-code text-muted-foreground flex-shrink-0">FORMATION</span>
            <button
              onClick={() => setActiveFormationIdx(prev => Math.max(0, prev - 1))}
              className="text-muted-foreground hover:text-foreground p-0.5"
              disabled={activeFormationIdx === 0}
            >
              <Play className="w-2.5 h-2.5 rotate-180" />
            </button>
            <span className="text-[9px] font-mono-code text-foreground font-bold min-w-[40px] text-center">
              {activeFormationIdx + 1}/{droneFormations.length}
            </span>
            <button
              onClick={nextFormation}
              className="text-muted-foreground hover:text-foreground p-0.5"
            >
              <SkipForward className="w-2.5 h-2.5" />
            </button>
            <span className="text-[8px] font-mono-code text-muted-foreground truncate flex-1">
              {droneFormations[activeFormationIdx]?.formationType}
            </span>
            <button
              onClick={() => setShowAllFormations(!showAllFormations)}
              className={cn("p-0.5", showAllFormations ? "text-primary" : "text-muted-foreground hover:text-foreground")}
              title={showAllFormations ? 'Mostrar uma' : 'Mostrar todas'}
            >
              {showAllFormations ? <Eye className="w-2.5 h-2.5" /> : <EyeOff className="w-2.5 h-2.5" />}
            </button>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="p-2 border-t border-border bg-surface-1 space-y-1.5">
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

        {/* Heading + Altitude */}
        <div className="flex items-center gap-1.5">
          <Navigation className="w-3 h-3 text-primary flex-shrink-0" />
          <label className="text-[9px] font-mono-code text-muted-foreground">Hdg</label>
          <input
            type="number"
            value={location.heading}
            onChange={(e) => {
              const h = ((Number(e.target.value) % 360) + 360) % 360;
              setGpsOrigin({ ...location, heading: h });
              mapInstanceRef.current?.setHeading(h);
            }}
            className="w-10 h-5 text-[9px] bg-surface-0 border border-border rounded px-1 text-foreground font-mono-code"
            min={0} max={359}
          />
          <span className="text-[8px] text-muted-foreground">°</span>
          <label className="text-[9px] font-mono-code text-muted-foreground ml-1">Alt</label>
          <input
            type="number"
            value={location.altitude}
            onChange={(e) => setGpsOrigin({ ...location, altitude: Number(e.target.value) })}
            className="w-10 h-5 text-[9px] bg-surface-0 border border-border rounded px-1 text-foreground font-mono-code"
            min={0} max={5000}
          />
          <span className="text-[8px] text-muted-foreground">m</span>
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
          <Button
            variant={liveSync ? 'default' : 'ghost'}
            size="sm"
            className={cn("flex-1 h-5 text-[8px] gap-0.5", liveSync && "bg-destructive hover:bg-destructive/90 text-destructive-foreground")}
            onClick={() => setLiveSync(!liveSync)}
          >
            {liveSync ? <Pause className="w-2.5 h-2.5" /> : <Play className="w-2.5 h-2.5" />}
            Live
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

        {/* Quick location presets */}
        <div className="flex gap-1 flex-wrap">
          {[
            { label: 'São Paulo', lat: -23.5505, lng: -46.6333 },
            { label: 'Copacabana', lat: -22.9711, lng: -43.1822 },
            { label: 'BH', lat: -19.9191, lng: -43.9386 },
            { label: 'Dubai', lat: 25.2048, lng: 55.2708 },
            { label: 'Las Vegas', lat: 36.1699, lng: -115.1398 },
            { label: 'Sydney', lat: -33.8568, lng: 151.2153 },
          ].map((preset) => (
            <button
              key={preset.label}
              onClick={() => {
                setGpsOrigin({ ...location, lat: preset.lat, lng: preset.lng });
                mapInstanceRef.current?.panTo({ lat: preset.lat, lng: preset.lng });
                pushLog(`📍 ${preset.label}`, 'info');
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
