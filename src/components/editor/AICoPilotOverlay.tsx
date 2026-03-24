/**
 * AICoPilotOverlay — HUD overlay for the 3D viewport showing
 * AI CoPilot mode, assistant orb, and status message.
 */
import { cn } from '@/lib/utils';
import { useAICoPilotStore } from '@/store/useAICoPilotStore';
import { Bot, Shield, Brain, Film, Gamepad2 } from 'lucide-react';

const MODE_ICONS = {
  MANUAL: Gamepad2,
  ASSISTED: Shield,
  AI_CONTROL: Brain,
  CINEMATIC: Film,
} as const;

const MODE_COLORS = {
  MANUAL: 'hsl(220 10% 50%)',
  ASSISTED: 'hsl(200 80% 50%)',
  AI_CONTROL: 'hsl(270 70% 55%)',
  CINEMATIC: 'hsl(32 100% 55%)',
} as const;

export default function AICoPilotOverlay() {
  const enabled = useAICoPilotStore(s => s.enabled);
  const mode = useAICoPilotStore(s => s.mode);
  const assistantState = useAICoPilotStore(s => s.assistantState);
  const hudMessage = useAICoPilotStore(s => s.hudMessage);
  const orbColor = useAICoPilotStore(s => s.orbColor);
  const orbOpacity = useAICoPilotStore(s => s.orbOpacity);
  const overrideActive = useAICoPilotStore(s => s.overrideActive);

  if (!enabled) return null;

  const ModeIcon = MODE_ICONS[mode];
  const modeColor = MODE_COLORS[mode];

  return (
    <div className="absolute top-3 left-3 z-40 pointer-events-none select-none">
      {/* Main pill */}
      <div className="flex items-center gap-2 bg-card/70 backdrop-blur-xl border border-border/20 rounded-xl px-3 py-1.5"
        style={{ borderColor: `${orbColor}25` }}
      >
        {/* Animated Orb */}
        <div className="relative flex items-center justify-center w-6 h-6">
          {/* Outer glow ring */}
          <div
            className="absolute inset-0 rounded-full animate-pulse"
            style={{
              background: `radial-gradient(circle, ${orbColor}40 0%, transparent 70%)`,
              opacity: orbOpacity,
            }}
          />
          {/* Core orb */}
          <div
            className="w-3 h-3 rounded-full relative z-10 transition-all duration-500"
            style={{
              backgroundColor: orbColor,
              opacity: orbOpacity,
              boxShadow: `0 0 6px ${orbColor}80, 0 0 12px ${orbColor}40, 0 0 24px ${orbColor}20`,
            }}
          />
        </div>

        {/* Mode badge */}
        <div className="flex items-center gap-1.5">
          <ModeIcon className="w-3 h-3" style={{ color: modeColor }} />
          <span className="text-[8px] font-mono font-bold tracking-[0.15em]" style={{ color: modeColor }}>
            {mode}
          </span>
        </div>

        {/* Divider */}
        <div className="w-px h-3 bg-border/20" />

        {/* State */}
        <span className={cn("text-[7px] font-mono font-bold tracking-wider",
          assistantState === 'ALERT' ? "text-red-400" :
          assistantState === 'CINEMATIC' ? "text-cyan-400" :
          assistantState === 'GUIDING' ? "text-blue-400" : "text-muted-foreground/50"
        )}>
          {assistantState}
        </span>

        {overrideActive && (
          <>
            <div className="w-px h-3 bg-red-500/30" />
            <span className="text-[7px] font-mono font-bold text-red-400 animate-pulse tracking-wider">
              OVERRIDE
            </span>
          </>
        )}
      </div>

      {/* HUD message below */}
      {hudMessage && (
        <div className="mt-1.5 ml-1 text-[8px] font-mono max-w-[200px] leading-tight"
          style={{ color: `${orbColor}AA`, textShadow: `0 0 8px ${orbColor}30` }}
        >
          {hudMessage}
        </div>
      )}
    </div>
  );
}
