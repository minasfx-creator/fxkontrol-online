/**
 * JOIExecutionTracePanel — Shows resolver execution trace
 * Displays which resolvers ran, confidence, source_of_truth, and data provenance
 */
import { useState } from 'react';
import { ChevronDown, ChevronRight, Database, Eye, Cpu, Clock } from 'lucide-react';
import type { JOIExecutionTrace, JOIResolverOutput, JOIConfidenceLevel } from '@/core/joi/joiTypes';
import type { IntegrationMode, EvidenceLevel } from '@/core/hardware/provenance';

const CONF_COLORS: Record<JOIConfidenceLevel, string> = {
  low: '0 70% 50%',
  medium: '38 90% 55%',
  high: '160 80% 45%',
};

const DATA_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  source_of_truth: { label: 'SOURCE', color: '160 80% 45%' },
  inferred: { label: 'INFERRED', color: '38 90% 55%' },
  style_based: { label: 'STYLE', color: '270 80% 60%' },
  conceptual: { label: 'CONCEPT', color: '210 90% 55%' },
};

function ResolverCard({ output }: { output: JOIResolverOutput }) {
  const [expanded, setExpanded] = useState(false);
  const confColor = CONF_COLORS[output.confidence];
  const dtInfo = DATA_TYPE_LABELS[output.data_type] || DATA_TYPE_LABELS.inferred;

  return (
    <div
      className="rounded border transition-all"
      style={{
        background: 'hsl(220 20% 6%)',
        borderColor: `hsl(${confColor} / 0.2)`,
      }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-1.5 px-2 py-1.5 text-left"
      >
        {expanded ? <ChevronDown className="h-2.5 w-2.5 shrink-0" style={{ color: `hsl(${confColor})` }} /> : <ChevronRight className="h-2.5 w-2.5 shrink-0" style={{ color: 'hsl(190 100% 50% / 0.4)' }} />}
        <Cpu className="h-2.5 w-2.5 shrink-0" style={{ color: `hsl(${confColor})` }} />
        <span className="text-[8px] font-mono tracking-wider flex-1 truncate" style={{ color: 'hsl(190 100% 70%)' }}>
          {output.resolver}
        </span>
        <span className="text-[6px] font-mono px-1 py-0.5 rounded uppercase tracking-widest" style={{
          background: `hsl(${confColor} / 0.1)`,
          color: `hsl(${confColor})`,
          border: `1px solid hsl(${confColor} / 0.2)`,
        }}>
          {output.confidence}
        </span>
        <span className="text-[6px] font-mono px-1 py-0.5 rounded uppercase tracking-widest" style={{
          background: `hsl(${dtInfo.color} / 0.1)`,
          color: `hsl(${dtInfo.color})`,
          border: `1px solid hsl(${dtInfo.color} / 0.2)`,
        }}>
          {dtInfo.label}
        </span>
      </button>
      {expanded && (
        <div className="px-2 pb-2 space-y-1" style={{ borderTop: '1px solid hsl(190 100% 50% / 0.06)' }}>
          <p className="text-[8px] font-mono mt-1" style={{ color: 'hsl(38 100% 65%)' }}>{output.summary}</p>
          {output.detail && (
            <pre className="text-[7px] font-mono whitespace-pre-wrap" style={{ color: 'hsl(190 100% 50% / 0.6)' }}>
              {output.detail}
            </pre>
          )}
          <div className="flex items-center gap-1 flex-wrap">
            <Database className="h-2 w-2" style={{ color: 'hsl(190 100% 50% / 0.4)' }} />
            {output.source_of_truth.map(s => (
              <span key={s} className="text-[6px] font-mono px-1 py-0.5 rounded" style={{
                background: 'hsl(190 100% 50% / 0.06)',
                color: 'hsl(190 100% 60%)',
              }}>
                {s}
              </span>
            ))}
          </div>
          {output.artifacts.length > 0 && (
            <div className="text-[7px] font-mono" style={{ color: 'hsl(38 100% 55% / 0.6)' }}>
              📎 {output.artifacts.length} artifact{output.artifacts.length > 1 ? 's' : ''}: {output.artifacts.map(a => a.title).join(', ')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function JOIExecutionTracePanel({ trace }: { trace: JOIExecutionTrace | null }) {
  const [collapsed, setCollapsed] = useState(true);

  if (!trace) return null;

  const confColor = CONF_COLORS[trace.confidence];

  return (
    <div
      className="shrink-0"
      style={{ borderBottom: '1px solid hsl(190 100% 50% / 0.06)', background: 'hsl(220 20% 4% / 0.5)' }}
    >
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center gap-1.5 px-2 py-1.5"
      >
        {collapsed
          ? <ChevronRight className="h-2.5 w-2.5" style={{ color: 'hsl(190 100% 50% / 0.4)' }} />
          : <ChevronDown className="h-2.5 w-2.5" style={{ color: `hsl(${confColor})` }} />
        }
        <Eye className="h-2.5 w-2.5" style={{ color: `hsl(${confColor})` }} />
        <span className="text-[7px] font-mono tracking-[0.2em] uppercase flex-1 text-left" style={{ color: 'hsl(190 100% 50% / 0.5)' }}>
          EXECUTION TRACE
        </span>
        <span className="text-[6px] font-mono" style={{ color: `hsl(${confColor} / 0.7)` }}>
          {trace.resolver_outputs.length} resolvers · {trace.total_ms}ms
        </span>
        <Clock className="h-2 w-2" style={{ color: 'hsl(190 100% 50% / 0.3)' }} />
      </button>
      {!collapsed && (
        <div className="px-2 pb-2 space-y-1">
          {/* Intent summary */}
          <div className="flex items-center gap-1 flex-wrap text-[7px] font-mono">
            <span style={{ color: 'hsl(190 100% 50% / 0.4)' }}>Intent:</span>
            <span className="px-1 py-0.5 rounded" style={{
              background: `hsl(${confColor} / 0.1)`,
              color: `hsl(${confColor})`,
            }}>
              {trace.plan.intent.category}
            </span>
            {trace.plan.intent.subcategories.map(sc => (
              <span key={sc} className="px-1 py-0.5 rounded" style={{
                background: 'hsl(210 90% 55% / 0.08)',
                color: 'hsl(210 90% 65%)',
              }}>
                {sc}
              </span>
            ))}
          </div>

          {/* Resolver outputs */}
          <div className="space-y-1">
            {trace.resolver_outputs.map((o, i) => (
              <ResolverCard key={i} output={o} />
            ))}
          </div>

          {/* Artifacts count */}
          {trace.artifacts.length > 0 && (
            <div className="text-[7px] font-mono" style={{ color: 'hsl(38 100% 55% / 0.5)' }}>
              📎 {trace.artifacts.length} total artifacts generated
            </div>
          )}
        </div>
      )}
    </div>
  );
}
