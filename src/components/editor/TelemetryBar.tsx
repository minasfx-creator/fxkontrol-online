/**
 * ─── TelemetryBar — Industrial HUD Top Bar ──────────────────────────
 * Minimalist glassmorphism telemetry strip: Location · Altitude · FPS
 * Positioned at the top of the viewport for real-time operational data.
 * 
 * Now uses shared useTelemetryData hook for data.
 */

import React, { useState, useEffect } from 'react';
import { useSceneStore } from '@/store/useSceneStore';
import { MapPin, Mountain, Activity, Clock, Satellite } from 'lucide-react';
import { useTelemetryData, updateTelemetry } from '@/hooks/useTelemetryData';

// Re-export updateTelemetry for backward compat (existing callers import from here)
export { updateTelemetry };

export default React.memo(function TelemetryBar() {
  const google3DTilesEnabled = useSceneStore(st => st.settings.google3DTilesEnabled);
  const t = useTelemetryData();

  // Clock updates once per second instead of every R3F frame
  const [timeStr, setTimeStr] = useState(() =>
    new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  );
  useEffect(() => {
    const iv = setInterval(() => {
      setTimeStr(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }, 1000);
    return () => clearInterval(iv);
  }, []);

  const fpsColor = t.fps >= 55
    ? 'text-green-400'
    : t.fps >= 30
      ? 'text-amber-400'
      : 'text-destructive';

  return (
    <div className="absolute top-0 left-0 right-0 z-30 pointer-events-none select-none">
      <div
        className="mx-auto mt-2 flex items-center justify-center gap-4 sm:gap-6 px-4 sm:px-5 py-1.5 rounded-lg border border-border/10 bg-background/60 backdrop-blur-xl"
        style={{
          maxWidth: '720px',
          fontFamily: 'ui-monospace, "JetBrains Mono", monospace',
          fontSize: '10px',
          lineHeight: '16px',
          letterSpacing: '0.02em',
        }}
      >
        {/* Clock */}
        <span className="flex items-center gap-1.5 text-muted-foreground/70 shrink-0">
          <Clock className="w-3 h-3" />
          <span className="tabular-nums">{timeStr}</span>
        </span>

        <Divider />

        {/* Location */}
        <span className="flex items-center gap-1.5 text-muted-foreground/80 min-w-0">
          <MapPin className="w-3 h-3 text-primary/70 shrink-0" />
          <span className="tabular-nums shrink-0">
            {t.lat.toFixed(4)}°, {t.lng.toFixed(4)}°
          </span>
          {t.locationName && (
            <span className="text-foreground/60 max-w-[120px] truncate ml-1">
              {t.locationName}
            </span>
          )}
        </span>

        <Divider />

        {/* Altitude */}
        <span className="flex items-center gap-1.5 text-muted-foreground/80 shrink-0">
          <Mountain className="w-3 h-3 text-accent-foreground/60" />
          <span className="tabular-nums">{t.altMSL.toFixed(0)}m MSL</span>
        </span>

        <Divider />

        {/* FPS */}
        <span className={`flex items-center gap-1.5 shrink-0 ${fpsColor}`}>
          <Activity className="w-3 h-3" />
          <span className="tabular-nums font-semibold">{Math.round(t.fps)} FPS</span>
        </span>

        {/* Tiles count — only in geo mode */}
        {google3DTilesEnabled && (
          <>
            <Divider />
            <span className="flex items-center gap-1.5 text-muted-foreground/60 shrink-0">
              <Satellite className="w-3 h-3" />
              <span className="tabular-nums">{t.tilesLoaded} tiles</span>
            </span>
          </>
        )}
      </div>
    </div>
  );
});

function Divider() {
  return <span className="w-px h-3 bg-border/20 shrink-0" />;
}
