import { BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface QuickStat {
  label: string;
  value: string;
  status: 'ok' | 'warn' | 'critical';
}

export default function QuickStats({ stats }: { stats: QuickStat[] }) {
  return (
    <div className="px-2 py-2 border-b border-border/50">
      <div className="flex items-center gap-1.5 mb-1.5">
        <BarChart3 className="h-3 w-3 text-muted-foreground" />
        <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">Resumo do Projeto</span>
      </div>
      <div className="grid grid-cols-5 gap-1">
        {stats.map(s => (
          <div key={s.label} className={cn(
            "rounded-md px-1.5 py-1.5 text-center border transition-colors",
            s.status === 'ok' && "bg-green-500/5 border-green-500/20",
            s.status === 'warn' && "bg-yellow-500/5 border-yellow-500/20",
            s.status === 'critical' && "bg-red-500/5 border-red-500/20",
          )}>
            <div className={cn(
              "text-[11px] font-bold font-mono leading-tight",
              s.status === 'ok' && "text-green-400",
              s.status === 'warn' && "text-yellow-400",
              s.status === 'critical' && "text-red-400",
            )}>
              {s.value}
            </div>
            <div className="text-[7px] text-muted-foreground truncate mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
