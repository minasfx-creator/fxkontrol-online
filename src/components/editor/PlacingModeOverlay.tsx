/**
 * PlacingModeOverlay — Animated crosshair + "TAP TO PLACE" when placing mode is active
 */
import { useProjectStore } from '@/store/useProjectStore';

export default function PlacingModeOverlay() {
  const editorMode = useProjectStore(s => s.editorMode);
  const isPlacing = editorMode === 'add-pyro' || editorMode === 'add-drone';

  if (!isPlacing) return null;

  const isPyro = editorMode === 'add-pyro';
  const typeLabel = isPyro ? 'PYRO' : 'DRONE';
  const typeColor = isPyro ? 'hsl(25, 95%, 55%)' : 'hsl(190, 100%, 50%)';

  return (
    <div className="absolute inset-0 z-40 pointer-events-none flex flex-col items-center justify-center animate-fade-in">
      {/* Type badge */}
      <div
        className="mb-4 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-[0.15em]"
        style={{
          background: `${typeColor}20`,
          color: typeColor,
          border: `1px solid ${typeColor}40`,
        }}
      >
        {typeLabel}
      </div>

      {/* Crosshair SVG */}
      <div className="relative w-32 h-32">
        {/* Outer pulsing circle */}
        <svg
          viewBox="0 0 128 128"
          className="absolute inset-0 w-full h-full placing-pulse"
          fill="none"
          stroke={typeColor}
          strokeWidth="0.8"
        >
          <circle cx="64" cy="64" r="58" strokeDasharray="8 4" opacity="0.3" />
        </svg>

        {/* Spinning crosshair */}
        <svg
          viewBox="0 0 128 128"
          className="absolute inset-0 w-full h-full placing-crosshair-spin"
          fill="none"
          stroke={typeColor}
          strokeWidth="1"
        >
          {/* Cross lines */}
          <line x1="64" y1="20" x2="64" y2="44" opacity="0.7" />
          <line x1="64" y1="84" x2="64" y2="108" opacity="0.7" />
          <line x1="20" y1="64" x2="44" y2="64" opacity="0.7" />
          <line x1="84" y1="64" x2="108" y2="64" opacity="0.7" />

          {/* Corner ticks */}
          <line x1="38" y1="38" x2="46" y2="46" opacity="0.4" strokeWidth="0.6" />
          <line x1="90" y1="38" x2="82" y2="46" opacity="0.4" strokeWidth="0.6" />
          <line x1="38" y1="90" x2="46" y2="82" opacity="0.4" strokeWidth="0.6" />
          <line x1="90" y1="90" x2="82" y2="82" opacity="0.4" strokeWidth="0.6" />
        </svg>

        {/* Center dot (static) */}
        <svg
          viewBox="0 0 128 128"
          className="absolute inset-0 w-full h-full"
          fill={typeColor}
        >
          <circle cx="64" cy="64" r="3" opacity="0.8" />
          <circle cx="64" cy="64" r="6" opacity="0.15" />
        </svg>
      </div>

      {/* TAP TO PLACE text */}
      <p
        className="mt-4 font-mono text-[11px] font-bold uppercase tracking-[0.2em] placing-pulse"
        style={{ color: typeColor }}
      >
        TAP TO PLACE
      </p>

      {/* ESC hint */}
      <p className="mt-2 text-[9px] text-muted-foreground/40 font-mono uppercase tracking-wider">
        ESC to cancel
      </p>
    </div>
  );
}
