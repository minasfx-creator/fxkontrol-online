/**
 * ─── TelemetryBar — Industrial HUD Top Bar ──────────────────────────
 * Minimalist glassmorphism telemetry strip: Location · Altitude · FPS
 * Positioned at the top of the viewport for real-time operational data.
 */

import { useEffect, useRef, useState } from 'react';
import { useSceneStore } from '@/store/useSceneStore';
import { MapPin, Mountain, Activity, Clock, Satellite } from 'lucide-react';

// Module-level perf data — updated from render loop, read by React at 4Hz
let _telemetry = {
  fps: 60,
  lat: -23.007,
  lng: -44.318,
  altMSL: 0,
  locationName: '',
  tilesLoaded: 0,
  drawCalls: 0,
  triangles: 0,
};

export function updateTelemetry(data: Partial<typeof _telemetry>) {
  Object.assign(_telemetry, data);
}

export default function TelemetryBar() {
  const google3DTilesEnabled = useSceneStore(st => st.settings.google3DTilesEnabled);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 250);
    return () => clearInterval(id);
  }, []);

  const fpsColor = _telemetry.fps >= 55
    ? 'text-emerald-400'
    : _telemetry.fps >= 30
      ? 'text-amber-400'
      : 'text-red-400';

  const now = new Date();
  const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <div className="absolute top-0 left-0 right-0 z-30 pointer-events-none select-none">
      <div
        className="mx-auto mt-2 flex items-center justify-center gap-6 px-5 py-1.5 rounded-lg border"
        style={{
          maxWidth: '720px',
          background: 'hsla(240, 10%, 4%, 0.60)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderColor: 'hsla(0, 0%, 100%, 0.08)',
          fontFamily: 'ui-monospace, "JetBrains Mono", monospace',
          fontSize: '10px',
          lineHeight: '16px',
          letterSpacing: '0.02em',
        }}
      >
        {/* Clock */}
        <span className="flex items-center gap-1.5 text-muted-foreground/70">
          <Clock className="w-3 h-3" />
          <span className="tabular-nums">{timeStr}</span>
        </span>

        <Divider />

        {/* Location */}
        <span className="flex items-center gap-1.5 text-muted-foreground/80">
          <MapPin className="w-3 h-3 text-primary/70" />
          <span className="tabular-nums">
            {_telemetry.lat.toFixed(4)}°, {_telemetry.lng.toFixed(4)}°
          </span>
          {_telemetry.locationName && (
            <span className="text-foreground/60 max-w-[120px] truncate ml-1">
              {_telemetry.locationName}
            </span>
          )}
        </span>

        <Divider />

        {/* Altitude */}
        <span className="flex items-center gap-1.5 text-muted-foreground/80">
          <Mountain className="w-3 h-3 text-sky-400/70" />
          <span className="tabular-nums">{_telemetry.altMSL.toFixed(0)}m MSL</span>
        </span>

        <Divider />

        {/* FPS */}
        <span className={`flex items-center gap-1.5 ${fpsColor}`}>
          <Activity className="w-3 h-3" />
          <span className="tabular-nums font-semibold">{Math.round(_telemetry.fps)} FPS</span>
        </span>

        {/* Tiles count — only in geo mode */}
        {google3DTilesEnabled && (
          <>
            <Divider />
            <span className="flex items-center gap-1.5 text-muted-foreground/60">
              <Satellite className="w-3 h-3" />
              <span className="tabular-nums">{_telemetry.tilesLoaded} tiles</span>
            </span>
          </>
        )}
      </div>
    </div>
  );
}

function Divider() {
  return <span className="w-px h-3 bg-white/10" />;
}
