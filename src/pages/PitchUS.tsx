import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ClaimBadge } from '@/components/strategy/ClaimBadge';
import { SEED_ASSETS } from '@/components/strategy/AssetLibrary';
import { ArrowRight, ShieldCheck, Layers, Wand2, FileDown } from 'lucide-react';
import { renderOnePagerPDF, downloadOnePager, SEGMENTS } from '@/lib/onePagerPdf';

const CORE = [
  { title: 'End the broken stage', body: 'Replace fragmented drone, pyro, DMX, approval and reporting tools with one command surface.' },
  { title: 'Sell before deployment', body: 'SkyCanvas previs, Unreal/Pixel Streaming and AR overlays let producers sell shows before any hardware is mobilized.' },
  { title: 'Safety-first spectacle OS', body: 'Simulation, evidence, readiness, rollback and audit are sales proof — not afterthoughts.' },
];

// External marketing palette (brief): #121214 / #00FFFF / #FF7700.
// Operational chrome stays Vantablack + cyan-dessat.
const PITCH_STYLE: React.CSSProperties = {
  // expose as inline CSS vars for this page only
  ['--pitch-bg' as string]: '#121214',
  ['--pitch-fg' as string]: '#F5F5F7',
  ['--pitch-cyan' as string]: '#00FFFF',
  ['--pitch-orange' as string]: '#FF7700',
  ['--pitch-muted' as string]: '#9A9AA0',
  background: 'var(--pitch-bg)',
  color: 'var(--pitch-fg)',
};

