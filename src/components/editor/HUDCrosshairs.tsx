/**
 * HUDCrosshairs — AR-style SVG overlay for tactical viewport
 * Blade Runner 2049 / FUI aesthetic with Electric Cyan glow
 */
import { useSceneStore } from '@/store/useSceneStore';

export default function HUDCrosshairs() {
  const show = useSceneStore(s => s.environment.showHUDCrosshairs);
  if (!show) return null;

  return (
    <div className="absolute inset-0 z-50 pointer-events-none flex items-center justify-center animate-fade-in" style={{ mixBlendMode: 'screen' }}>
      <svg
        viewBox="0 0 600 600"
        className="w-[min(80%,600px)] h-[min(80%,600px)] opacity-60"
        style={{ color: 'hsl(190, 100%, 50%)' }}
        fill="none"
        stroke="currentColor"
        strokeWidth="0.8"
      >
        {/* Center crosshair lines */}
        <line x1="300" y1="240" x2="300" y2="280" strokeWidth="1" />
        <line x1="300" y1="320" x2="300" y2="360" strokeWidth="1" />
        <line x1="240" y1="300" x2="280" y2="300" strokeWidth="1" />
        <line x1="320" y1="300" x2="360" y2="300" strokeWidth="1" />

        {/* Center dot */}
        <circle cx="300" cy="300" r="2" fill="currentColor" />

        {/* Concentric circles */}
        <circle cx="300" cy="300" r="60" strokeDasharray="6 4" opacity="0.6" />
        <circle cx="300" cy="300" r="120" strokeDasharray="8 6" opacity="0.4" />
        <circle cx="300" cy="300" r="200" strokeDasharray="12 8" opacity="0.25" />

        {/* Corner brackets — top-left */}
        <path d="M80,120 L80,80 L120,80" strokeWidth="1.2" />
        {/* Corner brackets — top-right */}
        <path d="M520,80 L520,80 M480,80 L520,80 L520,120" strokeWidth="1.2" />
        {/* Corner brackets — bottom-left */}
        <path d="M80,480 L80,520 L120,520" strokeWidth="1.2" />
        {/* Corner brackets — bottom-right */}
        <path d="M480,520 L520,520 L520,480" strokeWidth="1.2" />

        {/* Tick marks on axes */}
        {[240, 260, 340, 360].map(v => (
          <g key={`h-${v}`}>
            <line x1={v} y1="296" x2={v} y2="304" strokeWidth="0.5" opacity="0.5" />
          </g>
        ))}
        {[240, 260, 340, 360].map(v => (
          <g key={`v-${v}`}>
            <line x1="296" y1={v} x2="304" y2={v} strokeWidth="0.5" opacity="0.5" />
          </g>
        ))}

        {/* Technical labels */}
        <text x="85" y="75" fill="currentColor" fontSize="9" fontFamily="monospace" opacity="0.6">P-Y/22</text>
        <text x="470" y="75" fill="currentColor" fontSize="9" fontFamily="monospace" opacity="0.6" textAnchor="end">TGT-LOCK</text>
        <text x="85" y="535" fill="currentColor" fontSize="8" fontFamily="monospace" opacity="0.5">AZ: 000°</text>
        <text x="470" y="535" fill="currentColor" fontSize="8" fontFamily="monospace" opacity="0.5" textAnchor="end">EL: +00°</text>
        <text x="300" y="230" fill="currentColor" fontSize="8" fontFamily="monospace" opacity="0.4" textAnchor="middle">SWARM CMD</text>
      </svg>
    </div>
  );
}
