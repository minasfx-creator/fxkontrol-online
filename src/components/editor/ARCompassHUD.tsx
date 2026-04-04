/**
 * ARCompassHUD — Avionic-style geospatial compass overlay
 * Shows bearing to GPS anchor, magnetic north, wind direction
 */
import { useSceneStore } from '@/store/useSceneStore';

export default function ARCompassHUD() {
  const arMode = useSceneStore(s => s.environment.arMode);
  const windDir = useSceneStore(s => s.settings.windDirection);
  const lat = useSceneStore(s => s.settings.geoAnchorLat);
  const lon = useSceneStore(s => s.settings.geoAnchorLon);

  if (!arMode) return null;

  const tickMarks = Array.from({ length: 36 }, (_, i) => i * 10);
  const cardinals: Record<number, string> = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' };

  return (
    <div className="absolute top-14 right-4 z-[35] pointer-events-none select-none">
      <svg width="96" height="96" viewBox="0 0 96 96" className="drop-shadow-lg">
        {/* Outer ring */}
        <circle cx="48" cy="48" r="44" fill="none" stroke="hsl(var(--fxk-cyan) / 0.2)" strokeWidth="1" />
        <circle cx="48" cy="48" r="40" fill="hsl(var(--surface-0) / 0.6)" stroke="hsl(var(--fxk-cyan) / 0.15)" strokeWidth="0.5" />

        {/* Tick marks */}
        {tickMarks.map(deg => {
          const rad = (deg - 90) * Math.PI / 180;
          const isMajor = deg % 90 === 0;
          const r1 = isMajor ? 32 : 36;
          const r2 = 40;
          return (
            <g key={deg}>
              <line
                x1={48 + r1 * Math.cos(rad)}
                y1={48 + r1 * Math.sin(rad)}
                x2={48 + r2 * Math.cos(rad)}
                y2={48 + r2 * Math.sin(rad)}
                stroke={isMajor ? 'hsl(var(--fxk-cyan))' : 'hsl(var(--fxk-cyan) / 0.3)'}
                strokeWidth={isMajor ? 1.5 : 0.5}
              />
              {cardinals[deg] && (
                <text
                  x={48 + 26 * Math.cos(rad)}
                  y={48 + 26 * Math.sin(rad)}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="hsl(var(--fxk-cyan))"
                  fontSize="8"
                  fontFamily="var(--font-mono)"
                  fontWeight="bold"
                >
                  {cardinals[deg]}
                </text>
              )}
            </g>
          );
        })}

        {/* Wind direction arrow */}
        <g transform={`rotate(${windDir}, 48, 48)`}>
          <line x1="48" y1="48" x2="48" y2="16" stroke="hsl(var(--primary) / 0.6)" strokeWidth="1.5" strokeDasharray="3 2" />
          <polygon points="44,20 48,12 52,20" fill="hsl(var(--primary) / 0.5)" />
        </g>

        {/* North indicator */}
        <polygon points="46,10 48,4 50,10" fill="hsl(var(--destructive))" />

        {/* Center dot */}
        <circle cx="48" cy="48" r="2" fill="hsl(var(--fxk-cyan))" />

        {/* Coordinates label */}
        <text x="48" y="88" textAnchor="middle" fill="hsl(var(--fxk-cyan) / 0.6)" fontSize="6" fontFamily="var(--font-mono)">
          {lat.toFixed(3)}° {lon.toFixed(3)}°
        </text>
      </svg>
    </div>
  );
}
