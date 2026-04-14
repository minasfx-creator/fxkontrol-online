import { Shield, CheckCircle2, AlertTriangle } from 'lucide-react';

interface CheckItem {
  label: string;
  ok: boolean;
}

export default function ComplianceChecklist({ items }: { items: CheckItem[] }) {
  const okCount = items.filter(i => i.ok).length;
  const pct = Math.round((okCount / items.length) * 100);
  
  return (
    <div className="rounded-lg border border-border/50 p-2.5 space-y-2">
      <div className="flex items-center gap-1.5">
        <Shield className="h-3 w-3 text-primary" />
        <span className="text-[9px] font-semibold text-foreground uppercase tracking-wider flex-1">Checklist de Conformidade</span>
        <span className={`text-[9px] font-bold ${pct === 100 ? 'text-green-400' : pct >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
          {pct}%
        </span>
      </div>
      
      {/* Progress bar */}
      <div className="h-1 bg-muted rounded-full overflow-hidden">
        <div 
          className={`h-full rounded-full transition-all duration-500 ${pct === 100 ? 'bg-green-500' : pct >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="space-y-1">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-1.5 text-[9px]">
            {item.ok ? (
              <CheckCircle2 className="h-3 w-3 text-green-400 flex-shrink-0" />
            ) : (
              <AlertTriangle className="h-3 w-3 text-yellow-400 flex-shrink-0" />
            )}
            <span className={item.ok ? "text-muted-foreground" : "text-yellow-400"}>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
