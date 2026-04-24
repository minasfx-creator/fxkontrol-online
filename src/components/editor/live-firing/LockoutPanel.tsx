/**
 * LockoutPanel — Finale 3D Risk Group Lockout System UI.
 * Reads / toggles Risk Groups (A–E) from useProjectStore.
 */
import { Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useProjectStore } from '@/store/useProjectStore';
import { RISK_GROUP_COLORS, RISK_GROUP_LABELS, type RiskGroup } from '@/lib/pyroPhysics';

interface LockoutPanelProps {
  fs: boolean;
  mob: boolean;
}

export default function LockoutPanel({ fs, mob }: LockoutPanelProps) {
  const activeLockouts = useProjectStore(s => s.activeLockouts);
  const toggleLockout = useProjectStore(s => s.toggleLockout);
  const groups: RiskGroup[] = ['A', 'B', 'C', 'D', 'E'];

  return (
    <div className={cn("border-t border-border/15", fs && mob ? "px-3 py-1.5" : fs ? "px-4 py-2" : "px-2 py-1")} style={{ background: 'hsl(220 12% 7%)' }}>
      <div className={cn("flex items-center gap-2 mb-1", fs ? "text-[9px]" : "text-[8px]")}>
        <Shield className={cn(fs ? "w-3.5 h-3.5" : "w-2.5 h-2.5", "text-amber-400/60")} />
        <span className="font-bold text-muted-foreground/50 uppercase tracking-wider">Lockout Groups</span>
      </div>
      <div className={cn("flex gap-1", fs && mob ? "flex-wrap" : "")}>
        {groups.map(g => {
          const locked = activeLockouts.includes(g);
          return (
            <button
              key={g}
              onClick={() => toggleLockout(g)}
              className={cn(
                "flex-1 rounded border-2 font-bold uppercase transition-all flex flex-col items-center",
                fs && mob ? "py-2 text-[9px] min-w-[60px]" : fs ? "py-1.5 text-[10px]" : "py-1 text-[10px]",
                locked
                  ? "border-red-500/60 bg-red-500/15 text-red-400"
                  : "border-border/20 bg-[hsl(220_10%_10%)] text-muted-foreground/40 hover:border-border/40"
              )}
            >
              <span className="font-black" style={{ color: locked ? undefined : RISK_GROUP_COLORS[g] }}>{g}</span>
              <span className={cn("font-normal", fs ? "text-[10px]" : "text-[10px]")}>
                {locked ? 'LOCKED' : RISK_GROUP_LABELS[g].split(' ')[0]}
              </span>
            </button>
          );
        })}
      </div>
      {activeLockouts.length > 0 && (
        <div className={cn("text-center font-bold text-red-400/70 uppercase mt-1", fs ? "text-[10px]" : "text-[10px]")}>
          {activeLockouts.length} GROUP{activeLockouts.length > 1 ? 'S' : ''} LOCKED OUT
        </div>
      )}
    </div>
  );
}
