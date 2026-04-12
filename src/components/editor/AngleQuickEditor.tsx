/**
 * AngleQuickEditor — Finale 3D HPR sliders with SVG directional preview
 * Reusable: used in AddPositionWizard and via Compass button in MobileQuickActions
 */
import { useCallback } from 'react';
import { RotateCcw } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import { haptics } from '@/lib/haptics';

interface AngleQuickEditorProps {
  heading: number;
  pitch: number;
  roll: number;
  onChange: (h: number, p: number, r: number) => void;
  compact?: boolean;
}

const DEFAULTS = { heading: 0, pitch: 85, roll: 0 };

export default function AngleQuickEditor({ heading, pitch, roll, onChange, compact }: AngleQuickEditorProps) {
  const handleReset = useCallback(() => {
    haptics.tap();
    onChange(DEFAULTS.heading, DEFAULTS.pitch, DEFAULTS.roll);
  }, [onChange]);

  // SVG direction preview — top-down view showing heading arrow + pitch arc
  const headingRad = (heading - 90) * (Math.PI / 180);
  const arrowX = 40 + Math.cos(headingRad) * 28;
  const arrowY = 40 + Math.sin(headingRad) * 28;
  const pitchScale = pitch / 90; // 0 = horizontal, 1 = vertical

  return (
    <div className={cn("flex gap-3 items-start", compact ? "flex-row" : "flex-col")}>
      {/* SVG Preview */}
      <div className="flex-shrink-0 flex flex-col items-center gap-1">
        <svg width={compact ? 64 : 80} height={compact ? 64 : 80} viewBox="0 0 80 80" className="rounded-xl" style={{ background: 'hsl(var(--surface-1))' }}>
          {/* Grid rings */}
          <circle cx="40" cy="40" r="28" fill="none" stroke="hsl(var(--border))" strokeWidth="0.5" />
          <circle cx="40" cy="40" r="18" fill="none" stroke="hsl(var(--border))" strokeWidth="0.3" />
          {/* Cross */}
          <line x1="40" y1="12" x2="40" y2="68" stroke="hsl(var(--border))" strokeWidth="0.3" />
          <line x1="12" y1="40" x2="68" y2="40" stroke="hsl(var(--border))" strokeWidth="0.3" />
          {/* Heading arrow */}
          <line x1="40" y1="40" x2={arrowX} y2={arrowY} stroke="hsl(var(--primary))" strokeWidth="2" strokeLinecap="round" />
          <circle cx={arrowX} cy={arrowY} r="3" fill="hsl(var(--primary))" />
          {/* Pitch indicator — inner circle size */}
          <circle cx="40" cy="40" r={4 + pitchScale * 8} fill="hsl(var(--primary) / 0.2)" stroke="hsl(var(--primary) / 0.5)" strokeWidth="1" />
          {/* Center dot */}
          <circle cx="40" cy="40" r="2" fill="hsl(var(--primary))" />
          {/* N indicator */}
          <text x="40" y="10" textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize="7" fontWeight="bold">N</text>
        </svg>
        <button
          onClick={handleReset}
          aria-label="Resetar ângulos para padrão"
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider text-muted-foreground/60 active:scale-90 transition-transform"
          style={{ background: 'hsl(var(--surface-2))' }}
        >
          <RotateCcw className="w-3 h-3" />
          Reset
        </button>
      </div>

      {/* Sliders */}
      <div className={cn("flex-1 space-y-3 min-w-0", compact ? "w-full" : "w-full")}>
        {/* Heading */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">Heading</span>
            <span className="font-mono text-[11px] font-bold text-primary tabular-nums">{heading}°</span>
          </div>
          <Slider
            value={[heading]}
            min={0}
            max={360}
            step={1}
            onValueChange={([v]) => onChange(v, pitch, roll)}
            className="h-8"
          />
        </div>

        {/* Pitch */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">Pitch</span>
            <span className="font-mono text-[11px] font-bold text-accent tabular-nums">{pitch}°</span>
          </div>
          <Slider
            value={[pitch]}
            min={0}
            max={90}
            step={1}
            onValueChange={([v]) => onChange(heading, v, roll)}
            className="h-8"
          />
        </div>

        {/* Roll */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">Roll</span>
            <span className="font-mono text-[11px] font-bold text-muted-foreground tabular-nums">{roll}°</span>
          </div>
          <Slider
            value={[roll]}
            min={-180}
            max={180}
            step={1}
            onValueChange={([v]) => onChange(heading, pitch, v)}
            className="h-8"
          />
        </div>
      </div>
    </div>
  );
}
