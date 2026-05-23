/**
 * VerificationBar — Horizontal status bar showing binary system readiness.
 * Mounts at the top of the editor; color-coded by VerificationLevel.
 */
import { useEffect } from 'react';
import { useVerificationStore } from '@/core/verification/useVerificationStore';
import { Shield, CheckCircle2, AlertTriangle, XOctagon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useShallow } from 'zustand/react/shallow';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

const LEVEL_CONFIG = {
  READY_FOR_FIELD: {
    label: 'READY FOR FIELD',
    color: 'hsl(var(--success))',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
    text: 'text-emerald-400',
    icon: CheckCircle2,
  },
  READY_FOR_EXPORT: {
    label: 'READY FOR EXPORT',
    color: 'hsl(var(--warning))',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    text: 'text-amber-400',
    icon: AlertTriangle,
  },
  READY_FOR_SIMULATION: {
    label: 'READY FOR SIMULATION',
    color: 'hsl(var(--fxk-cyan))',
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-500/30',
    text: 'text-cyan-400',
    icon: Shield,
  },
  BLOCKED: {
    label: 'BLOCKED',
    color: 'hsl(var(--destructive))',
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    text: 'text-red-400',
    icon: XOctagon,
  },
} as const;

export default function VerificationBar() {
  const { result, level, isRunning, runVerification } = useVerificationStore(useShallow((s) => ({ result: s.result, level: s.level, isRunning: s.isRunning, runVerification: s.runVerification })));

  // Run verification on mount
  useEffect(() => {
    runVerification();
  }, [runVerification]);

  const config = LEVEL_CONFIG[level];
  const Icon = config.icon;
  const passed = result?.summary.passed ?? 0;
  const total = result?.summary.total ?? 0;

  return (
    <Collapsible>
      <div className="relative">
        <CollapsibleTrigger asChild>
          <button
            className={cn(
              'w-full flex items-center gap-2 px-3 py-1 text-[10px] font-mono tracking-widest uppercase transition-all',
              'border-b backdrop-blur-md cursor-pointer hover:brightness-110',
              config.bg, config.border, config.text,
            )}
            style={{ background: `linear-gradient(90deg, transparent, ${config.color}08, transparent)` }}
          >
            <Icon className="w-3 h-3 shrink-0" />
            <span className="font-black">{config.label}</span>
            <span className="opacity-60 ml-1">
              {isRunning ? 'CHECKING...' : `${passed}/${total} CHECKS`}
            </span>
            <div className="flex-1" />
          </button>
        </CollapsibleTrigger>
        <div
          role="button"
          tabIndex={0}
          onClick={(e) => { e.stopPropagation(); runVerification(); }}
          onKeyDown={(e) => { if (e.key === 'Enter') runVerification(); }}
          className={cn(
            'absolute right-2 top-1/2 -translate-y-1/2 text-[8px] px-1.5 py-0.5 rounded border border-current/20 hover:bg-current/10 transition-colors cursor-pointer z-10',
            config.text
          )}
        >
          RE-CHECK
        </div>
      </div>

      <CollapsibleContent>
        <div className={cn('border-b px-3 py-2 space-y-1', config.bg, config.border)}>
          {result?.issues.map(check => (
            <div key={check.id} className="flex items-center gap-2 text-[9px] font-mono">
              <span className={check.passed ? 'text-emerald-400' : check.severity === 'error' ? 'text-red-400' : 'text-amber-400'}>
                {check.passed ? '●' : '○'}
              </span>
              <span className="text-muted-foreground uppercase tracking-wider flex-1">{check.label}</span>
              <span className={cn(
                'text-[8px] px-1 rounded',
                check.passed ? 'text-emerald-400/70' : check.severity === 'error' ? 'text-red-400/70' : 'text-amber-400/70'
              )}>
                {check.passed ? 'PASS' : check.severity === 'error' ? 'FAIL' : 'WARN'}
              </span>
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
