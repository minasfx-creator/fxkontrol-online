import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ClaimBadge } from '@/components/strategy/ClaimBadge';
import { SEED_ASSETS } from '@/components/strategy/AssetLibrary';
import { ArrowRight, ShieldCheck, Layers, Wand2 } from 'lucide-react';

const CORE = [
  {
    title: 'End the broken stage',
    body: 'Replace fragmented drone, pyro, DMX, approval and reporting tools with one command surface.',
  },
  {
    title: 'Sell before deployment',
    body: 'SkyCanvas previs, Unreal/Pixel Streaming and AR overlays let producers sell shows before any hardware is mobilized.',
  },
  {
    title: 'Safety-first spectacle OS',
    body: 'Simulation, evidence, readiness, rollback and audit are sales proof — not afterthoughts.',
  },
];

export default function PitchUS() {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = 'FXKONTROL — The Operating System for Massive Spectacles';
    const meta = document.querySelector('meta[name="description"]');
    const prevDesc = meta?.getAttribute('content') ?? '';
    meta?.setAttribute(
      'content',
      'One command surface for drones, pyro, DMX, approvals and audit. Built for US producers and enterprises shipping massive spectacles.',
    );
    return () => {
      document.title = prevTitle;
      if (meta) meta.setAttribute('content', prevDesc);
    };
  }, []);

  const highlights = SEED_ASSETS.filter(
    (a) => a.funnel === 'top' && a.audience.some((x) => ['enterprise', 'producer', 'investor'].includes(x)),
  );

  return (
    <main className="min-h-[100dvh] bg-background text-foreground">
      {/* Hero */}
      <section className="px-6 md:px-12 pt-16 md:pt-24 pb-12 md:pb-16 border-b border-border">
        <div className="max-w-4xl mx-auto">
          <p className="text-[10px] ds-mono uppercase tracking-[0.3em] text-primary mb-4">FXKONTROL · US</p>
          <h1 className="text-4xl md:text-6xl font-bold leading-tight">
            The Operating System for <span className="text-primary">Massive Spectacles</span>
          </h1>
          <p className="text-base md:text-lg text-muted-foreground mt-6 max-w-2xl">
            One command surface for drones, pyro, DMX, approvals and audit — built for producers and enterprises shipping shows at scale.
          </p>
          <div className="flex flex-wrap gap-3 mt-8">
            <Link
              to="/comercial#demo-form"
              className="inline-flex items-center gap-2 rounded-md bg-primary text-primary-foreground px-5 py-3 text-sm ds-mono uppercase tracking-wider hover:opacity-90"
            >
              Request a demo <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/comercial"
              className="inline-flex items-center gap-2 rounded-md border border-border px-5 py-3 text-sm ds-mono uppercase tracking-wider hover:border-primary/60"
            >
              See packages
            </Link>
          </div>
        </div>
      </section>

      {/* Core messages */}
      <section className="px-6 md:px-12 py-16 border-b border-border">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold mb-8">Three messages, one surface</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {CORE.map((m) => (
              <div key={m.title} className="rounded-md border border-border bg-background/30 p-5">
                <h3 className="text-sm font-semibold text-primary mb-2">{m.title}</h3>
                <p className="text-sm text-muted-foreground">{m.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Highlights */}
      <section className="px-6 md:px-12 py-16 border-b border-border">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold mb-2 flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" /> What you'll see in the demo
          </h2>
          <p className="text-sm text-muted-foreground mb-8">
            Top-of-funnel assets curated for US enterprises, producers and investors.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {highlights.map((a) => (
              <div key={a.id} className="rounded-md border border-border bg-background/30 p-4">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <h3 className="text-sm font-semibold">{a.title}</h3>
                  <ClaimBadge status={a.claimStatus} />
                </div>
                <p className="text-xs text-muted-foreground">{a.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AI guardrails */}
      <section className="px-6 md:px-12 py-16 border-b border-border">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold mb-3 flex items-center gap-2">
              <Wand2 className="h-5 w-5 text-primary" /> AI choreography, with brakes
            </h2>
            <p className="text-sm text-muted-foreground">
              The AI Choreography Studio generates editable scenes, drone formations and DMX looks.
              It never produces chemical recipes, manufacturing instructions or ignition sequences.
            </p>
          </div>
          <div className="rounded-md border border-border bg-background/30 p-5">
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">Safety-first by design</h3>
            </div>
            <ul className="space-y-2 text-xs text-muted-foreground">
              <li>• E-STOP propagation budget &lt; 50 ms on the operational command path.</li>
              <li>• Black box journals every command at 100 ms granularity.</li>
              <li>• Simulation = execution = reality contract for show planning.</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Claim policy footer */}
      <footer className="px-6 md:px-12 py-10">
        <div className="max-w-5xl mx-auto">
          <div className="rounded-md border border-border bg-background/30 p-4">
            <p className="text-[10px] ds-mono uppercase tracking-wider text-muted-foreground mb-2">Claim policy</p>
            <div className="flex flex-wrap items-center gap-2">
              <ClaimBadge status="validated" /> source-backed.
              <ClaimBadge status="pilot" /> usable with disclaimer.
              <ClaimBadge status="marketing_hypothesis" /> narrative only.
            </div>
            <p className="text-[10px] text-muted-foreground mt-3">
              NFPA, FAA, latency, cost-reduction, range and hardware claims require US review before being used as commercial guarantees.
            </p>
          </div>
          <p className="text-center text-[10px] text-muted-foreground mt-6">
            © {new Date().getFullYear()} FXKONTROL · <Link to="/legal/privacy" className="hover:text-primary">Privacy</Link> · <Link to="/legal/terms" className="hover:text-primary">Terms</Link>
          </p>
        </div>
      </footer>
    </main>
  );
}
