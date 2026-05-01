import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Download, Layers, Wand2, Wrench, ClipboardCheck, Calendar } from 'lucide-react';
import { AssetLibrary, SEED_ASSETS } from '@/components/strategy/AssetLibrary';
import { AIChoreographyStudioStub } from '@/components/strategy/AIChoreographyStudioStub';
import { DockTwinPilotPanel } from '@/components/strategy/DockTwinPilotPanel';
import { ClientApprovalPanel } from '@/components/strategy/ClientApprovalPanel';
import { ClaimBadge } from '@/components/strategy/ClaimBadge';
import { CLAIMS } from '@/lib/claims';

type TabId = 'assets' | 'ai' | 'docktwin' | 'approval' | 'plan';

const TABS: { id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'assets', label: 'Asset Library', icon: Layers },
  { id: 'ai', label: 'AI Choreography', icon: Wand2 },
  { id: 'docktwin', label: 'DockTwin Pilot', icon: Wrench },
  { id: 'approval', label: 'Client Approval', icon: ClipboardCheck },
  { id: 'plan', label: '90-Day Plan', icon: Calendar },
];

const PLAN: { window: string; goals: string[] }[] = [
  {
    window: 'Days 1–15',
    goals: [
      'Inventory all strategic assets',
      'Classify assets by audience, funnel stage and language',
      'Create the first US pitch package',
      'Map module maturity',
      'Connect strategy narrative to Go-Live and product docs',
    ],
  },
  {
    window: 'Days 16–35',
    goals: [
      'Use Strategic Command Hub in live demos',
      'Build segmented landing and sales follow-up package',
      'Create client approval reports',
      'Export strategy reports after each demo',
    ],
  },
  {
    window: 'Days 36–60',
    goals: [
      'Expand AI Choreography Studio with real validation and Skybrush export binding',
      'Expand DockTwin with live companion telemetry in bench mode',
      'Attach evidence to DockTwin and Go-Live readiness',
    ],
  },
  {
    window: 'Days 61–90',
    goals: [
      'Run three US-facing pilot demos',
      'Collect objections and pricing feedback',
      'Package Previs, LiveOps Pilot and Enterprise offers',
      'Convert one pilot into a documented case',
    ],
  },
];

export default function Strategy() {
  const [tab, setTab] = useState<TabId>('assets');
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);

  const exportPackage = () => {
    const selected = selectedAssetIds.length
      ? SEED_ASSETS.filter((a) => selectedAssetIds.includes(a.id))
      : SEED_ASSETS;
    const pkg = {
      schema: 'fxkontrol.strategy.v1',
      generatedAt: new Date().toISOString(),
      positioning: 'The Operating System for Massive Spectacles.',
      coreMessages: [
        'End the broken stage',
        'Sell before deployment',
        'Safety-first spectacle OS',
      ],
      pillars: ['Strategic Command Hub', 'Go-Live Center', 'AI Choreography Studio', 'DockTwin Pilot', 'Client Approval Flow'],
      assets: selected,
      claims: CLAIMS,
      plan90: PLAN,
      claimPolicy: {
        validated: 'safe to use as factual or source-backed',
        pilot: 'usable with pilot language and disclaimers',
        marketing_hypothesis: 'useful for narrative, not proof',
        notes:
          'NFPA, FAA, latency, cost-reduction, range and hardware claims require careful review before being used as commercial guarantees in the US.',
      },
    };
    const blob = new Blob([JSON.stringify(pkg, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fxkontrol-strategy-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <Helmet>
        <title>Strategic Command Hub · FXKONTROL</title>
        <meta
          name="description"
          content="GTM hub: asset library, AI choreography, DockTwin pilot and client approval. Strategy package for investor and client demos."
        />
      </Helmet>

      <div className="min-h-[100dvh] p-4 md:p-6 space-y-4">
        {/* Header */}
        <header className="space-y-2">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="text-[10px] ds-mono uppercase tracking-[0.25em] text-muted-foreground">Strategic Command Hub</p>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">The Operating System for Massive Spectacles</h1>
            </div>
            <button
              onClick={exportPackage}
              className="inline-flex items-center gap-2 rounded-md bg-primary/10 border border-primary/40 px-3 py-2 text-xs ds-mono uppercase tracking-wider text-primary hover:bg-primary/20"
            >
              <Download className="h-3.5 w-3.5" />
              Export strategy package
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            {[
              { t: 'End the broken stage', d: 'Replace fragmented drone, pyro, DMX, approval and reporting tools with one command surface.' },
              { t: 'Sell before deployment', d: 'SkyCanvas, Unreal/Pixel Streaming, AR Overlay and reports before hardware mobilization.' },
              { t: 'Safety-first spectacle OS', d: 'Simulation, evidence, readiness, rollback and audit as sales proof.' },
            ].map((m) => (
              <div key={m.t} className="rounded-md border border-border bg-background/30 p-3">
                <h3 className="text-xs font-semibold text-foreground">{m.t}</h3>
                <p className="text-[11px] text-muted-foreground mt-1">{m.d}</p>
              </div>
            ))}
          </div>

          <div className="rounded-md border border-border bg-background/30 p-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] ds-mono uppercase tracking-wider text-muted-foreground">Claim policy:</span>
              <ClaimBadge status="validated" />
              <ClaimBadge status="pilot" />
              <ClaimBadge status="marketing_hypothesis" />
              <span className="text-[10px] text-muted-foreground ml-2">
                NFPA, FAA, latency, cost-reduction, range and hardware claims require US review before use as guarantees.
              </span>
            </div>
          </div>
        </header>

        {/* Tabs */}
        <nav className="flex gap-1 border-b border-border overflow-x-auto">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs ds-mono uppercase tracking-wider border-b-2 transition-colors whitespace-nowrap ${
                  active ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {t.label}
              </button>
            );
          })}
        </nav>

        {/* Body */}
        <section className="rounded-md border border-border bg-background/20 p-3 md:p-4">
          {tab === 'assets' && <AssetLibrary onSelectionChange={setSelectedAssetIds} />}
          {tab === 'ai' && <AIChoreographyStudioStub />}
          {tab === 'docktwin' && <DockTwinPilotPanel />}
          {tab === 'approval' && <ClientApprovalPanel />}
          {tab === 'plan' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {PLAN.map((p) => (
                <div key={p.window} className="rounded-md border border-border bg-background/30 p-3">
                  <h4 className="text-xs font-semibold text-primary mb-2 ds-mono uppercase tracking-wider">{p.window}</h4>
                  <ul className="space-y-1.5">
                    {p.goals.map((g) => (
                      <li key={g} className="text-[11px] text-foreground flex gap-2">
                        <span className="text-primary mt-0.5">›</span>
                        <span>{g}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
