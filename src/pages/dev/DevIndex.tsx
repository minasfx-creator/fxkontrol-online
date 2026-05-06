/**
 * /dev — DevIndex (Rodada 9)
 *
 * Single navigation hub for every dev/diagnostic surface. Replaces
 * memorising URLs with a visual catalog. Pure presentation: no
 * CommandBus, no FieldBus, no SafetyStateMachine.
 *
 * Cards are grouped by domain (Hardware · Show · Editor · Reference)
 * and tagged with a status chip when relevant (LIVE / SMOKE / READ-ONLY).
 */
import { Link } from 'react-router-dom';
import {
  Activity, Radar, Cpu, Wand2, FlaskConical, Layers, Boxes,
  CheckCircle2, Sparkles, FileCode2, Beaker, Network, Compass,
} from 'lucide-react';

type Status = 'LIVE' | 'READ-ONLY' | 'SMOKE' | 'PUBLIC';
interface Card {
  to: string;
  title: string;
  desc: string;
  Icon: typeof Activity;
  status?: Status;
}
interface Group {
  title: string;
  Icon: typeof Activity;
  cards: Card[];
}

const GROUPS: Group[] = [
  {
    title: 'Hardware',
    Icon: Cpu,
    cards: [
      { to: '/dev/real-discovery', title: 'Real Discovery', desc: 'Web Serial + USB + BLE + ArtPoll loop honesto', Icon: Radar, status: 'LIVE' },
      { to: '/dev/module-roster', title: 'Module Roster', desc: 'FireOne fleet (slat/RSSI/battery/COM)', Icon: Network, status: 'LIVE' },
      { to: '/dev/fxk16', title: 'FXK16 Hub', desc: 'Validate harness + Calibrate latency', Icon: Activity, status: 'LIVE' },
      { to: '/diagnostics/dmx-pyro', title: 'DMX/Pyro Diagnostics', desc: 'Broadcast budget + timing', Icon: Beaker, status: 'PUBLIC' },
    ],
  },
  {
    title: 'Show & Verification',
    Icon: Sparkles,
    cards: [
      { to: '/dev/readiness-audit', title: 'Readiness Audit', desc: 'Fase 0 — engines + 9 provenances', Icon: CheckCircle2, status: 'READ-ONLY' },
      { to: '/dev/golden-shows', title: 'Golden Shows', desc: 'Catalog matrix + Phase 1/2 gates + export ZIP', Icon: Layers, status: 'READ-ONLY' },
      { to: '/dev/e2e-test', title: 'E2E Test', desc: 'Cenários de ponta-a-ponta automatizados', Icon: FlaskConical },
    ],
  },
  {
    title: 'Editor & Render',
    Icon: Wand2,
    cards: [
      { to: '/dev/skycanvas-lab', title: 'SkyCanvas Lab', desc: 'Smoke / R3F / V2 (variantes unificadas)', Icon: Sparkles, status: 'SMOKE' },
      { to: '/dev/ue5-bridge', title: 'UE5 Bridge', desc: 'MVR · Niagara · MRP catálogo', Icon: Boxes, status: 'READ-ONLY' },
      { to: '/dev/video-editor', title: 'Video Editor', desc: 'Surface ref. (sidebars + viewport + timeline)', Icon: Wand2 },
      { to: '/dev/editor-shell', title: 'Editor Shell', desc: 'Demo do shell com componentes DS', Icon: FileCode2 },
    ],
  },
  {
    title: 'Reference',
    Icon: Compass,
    cards: [
      { to: '/dev/design-system', title: 'Design System', desc: 'Tokens, typography, segments, status, states', Icon: FileCode2, status: 'PUBLIC' },
    ],
  },
];

const STATUS_CLASS: Record<Status, string> = {
  LIVE: 'ds-status-ok',
  'READ-ONLY': 'ds-status-sync',
  SMOKE: 'ds-status-warn',
  PUBLIC: 'ds-status-sync',
};

export default function DevIndex() {
  return (
    <div className="min-h-[100dvh] bg-[hsl(var(--field-bg))] text-[hsl(var(--field-fg))] p-ds-6 md:p-ds-8">
      <header className="max-w-6xl mx-auto mb-ds-6">
        <h1 className="text-ds-h2 ds-mono uppercase tracking-wider">Dev Hub</h1>
        <p className="text-ds-label opacity-70 mt-ds-2">
          Índice canônico de superfícies de diagnóstico, validação e referência.
          Nenhum comando físico parte daqui — apenas leitura, harness e prova.
        </p>
      </header>

      <main className="max-w-6xl mx-auto space-y-ds-8">
        {GROUPS.map(({ title, Icon, cards }) => (
          <section key={title} aria-labelledby={`grp-${title}`}>
            <div className="flex items-center gap-ds-2 mb-ds-3">
              <Icon className="w-4 h-4 opacity-70" aria-hidden />
              <h2 id={`grp-${title}`} className="text-ds-label uppercase tracking-wider opacity-80">{title}</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-ds-3">
              {cards.map((c) => (
                <Link
                  key={c.to}
                  to={c.to}
                  className="ds-interactive ds-focus rounded-ds-md border border-[hsl(var(--field-surface))] bg-[hsl(var(--field-surface))]/40 hover:bg-[hsl(var(--field-surface))]/70 p-ds-4 transition-colors block"
                >
                  <div className="flex items-start justify-between gap-ds-2">
                    <div className="flex items-center gap-ds-2 min-w-0">
                      <c.Icon className="w-4 h-4 shrink-0 text-[hsl(var(--field-cyan))]" aria-hidden />
                      <h3 className="text-ds-body font-medium truncate">{c.title}</h3>
                    </div>
                    {c.status && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ds-mono ${STATUS_CLASS[c.status]}`}>
                        {c.status}
                      </span>
                    )}
                  </div>
                  <p className="text-ds-caption opacity-70 mt-ds-2 line-clamp-2">{c.desc}</p>
                  <p className="text-ds-caption opacity-40 ds-mono mt-ds-1">{c.to}</p>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </main>
    </div>
  );
}
