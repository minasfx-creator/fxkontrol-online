/**
 * ─── GeoHUD — Operational Geo-Spatial Overlay ───────────────────────
 * Shows real-time geo data: coordinates, altitude, anchor, tiles, FPS,
 * memory, and terrain distance. Positioned top-left of viewport.
 */

import { useEffect, useRef, useState } from 'react';
import { useSceneStore } from '@/store/useSceneStore';
import { MapPin, Navigation, Layers, Cpu, Mountain } from 'lucide-react';
import { cn } from '@/lib/utils';

// Module-level stats updated by the render loop
let _geoHudData = {
  camLat: 0,
  camLng: 0,
  altMSL: 0,
  anchorLat: -23.007,
  anchorLon: -44.318,
  tilesLoaded: 0,
  fps: 60,
  memoryMB: 0,
  terrainDist: 0,
  lodTier: 'high',
  vramPressure: 0,
};

export function updateGeoHUD(data: Partial<typeof _geoHudData>) {
  Object.assign(_geoHudData, data);
}

export function GeoHUDToggle({ show, onToggle }: { show: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={cn(
        "w-7 h-7 rounded-md flex items-center justify-center transition-all border",
        show
          ? "bg-primary/20 border-primary/40 text-primary"
          : "bg-surface-1/80 border-border/30 text-muted-foreground hover:text-foreground hover:border-border/60"
      )}
      title="Geo HUD"
    >
      <Navigation className="h-3.5 w-3.5" />
    </button>
  );
}

export function GeoHUDPanel() {
  const s = useSceneStore(st => st.settings);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 250);
    return () => clearInterval(id);
  }, []);

  const formatDMS = (deg: number, isLat: boolean) => {
    const abs = Math.abs(deg);
    const d = Math.floor(abs);
    const mFull = (abs - d) * 60;
    const m = Math.floor(mFull);
    const sec = ((mFull - m) * 60).toFixed(2);
    const dir = isLat ? (deg >= 0 ? 'N' : 'S') : (deg >= 0 ? 'E' : 'W');
    return `${d}°${m}'${sec}"${dir}`;
  };

  const vramColor = _geoHudData.vramPressure > 0.8 ? 'hsl(0, 80%, 55%)'
    : _geoHudData.vramPressure > 0.5 ? 'hsl(45, 95%, 55%)'
    : 'hsl(142, 76%, 50%)';

  return (
    <div className="absolute bottom-2 left-2 z-30 pointer-events-none select-none">
      <div
        className="rounded-md border backdrop-blur-md"
        style={{
          background: 'hsla(220, 20%, 8%, 0.88)',
          borderColor: 'hsla(220, 20%, 25%, 0.5)',
          padding: '8px 10px',
          fontFamily: 'ui-monospace, "JetBrains Mono", monospace',
          fontSize: '10px',
          lineHeight: '1.7',
          color: 'hsla(0, 0%, 85%, 0.9)',
          minWidth: '200px',
        }}
      >
        <div style={{ fontSize: '8px', fontWeight: 700, letterSpacing: '0.12em', color: 'hsla(142, 76%, 50%, 0.8)', marginBottom: '4px' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <MapPin size={9} /> GEO HUD
          </span>
        </div>

        {/* Camera Position */}
        <Row label="Lat" value={formatDMS(s.geoAnchorLat, true)} />
        <Row label="Lon" value={formatDMS(s.geoAnchorLon, false)} />
        <Row label="Alt MSL" value={`${s.geoAnchorAlt.toFixed(1)}m`} />

        <Sep />

        {/* Anchor */}
        <Row
          label="Anchor"
          value={`${s.geoAnchorLat.toFixed(4)}, ${s.geoAnchorLon.toFixed(4)}`}
          color="hsl(207, 90%, 60%)"
        />
        <Row label="Tide Offset" value={`${s.tideOffset > 0 ? '+' : ''}${s.tideOffset.toFixed(1)}m`} />

        <Sep />

        {/* Performance */}
        <Row label="Tiles" value={`${_geoHudData.tilesLoaded}`} />
        <Row
          label="FPS"
          value={`${_geoHudData.fps}`}
          color={_geoHudData.fps >= 50 ? 'hsl(142, 76%, 50%)' : _geoHudData.fps >= 30 ? 'hsl(45, 95%, 55%)' : 'hsl(0, 80%, 55%)'}
        />
        <Row label="VRAM" value={`${_geoHudData.memoryMB}MB`} color={vramColor} />
        <Row label="Terrain" value={`${_geoHudData.terrainDist.toFixed(0)}m`} />

        <Sep />

        {/* Status */}
        <Row
          label="Origin"
          value={s.floatingOriginEnabled ? 'FLOAT' : 'FIXED'}
          color={s.floatingOriginEnabled ? 'hsl(142, 76%, 50%)' : 'hsl(45, 95%, 55%)'}
        />
        <Row label="LOD" value={_geoHudData.lodTier.toUpperCase()} />
      </div>
    </div>
  );
}

function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
      <span style={{ color: 'hsla(0, 0%, 60%, 0.8)' }}>{label}</span>
      <span style={{ color: color || 'hsla(0, 0%, 90%, 0.9)', fontWeight: 600 }}>{value}</span>
    </div>
  );
}

function Sep() {
  return <div style={{ height: '1px', background: 'hsla(220, 20%, 25%, 0.4)', margin: '3px 0' }} />;
}
