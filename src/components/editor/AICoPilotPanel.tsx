/**
 * AICoPilotPanel — Control panel for AI CoPilot integrated into ShowControlPanel.
 * Provides mode toggles, assist level slider, voice toggle, and live status display.
 */
import { cn } from '@/lib/utils';
import { Bot, Volume2, VolumeX, Shield, Zap, Eye, Film, Gamepad2, Brain } from 'lucide-react';
import { useAICoPilotStore, type AICoPilotMode } from '@/store/useAICoPilotStore';
import { Slider } from '@/components/ui/slider';

const MODES: { id: AICoPilotMode; label: string; icon: typeof Gamepad2; desc: string; color: string }[] = [
  { id: 'MANUAL', label: 'MAN', icon: Gamepad2, desc: 'Raw input', color: 'hsl(220 10% 50%)' },
  { id: 'ASSISTED', label: 'AST', icon: Shield, desc: 'Safety + smooth', color: 'hsl(200 80% 50%)' },
  { id: 'AI_CONTROL', label: 'AI', icon: Brain, desc: 'Full auto', color: 'hsl(270 70% 55%)' },
  { id: 'CINEMATIC', label: 'CIN', icon: Film, desc: 'Dampened', color: 'hsl(32 100% 55%)' },
];

export default function AICoPilotPanel() {
  const enabled = useAICoPilotStore(s => s.enabled);
  const mode = useAICoPilotStore(s => s.mode);
  const assistLevel = useAICoPilotStore(s => s.assistLevel);
  const voiceEnabled = useAICoPilotStore(s => s.voiceEnabled);
  const assistantState = useAICoPilotStore(s => s.assistantState);
  const hudMessage = useAICoPilotStore(s => s.hudMessage);
  const orbColor = useAICoPilotStore(s => s.orbColor);
  const orbOpacity = useAICoPilotStore(s => s.orbOpacity);
  const overrideActive = useAICoPilotStore(s => s.overrideActive);
  const setEnabled = useAICoPilotStore(s => s.setEnabled);
  const setMode = useAICoPilotStore(s => s.setMode);
  const setAssistLevel = useAICoPilotStore(s => s.setAssistLevel);
  const setVoiceEnabled = useAICoPilotStore(s => s.setVoiceEnabled);

  return (
    <div className="border-t relative z-10" style={{ borderColor: 'hsl(270 50% 40% / 0.12)', background: 'linear-gradient(180deg, hsl(270 30% 6% / 0.5) 0%, transparent 100%)' }}>
      {/* Header */}
      <div className="px-3 py-1.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Orb indicator */}
          <div className="relative">
            <div
              className={cn("w-3 h-3 rounded-full transition-all duration-500", enabled && "animate-pulse")}
              style={{
                backgroundColor: enabled ? orbColor : 'hsl(220 10% 20%)',
                opacity: enabled ? orbOpacity : 0.3,
                boxShadow: enabled ? `0 0 8px ${orbColor}60, 0 0 16px ${orbColor}30` : 'none',
              }}
            />
          </div>
          <Bot className="w-3 h-3" style={{ color: enabled ? 'hsl(270 70% 60%)' : 'hsl(220 10% 30%)' }} />
          <span className="text-[7px] font-mono font-bold tracking-[0.2em]" style={{ color: enabled ? 'hsl(270 70% 65%)' : 'hsl(220 10% 35%)' }}>
            AI COPILOT
          </span>
        </div>
        <div className="flex items-center gap-2">
          {overrideActive && (
            <span className="text-[6px] font-mono font-bold text-red-400 animate-pulse tracking-wider">OVERRIDE</span>
          )}
          <span className={cn("text-[7px] font-mono font-bold tracking-wider",
            assistantState === 'ALERT' ? "text-red-400" :
            assistantState === 'CINEMATIC' ? "text-cyan-400" :
            assistantState === 'GUIDING' ? "text-blue-400" : "text-muted-foreground/40"
          )}>
            {assistantState}
          </span>
          {/* Enable toggle */}
          <button
            onClick={() => setEnabled(!enabled)}
            className={cn("px-2 py-0.5 rounded text-[7px] font-mono font-bold tracking-wider transition-all",
              enabled
                ? "text-green-300 border border-green-500/30 bg-green-500/10"
                : "text-muted-foreground/40 border border-white/5 bg-white/[0.02] hover:bg-white/[0.04]"
            )}
          >
            {enabled ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>

      {enabled && (
        <>
          {/* Mode selector */}
          <div className="px-3 pb-1.5 flex items-center gap-1">
            {MODES.map(m => {
              const Icon = m.icon;
              const active = mode === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => setMode(m.id)}
                  className={cn(
                    "flex-1 flex flex-col items-center gap-0.5 py-1 rounded transition-all",
                    active
                      ? "border border-opacity-30"
                      : "border border-transparent hover:bg-white/[0.03]"
                  )}
                  style={active ? {
                    borderColor: `${m.color}50`,
                    background: `${m.color}12`,
                  } : undefined}
                  title={m.desc}
                >
                  <Icon className="w-3 h-3" style={{ color: active ? m.color : 'hsl(220 10% 30%)' }} />
                  <span className="text-[6px] font-mono font-bold tracking-wider" style={{ color: active ? m.color : 'hsl(220 10% 35%)' }}>
                    {m.label}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Assist level + Voice */}
          <div className="px-3 pb-1.5 flex items-center gap-3">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[6px] font-mono text-muted-foreground/30 tracking-wider">ASSIST</span>
                <span className="text-[7px] font-mono font-bold" style={{ color: 'hsl(270 60% 55%)' }}>
                  {Math.round(assistLevel * 100)}%
                </span>
              </div>
              <Slider
                value={[assistLevel * 100]}
                onValueChange={([v]) => setAssistLevel(v / 100)}
                max={100}
                min={0}
                step={5}
                className="h-2"
              />
            </div>
            <button
              onClick={() => setVoiceEnabled(!voiceEnabled)}
              className={cn("p-1 rounded transition-all",
                voiceEnabled ? "bg-cyan-500/10 border border-cyan-500/20" : "border border-white/5 hover:bg-white/[0.03]"
              )}
              title={voiceEnabled ? 'Voice ON' : 'Voice OFF'}
            >
              {voiceEnabled ? (
                <Volume2 className="w-3 h-3 text-cyan-400" />
              ) : (
                <VolumeX className="w-3 h-3 text-muted-foreground/30" />
              )}
            </button>
          </div>

          {/* HUD Message */}
          <div className="px-3 pb-2">
            <div className="px-2 py-1 rounded text-[7px] font-mono" style={{
              background: `${orbColor}08`,
              borderLeft: `2px solid ${orbColor}40`,
              color: `${orbColor}CC`,
            }}>
              {hudMessage}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