export default function PitchUS() {
  const [building, setBuilding] = useState(false);

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

  const handleOnePager = async () => {
    setBuilding(true);
    try {
      const bytes = await renderOnePagerPDF();
      downloadOnePager(bytes);
    } finally {
      setBuilding(false);
    }
  };

  const highlights = SEED_ASSETS.filter(
    (a) => a.funnel === 'top' && a.audience.some((x) => ['enterprise', 'producer', 'investor'].includes(x)),
  );

  return (
    <main className="min-h-[100dvh]" style={PITCH_STYLE}>
      {/* Hero */}
      <section className="px-6 md:px-12 pt-16 md:pt-24 pb-12 md:pb-16 border-b" style={{ borderColor: '#1f1f23' }}>
        <div className="max-w-4xl mx-auto">
          <p className="text-[10px] ds-mono uppercase tracking-[0.3em] mb-4" style={{ color: 'var(--pitch-cyan)' }}>FXKONTROL · US</p>
          <h1 className="text-4xl md:text-6xl font-bold leading-tight">
            The Operating System for <span style={{ color: 'var(--pitch-cyan)' }}>Massive Spectacles</span>
          </h1>
          <p className="text-base md:text-lg mt-6 max-w-2xl" style={{ color: 'var(--pitch-muted)' }}>
            One command surface for drones, pyro, DMX, approvals and audit — built for producers and enterprises shipping shows at scale.
          </p>
          <div className="flex flex-wrap gap-3 mt-8">
            <Link
              to="/comercial#demo-form"
              className="inline-flex items-center gap-2 rounded-md px-5 py-3 text-sm ds-mono uppercase tracking-wider hover:opacity-90"
              style={{ background: 'var(--pitch-orange)', color: '#0a0a0c' }}
            >
              Request a demo <ArrowRight className="h-4 w-4" />
            </Link>
            <button
              type="button"
              onClick={handleOnePager}
              disabled={building}
              className="inline-flex items-center gap-2 rounded-md border px-5 py-3 text-sm ds-mono uppercase tracking-wider hover:opacity-90 disabled:opacity-60"
              style={{ borderColor: 'var(--pitch-cyan)', color: 'var(--pitch-cyan)' }}
            >
              <FileDown className="h-4 w-4" />
              {building ? 'Building…' : 'Download one-pager (PDF)'}
            </button>
            <Link
              to="/comercial"
              className="inline-flex items-center gap-2 rounded-md border px-5 py-3 text-sm ds-mono uppercase tracking-wider hover:opacity-90"
              style={{ borderColor: '#2a2a30', color: 'var(--pitch-fg)' }}
            >
              See packages
            </Link>
          </div>
        </div>
      </section>

      {/* Core messages */}
      <section className="px-6 md:px-12 py-16 border-b" style={{ borderColor: '#1f1f23' }}>
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold mb-8">Three messages, one surface</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {CORE.map((m) => (
              <div key={m.title} className="rounded-md border p-5" style={{ borderColor: '#2a2a30', background: '#17171a' }}>
                <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--pitch-cyan)' }}>{m.title}</h3>
                <p className="text-sm" style={{ color: 'var(--pitch-muted)' }}>{m.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Segments */}
      <section className="px-6 md:px-12 py-16 border-b" style={{ borderColor: '#1f1f23' }}>
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold mb-2 flex items-center gap-2">
            <Layers className="h-5 w-5" style={{ color: 'var(--pitch-orange)' }} /> Three segments. One OS.
          </h2>
          <p className="text-sm mb-8" style={{ color: 'var(--pitch-muted)' }}>
            Tailored entry points for marketing agencies, producers and enterprise LiveOps.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {SEGMENTS.map((s) => (
              <div key={s.id} className="rounded-md border p-5" style={{ borderColor: '#2a2a30', background: '#17171a' }}>
                <p className="text-[10px] ds-mono uppercase tracking-wider mb-2" style={{ color: 'var(--pitch-orange)' }}>{s.label}</p>
                <h3 className="text-base font-semibold mb-3">{s.headline}</h3>
                <ul className="space-y-1.5 text-xs" style={{ color: 'var(--pitch-muted)' }}>
                  {s.bullets.map((b) => (
                    <li key={b} className="flex gap-2"><span style={{ color: 'var(--pitch-cyan)' }}>›</span><span>{b}</span></li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Highlights */}
      <section className="px-6 md:px-12 py-16 border-b" style={{ borderColor: '#1f1f23' }}>
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold mb-2 flex items-center gap-2">
            <Wand2 className="h-5 w-5" style={{ color: 'var(--pitch-cyan)' }} /> What you'll see in the demo
          </h2>
          <p className="text-sm mb-8" style={{ color: 'var(--pitch-muted)' }}>Top-of-funnel assets curated for US enterprises, producers and investors.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {highlights.map((a) => (
              <div key={a.id} className="rounded-md border p-4" style={{ borderColor: '#2a2a30', background: '#17171a' }}>
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <h3 className="text-sm font-semibold">{a.title}</h3>
                  <ClaimBadge status={a.claimStatus} />
                </div>
                <p className="text-xs" style={{ color: 'var(--pitch-muted)' }}>{a.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AI guardrails */}
      <section className="px-6 md:px-12 py-16 border-b" style={{ borderColor: '#1f1f23' }}>
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold mb-3 flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" style={{ color: 'var(--pitch-orange)' }} /> Safety-first by design
            </h2>
            <p className="text-sm" style={{ color: 'var(--pitch-muted)' }}>
              The AI Choreography Studio generates editable scenes, drone formations and DMX looks.
              It never produces chemical recipes, manufacturing instructions or ignition sequences.
            </p>
          </div>
          <div className="rounded-md border p-5" style={{ borderColor: '#2a2a30', background: '#17171a' }}>
            <ul className="space-y-2 text-xs" style={{ color: 'var(--pitch-muted)' }}>
              <li>• E-STOP propagation budget &lt; 50 ms on the operational command path.</li>
              <li>• Black box journals every command at 100 ms granularity.</li>
              <li>• Simulation = execution = reality contract for show planning.</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 md:px-12 py-10">
        <div className="max-w-5xl mx-auto">
          <div className="rounded-md border p-4" style={{ borderColor: '#2a2a30', background: '#17171a' }}>
            <p className="text-[10px] ds-mono uppercase tracking-wider mb-2" style={{ color: 'var(--pitch-muted)' }}>Claim policy</p>
            <div className="flex flex-wrap items-center gap-2 text-xs" style={{ color: 'var(--pitch-fg)' }}>
              <ClaimBadge status="validated" /> source-backed.
              <ClaimBadge status="pilot" /> usable with disclaimer.
              <ClaimBadge status="marketing_hypothesis" /> narrative only.
            </div>
            <p className="text-[10px] mt-3" style={{ color: 'var(--pitch-muted)' }}>
              NFPA, FAA, latency, cost-reduction, range and hardware claims require US review before being used as commercial guarantees.
            </p>
          </div>
          <p className="text-center text-[10px] mt-6" style={{ color: 'var(--pitch-muted)' }}>
            © {new Date().getFullYear()} FXKONTROL · <Link to="/legal/privacy" className="hover:opacity-80">Privacy</Link> · <Link to="/legal/terms" className="hover:opacity-80">Terms</Link>
          </p>
        </div>
      </footer>
    </main>
  );
}
