import { useMemo, useState } from 'react';
import { ClaimBadge } from './ClaimBadge';
import type { ClaimStatus, ClaimDomain } from '@/lib/claims';
import { Search, ExternalLink, FileText, Video, Presentation, Cpu, Image as ImageIcon, Box } from 'lucide-react';

export type AssetKind = 'pitch' | 'video' | 'previs' | 'doc' | 'demo' | 'spec' | 'image';
export type AssetAudience = 'enterprise' | 'producer' | 'operator' | 'investor';
export type FunnelStage = 'top' | 'mid' | 'bottom' | 'post-sale';

export interface StrategicAsset {
  id: string;
  title: string;
  description: string;
  kind: AssetKind;
  audience: AssetAudience[];
  funnel: FunnelStage;
  language: 'en' | 'pt' | 'bilingual';
  claimStatus: ClaimStatus;
  domain?: ClaimDomain;
  href?: string;
  owner?: string;
}

const KIND_ICON: Record<AssetKind, React.ComponentType<{ className?: string }>> = {
  pitch: Presentation,
  video: Video,
  previs: Box,
  doc: FileText,
  demo: Cpu,
  spec: FileText,
  image: ImageIcon,
};

export const SEED_ASSETS: StrategicAsset[] = [
  {
    id: 'pitch-us-v1',
    title: 'US Pitch Package v1',
    description: 'First US-facing pitch: Operating System for Massive Spectacles, three core messages, ICP map.',
    kind: 'pitch',
    audience: ['enterprise', 'producer', 'investor'],
    funnel: 'top',
    language: 'en',
    claimStatus: 'pilot',
    domain: 'workflow',
  },
  {
    id: 'previs-skycanvas-demo',
    title: 'SkyCanvas Previs Demo',
    description: 'Live previs walkthrough used to sell shows before any hardware mobilization.',
    kind: 'previs',
    audience: ['producer', 'operator'],
    funnel: 'mid',
    language: 'bilingual',
    claimStatus: 'validated',
    domain: 'workflow',
    href: '/studio',
  },
  {
    id: 'demo-go-live-center',
    title: 'Go-Live Center Walkthrough',
    description: 'Operational trust surface: simulation, evidence, readiness, rollback, audit.',
    kind: 'demo',
    audience: ['operator', 'enterprise'],
    funnel: 'bottom',
    language: 'en',
    claimStatus: 'validated',
    domain: 'safety',
    href: '/command',
  },
  {
    id: 'spec-docktwin-pilot',
    title: 'DockTwin Pilot Spec',
    description: 'Bench validation, serviceability, companion telemetry, modular peripherals.',
    kind: 'spec',
    audience: ['enterprise', 'operator'],
    funnel: 'mid',
    language: 'en',
    claimStatus: 'pilot',
    domain: 'hardware',
  },
  {
    id: 'doc-claim-policy',
    title: 'Claim Policy (US)',
    description: 'Validated / pilot / marketing_hypothesis tagging for every external claim.',
    kind: 'doc',
    audience: ['enterprise', 'investor'],
    funnel: 'post-sale',
    language: 'en',
    claimStatus: 'validated',
    domain: 'compliance',
  },
  {
    id: 'video-ai-choreography',
    title: 'AI Choreography Studio Reel',
    description: 'Editable scenes, drone formations and DMX looks. Guardrails: no recipes, no ignition.',
    kind: 'video',
    audience: ['producer', 'investor'],
    funnel: 'top',
    language: 'bilingual',
    claimStatus: 'pilot',
    domain: 'workflow',
  },
];

interface Props {
  onSelectionChange?: (selectedIds: string[]) => void;
}

export function AssetLibrary({ onSelectionChange }: Props) {
  const [query, setQuery] = useState('');
  const [audience, setAudience] = useState<AssetAudience | 'all'>('all');
  const [funnel, setFunnel] = useState<FunnelStage | 'all'>('all');
  const [claim, setClaim] = useState<ClaimStatus | 'all'>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    return SEED_ASSETS.filter((a) => {
      if (query && !`${a.title} ${a.description}`.toLowerCase().includes(query.toLowerCase())) return false;
      if (audience !== 'all' && !a.audience.includes(audience)) return false;
      if (funnel !== 'all' && a.funnel !== funnel) return false;
      if (claim !== 'all' && a.claimStatus !== claim) return false;
      return true;
    });
  }, [query, audience, funnel, claim]);

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
    onSelectionChange?.(Array.from(next));
  };

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search assets…"
            className="w-full bg-background/40 border border-border rounded-md pl-8 pr-3 py-1.5 text-xs ds-mono focus:outline-none focus:border-primary/50"
          />
        </div>
        <FilterSelect value={audience} onChange={(v) => setAudience(v as any)} options={['all','enterprise','producer','operator','investor']} label="audience" />
        <FilterSelect value={funnel} onChange={(v) => setFunnel(v as any)} options={['all','top','mid','bottom','post-sale']} label="funnel" />
        <FilterSelect value={claim} onChange={(v) => setClaim(v as any)} options={['all','validated','pilot','marketing_hypothesis']} label="claim" />
      </div>

      <p className="text-[10px] ds-mono text-muted-foreground uppercase tracking-wider">
        {filtered.length} assets · {selected.size} selected for export
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {filtered.map((a) => {
          const Icon = KIND_ICON[a.kind];
          const isSel = selected.has(a.id);
          return (
            <button
              key={a.id}
              onClick={() => toggle(a.id)}
              className={`text-left rounded-md border p-3 transition-colors ${isSel ? 'border-primary/60 bg-primary/5' : 'border-border bg-background/30 hover:border-border-strong'}`}
            >
              <div className="flex items-start gap-2">
                <Icon className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-xs font-semibold text-foreground">{a.title}</h4>
                    <ClaimBadge status={a.claimStatus} />
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{a.description}</p>
                  <div className="flex items-center gap-2 mt-2 text-[9px] ds-mono uppercase tracking-wider text-muted-foreground/80">
                    <span>{a.kind}</span>
                    <span>·</span>
                    <span>{a.funnel}</span>
                    <span>·</span>
                    <span>{a.language}</span>
                    {a.href && <ExternalLink className="h-3 w-3 ml-auto" />}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function FilterSelect({ value, onChange, options, label }: { value: string; onChange: (v: string) => void; options: string[]; label: string }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={label}
      className="bg-background/40 border border-border rounded-md px-2 py-1.5 text-xs ds-mono uppercase tracking-wider text-foreground focus:outline-none focus:border-primary/50"
    >
      {options.map((o) => (
        <option key={o} value={o}>{label}: {o}</option>
      ))}
    </select>
  );
}
