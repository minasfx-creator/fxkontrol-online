/**
 * CommandStatusIndicators — Global safety state + verification level indicators
 * Displayed across all CommandCenter consoles for persistent situational awareness.
 */
import { useEffect } from 'react';
import { useVerificationStore } from '@/core/verification/useVerificationStore';
import { safetyStateMachine } from '@/core/safety/SafetyStateMachine';
import { cn } from '@/lib/utils';
import { Shield, CheckCircle2, XOctagon, AlertTriangle, Lock } from 'lucide-react';

/** Compact inline indicators for top bars */
export function StatusChips() {
  const { level, result, runVerification } = useVerificationStore();
  const safetyState = safetyStateMachine.state;

  useEffect(() => { runVerification(); }, [runVerification]);

  const safetyConfig = {
    IDLE: { color: 'text-muted-foreground/60', bg: 'bg-muted/20 border-border/20', label: 'IDLE' },
    LOCKED: { color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20', label: 'LOCKED' },
    ARMED: { color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20', label: 'ARMED' },
    FIRING: { color: 'text-red-400', bg: 'bg-red-500/15 border-red-500/30', label: 'FIRING' },
    COOLDOWN: { color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20', label: 'COOLDOWN' },
    SAFE: { color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', label: 'SAFE' },
  }[safetyState] ?? { color: 'text-muted-foreground', bg: 'bg-muted/20 border-border/20', label: safetyState };

  const verifyConfig = {
    READY_FOR_FIELD: { color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', icon: CheckCircle2, label: 'FIELD' },
    READY_FOR_EXPORT: { color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20', icon: CheckCircle2, label: 'EXPORT' },
    READY_FOR_SIMULATION: { color: 'text-cyan-400', bg: 'bg-cyan-500/10 border-cyan-500/20', icon: AlertTriangle, label: 'SIM' },
    BLOCKED: { color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20', icon: XOctagon, label: 'BLOCKED' },
  }[level] ?? { color: 'text-muted-foreground', bg: 'bg-muted/20 border-border/20', icon: XOctagon, label: level };

  const passed = result?.checks.filter(c => c.passed).length ?? 0;
  const total = result?.checks.length ?? 0;

  return (
    <div className="flex items-center gap-1.5">
      {/* Safety State */}
      <div className={cn(
        'flex items-center gap-1 px-1.5 py-0.5 rounded border text-[7px] font-mono font-bold tracking-wider',
        safetyConfig.bg
      )}>
        {safetyState === 'ARMED' || safetyState === 'FIRING' ? (
          <Shield className={cn('w-2.5 h-2.5 animate-pulse', safetyConfig.color)} />
        ) : safetyState === 'LOCKED' ? (
          <Lock className={cn('w-2.5 h-2.5', safetyConfig.color)} />
        ) : (
          <Shield className={cn('w-2.5 h-2.5', safetyConfig.color)} />
        )}
        <span className={safetyConfig.color}>{safetyConfig.label}</span>
      </div>

      {/* Verification Level */}
      <div className={cn(
        'flex items-center gap-1 px-1.5 py-0.5 rounded border text-[7px] font-mono font-bold tracking-wider',
        verifyConfig.bg
      )}>
        <verifyConfig.icon className={cn('w-2.5 h-2.5', verifyConfig.color)} />
        <span className={verifyConfig.color}>{passed}/{total}</span>
        <span className={cn('opacity-60', verifyConfig.color)}>{verifyConfig.label}</span>
      </div>
    </div>
  );
}

/** Sidebar footer widget — more detailed */
export function SidebarStatusWidget({ collapsed }: { collapsed: boolean }) {
  const { level, result, runVerification } = useVerificationStore();
  const safetyState = safetyStateMachine.state;

  useEffect(() => { runVerification(); }, [runVerification]);

  const isHot = safetyState === 'ARMED' || safetyState === 'FIRING';
  const passed = result?.checks.filter(c => c.passed).length ?? 0;
  const total = result?.checks.length ?? 0;

  if (collapsed) {
    return (
      <div className="flex flex-col items-center gap-1.5 py-2">
        <div className={cn(
          'w-2.5 h-2.5 rounded-full',
          isHot ? 'bg-destructive animate-pulse' :
          safetyState === 'LOCKED' ? 'bg-amber-400' :
          safetyState === 'SAFE' ? 'bg-emerald-400' :
          'bg-muted-foreground/30'
        )} style={isHot ? { boxShadow: '0 0 8px hsl(var(--destructive))' } : undefined} />
        <div className={cn(
          'w-2.5 h-2.5 rounded-full',
          level === 'READY_FOR_FIELD' ? 'bg-emerald-400' :
          level === 'BLOCKED' ? 'bg-red-400' :
          'bg-amber-400'
        )} />
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {/* Safety */}
      <div className={cn(
        'flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all duration-300',
        isHot ? 'danger-stripe border-destructive/20' : 'border-border/10'
      )} style={{
        background: isHot ? 'hsl(var(--destructive) / 0.06)' : 'hsl(var(--muted) / 0.1)',
      }}>
        <Shield className={cn('h-3 w-3 shrink-0', isHot ? 'text-destructive animate-pulse' : 'text-muted-foreground/40')} />
        <div className="flex-1 min-w-0">
          <span className={cn(
            'text-[7px] font-bold font-mono tracking-[0.15em]',
            isHot ? 'text-destructive' : 'text-muted-foreground/50'
          )}>
            {isHot ? `${safetyState} // HOT` : `SAFETY: ${safetyState}`}
          </span>
        </div>
      </div>

      {/* Verification */}
      <div className={cn(
        'flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all duration-300',
        level === 'READY_FOR_FIELD' ? 'border-emerald-500/15' :
        level === 'BLOCKED' ? 'border-red-500/15' :
        'border-border/10'
      )} style={{
        background: level === 'READY_FOR_FIELD' ? 'hsl(142 76% 36% / 0.04)' :
                    level === 'BLOCKED' ? 'hsl(0 84% 60% / 0.04)' :
                    'hsl(var(--muted) / 0.1)',
      }}>
        {level === 'READY_FOR_FIELD' ? (
          <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-400/60" />
        ) : level === 'BLOCKED' ? (
          <XOctagon className="h-3 w-3 shrink-0 text-red-400/60" />
        ) : (
          <AlertTriangle className="h-3 w-3 shrink-0 text-amber-400/60" />
        )}
        <span className={cn(
          'text-[7px] font-bold font-mono tracking-[0.15em]',
          level === 'READY_FOR_FIELD' ? 'text-emerald-400/60' :
          level === 'BLOCKED' ? 'text-red-400/60' :
          'text-amber-400/60'
        )}>
          {passed}/{total} CHECKS · {level.replace(/_/g, ' ')}
        </span>
      </div>
    </div>
  );
}
