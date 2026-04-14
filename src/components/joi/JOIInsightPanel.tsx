/**
 * JOIInsightPanel — Collapsible blockers/warnings/recommendations panel
 */
import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, XCircle, Info, Lightbulb } from 'lucide-react';
import { joiContextBuilder } from '@/core/joi/JoiContextBuilder';

interface InsightItem {
  severity: 'error' | 'warning' | 'info';
  source: string;
  message: string;
}

export function JOIInsightPanel() {
  const [expanded, setExpanded] = useState(false);

  const insights = useMemo<InsightItem[]>(() => {
    const ctx = joiContextBuilder.build();
    const items: InsightItem[] = [];

    // Blockers from verification
    ctx.verification.blockers.forEach(b => {
      items.push({ severity: 'error', source: 'Verification', message: b });
    });

    // Readiness issues
    ctx.readiness.issues.forEach(issue => {
      const sev = issue.includes('[error]') ? 'error' as const : issue.includes('[warning]') ? 'warning' as const : 'info' as const;
      items.push({ severity: sev, source: 'Readiness', message: issue.replace(/\[(error|warning|info)\]\s*/, '') });
    });

    // Hardware warnings
    if (ctx.hardware.errors > 0) {
      items.push({ severity: 'error', source: 'Hardware', message: `${ctx.hardware.errors} device error(s) detected` });
    }
    if (ctx.hardware.simulatedCount === ctx.hardware.totalAdapters && ctx.hardware.totalAdapters > 0) {
      items.push({ severity: 'info', source: 'Hardware', message: 'All adapters are SIMULATED — no real hardware connected' });
    }

    return items;
  }, []);

  const errorCount = insights.filter(i => i.severity === 'error').length;
  const warnCount = insights.filter(i => i.severity === 'warning').length;

  if (insights.length === 0) return null;

  const Icon = expanded ? ChevronUp : ChevronDown;
  const SeverityIcon = ({ sev }: { sev: string }) => {
    if (sev === 'error') return <XCircle className="h-2.5 w-2.5 shrink-0" style={{ color: 'hsl(0 70% 55%)' }} />;
    if (sev === 'warning') return <AlertTriangle className="h-2.5 w-2.5 shrink-0" style={{ color: 'hsl(38 90% 55%)' }} />;
    return <Info className="h-2.5 w-2.5 shrink-0" style={{ color: 'hsl(210 90% 55%)' }} />;
  };

  return (
    <div
      className="shrink-0"
      style={{ borderBottom: '1px solid hsl(190 100% 50% / 0.06)' }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-1.5 px-2 py-1 text-[7px] font-mono tracking-wider uppercase hover:bg-white/[0.02] transition-colors"
        style={{ color: errorCount > 0 ? 'hsl(0 70% 60%)' : warnCount > 0 ? 'hsl(38 90% 60%)' : 'hsl(190 100% 50% / 0.5)' }}
      >
        <Lightbulb className="h-2.5 w-2.5" />
        <span>INSIGHTS</span>
        {errorCount > 0 && (
          <span className="px-1 rounded text-[6px]" style={{ background: 'hsl(0 70% 50% / 0.15)', color: 'hsl(0 70% 60%)' }}>
            {errorCount} ERR
          </span>
        )}
        {warnCount > 0 && (
          <span className="px-1 rounded text-[6px]" style={{ background: 'hsl(38 90% 50% / 0.15)', color: 'hsl(38 90% 60%)' }}>
            {warnCount} WARN
          </span>
        )}
        <Icon className="h-2.5 w-2.5 ml-auto" />
      </button>

      {expanded && (
        <div className="px-2 pb-1.5 space-y-1 max-h-32 overflow-y-auto animate-fade-in">
          {insights.map((item, i) => (
            <div
              key={i}
              className="flex items-start gap-1.5 px-1.5 py-1 rounded text-[8px] font-mono"
              style={{
                background: item.severity === 'error' ? 'hsl(0 70% 50% / 0.06)' : item.severity === 'warning' ? 'hsl(38 90% 50% / 0.06)' : 'hsl(210 90% 50% / 0.06)',
                color: 'hsl(180 8% 75%)',
              }}
            >
              <SeverityIcon sev={item.severity} />
              <div className="min-w-0">
                <span className="text-[6px] tracking-wider uppercase opacity-50">{item.source}</span>
                <p className="leading-tight">{item.message}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
