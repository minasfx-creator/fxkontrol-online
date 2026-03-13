import { useEffect, useRef, useState } from 'react';
import { useProjectStore } from '@/store/useProjectStore';
import { supabase } from '@/integrations/supabase/client';
import { MapPin, Maximize2, Minimize2, Play, Pause } from 'lucide-react';
import { cn } from '@/lib/utils';
import { computeDronePositions } from './DroneChoreography';

function loadGoogleMapsScript(apiKey: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as any).google?.maps) { resolve(); return; }
    const existing = document.getElementById('google-maps-script');
    if (existing) { existing.addEventListener('load', () => resolve()); return; }
    const script = document.createElement('script');
    script.id = 'google-maps-script';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,geometry&v=weekly`;
    script.async = true; script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Maps'));
    document.head.appendChild(script);
  });
}

const METERS_TO_LAT = 1 / 111320;
function metersToLng(lat: number) {
  return 1 / (111320 * Math.cos((lat * Math.PI) / 180));
}
function localToGps(x: number, y: number, z: number, origin: { lat: number; lng: number; heading: number }) {
  const rad = (-origin.heading * Math.PI) / 180;
  const rx = x * Math.cos(rad) - z * Math.sin(rad);
  const rz = x * Math.sin(rad) + z * Math.cos(rad);
  return { lat: origin.lat - rz * METERS_TO_LAT, lng: origin.lng + rx * metersToLng(origin.lat) };
}

const MAX_DRONE_MARKERS = 150;
const MAX_TRAIL_POINTS = 40;
const TRAIL_SUBSAMPLE = 8; // only draw trails for every Nth drone

export default function MiniMap() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const circleRef = useRef<google.maps.Circle | null>(null);
  const droneMarkersRef = useRef<google.maps.Marker[]>([]);
  const trailPolylinesRef = useRef<google.maps.Polyline[]>([]);
  const trailHistoryRef = useRef<Map<number, google.maps.LatLngLiteral[]>>(new Map());
  const rafRef = useRef<number>(0);
  const lastTrailTimeRef = useRef(0);
  const [loaded, setLoaded] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState(false);
  const [showDrones, setShowDrones] = useState(true);
  const [showTrails, setShowTrails] = useState(true);
  const gpsOrigin = useProjectStore((s) => s.gpsOrigin);

  // Init map
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
          zoom: 17, mapTypeId: 'satellite', disableDefaultUI: true,
          gestureHandling: 'greedy', keyboardShortcuts: false, backgroundColor: '#0a0a0a',
        });
        const marker = new google.maps.Marker({
          position: { lat: gpsOrigin.lat, lng: gpsOrigin.lng }, map,
          icon: { path: google.maps.SymbolPath.CIRCLE, scale: 6, fillColor: '#f97316', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2 },
          title: 'Show Origin',
        });
        const circle = new google.maps.Circle({
          map, center: { lat: gpsOrigin.lat, lng: gpsOrigin.lng }, radius: 80,
          fillColor: '#3b82f6', fillOpacity: 0.06, strokeColor: '#3b82f6', strokeWeight: 1, strokeOpacity: 0.3,
        });
        mapInstanceRef.current = map; markerRef.current = marker; circleRef.current = circle;
        setLoaded(true);
      } catch { setError(true); }
    }
    init();
    return () => { cancelled = true; };
  }, []);

  // Update origin
  useEffect(() => {
    if (!mapInstanceRef.current || !markerRef.current || !circleRef.current) return;
    const pos = { lat: gpsOrigin.lat, lng: gpsOrigin.lng };
    mapInstanceRef.current.panTo(pos); markerRef.current.setPosition(pos); circleRef.current.setCenter(pos);
  }, [gpsOrigin.lat, gpsOrigin.lng]);

  // Clear trails helper
  function clearTrails() {
    trailPolylinesRef.current.forEach(p => p.setMap(null));
    trailPolylinesRef.current = [];
    trailHistoryRef.current.clear();
  }

  // Realtime drone sync + trails
  useEffect(() => {
    if (!loaded || !showDrones) {
      droneMarkersRef.current.forEach(m => m.setMap(null));
      droneMarkersRef.current = [];
      clearTrails();
      return;
    }

    let running = true;
    let frameCount = 0;

    function tick() {
      if (!running || !mapInstanceRef.current) return;
      frameCount++;

      const { droneFormations, currentTime, gpsOrigin: origin, isPlaying } = useProjectStore.getState();
      const positions = computeDronePositions(droneFormations, currentTime);
      const map = mapInstanceRef.current!;
      const existing = droneMarkersRef.current;

      if (!positions || positions.length === 0) {
        existing.forEach(m => m.setMap(null));
        droneMarkersRef.current = [];
        if (!isPlaying) clearTrails();
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      // Reset trails when time rewinds
      if (currentTime < lastTrailTimeRef.current - 0.5) clearTrails();
      lastTrailTimeRef.current = currentTime;

      // Subsample drones for markers
      const step = Math.max(1, Math.floor(positions.length / MAX_DRONE_MARKERS));
      const sampled = positions.filter((_, i) => i % step === 0);

      while (existing.length > sampled.length) { const m = existing.pop(); m?.setMap(null); }

      sampled.forEach((drone, i) => {
        const gps = localToGps(drone.x, drone.y, drone.z, origin);
        const pos = { lat: gps.lat, lng: gps.lng };
        if (i < existing.length) {
          existing[i].setPosition(pos);
          existing[i].setIcon({ path: google.maps.SymbolPath.CIRCLE, scale: 3, fillColor: drone.color, fillOpacity: 0.9, strokeWeight: 0 });
        } else {
          existing.push(new google.maps.Marker({
            position: pos, map,
            icon: { path: google.maps.SymbolPath.CIRCLE, scale: 3, fillColor: drone.color, fillOpacity: 0.9, strokeWeight: 0 },
          }));
        }
      });
      droneMarkersRef.current = existing;

      // Trail recording — every 6th frame, for every TRAIL_SUBSAMPLE-th drone
      if (showTrails && isPlaying && frameCount % 6 === 0) {
        const trailStep = Math.max(1, Math.floor(positions.length / TRAIL_SUBSAMPLE));
        const trailDrones = positions.filter((_, i) => i % trailStep === 0);
        const history = trailHistoryRef.current;
        const polylines = trailPolylinesRef.current;

        trailDrones.forEach((drone, i) => {
          const gps = localToGps(drone.x, drone.y, drone.z, origin);
          const pt = { lat: gps.lat, lng: gps.lng };

          if (!history.has(i)) history.set(i, []);
          const pts = history.get(i)!;
          pts.push(pt);
          if (pts.length > MAX_TRAIL_POINTS) pts.shift();

          if (i < polylines.length) {
            polylines[i].setPath(pts);
          } else {
            const color = drone.color || '#00B4D8';
            polylines.push(new google.maps.Polyline({
              path: pts, map,
              strokeColor: color, strokeOpacity: 0.5, strokeWeight: 1.5,
              geodesic: false,
            }));
          }
        });

        // Remove excess polylines
        while (polylines.length > trailDrones.length) {
          const p = polylines.pop(); p?.setMap(null);
        }
      }

      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => { running = false; cancelAnimationFrame(rafRef.current); };
  }, [loaded, showDrones, showTrails]);

  if (error) return null;

  const isPlaying = useProjectStore((s) => s.isPlaying);
  const droneCount = useProjectStore((s) => s.droneFormations.length > 0 ? s.droneFormations[0].droneCount : 0);

  return (
    <div className={cn(
      "absolute bottom-12 left-3 rounded-lg overflow-hidden border border-border/40 shadow-2xl transition-all duration-300 group",
      expanded ? "w-80 h-60" : "w-44 h-32"
    )}>
      <div ref={mapRef} className="w-full h-full bg-surface-0" />

      {/* Coords overlay */}
      <div className="absolute top-1.5 left-1.5 flex items-center gap-1">
        <div className="bg-surface-0/80 backdrop-blur-sm rounded px-1.5 py-0.5 flex items-center gap-1">
          <MapPin className="w-2.5 h-2.5 text-safety" />
          <span className="text-[8px] font-mono-code text-foreground/80">
            {gpsOrigin.lat.toFixed(3)}°, {gpsOrigin.lng.toFixed(3)}°
          </span>
        </div>
      </div>

      {/* Status + toggles */}
      {loaded && droneCount > 0 && (
        <div className="absolute bottom-1.5 left-1.5 bg-surface-0/80 backdrop-blur-sm rounded px-1.5 py-0.5 flex items-center gap-1">
          {isPlaying
            ? <Play className="w-2 h-2 text-success fill-current" />
            : <Pause className="w-2 h-2 text-muted-foreground" />}
          <span className="text-[7px] font-mono-code text-foreground/60">{droneCount}</span>
          <button
            onClick={() => setShowDrones(!showDrones)}
            className={cn("text-[7px] font-mono-code px-1 rounded", showDrones ? "text-success bg-success/10" : "text-muted-foreground bg-surface-3/50")}
          >
            {showDrones ? 'LIVE' : 'OFF'}
          </button>
          <button
            onClick={() => { setShowTrails(!showTrails); if (showTrails) clearTrails(); }}
            className={cn("text-[7px] font-mono-code px-1 rounded", showTrails ? "text-electric bg-electric/10" : "text-muted-foreground bg-surface-3/50")}
          >
            {showTrails ? 'TRAIL' : '—'}
          </button>
        </div>
      )}

      <button
        onClick={() => setExpanded(!expanded)}
        className="absolute top-1.5 right-1.5 w-5 h-5 bg-surface-0/80 backdrop-blur-sm rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
      >
        {expanded ? <Minimize2 className="w-3 h-3 text-foreground/70" /> : <Maximize2 className="w-3 h-3 text-foreground/70" />}
      </button>

      {!loaded && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-surface-0">
          <div className="w-4 h-4 border border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}
