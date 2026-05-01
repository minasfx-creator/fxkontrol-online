import { useMemo, useState } from 'react';
import { ClaimBadge } from './ClaimBadge';
import { Wand2, ShieldAlert, Lock, FileDown, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import {
  validateScene,
  exportSkybrushPackage,
  downloadBlob,
  type ChoreoScene,
} from '@/lib/skybrushExport';

interface SceneCard {
  id: string;
  title: string;
  beats: string[];
  formation: string;
  dmxLook: string;
}

const SAMPLE_SCENES: SceneCard[] = [
  {
    id: 'sc-001',
    title: 'Opening — Cyan Bloom',
    beats: ['00:00 fade-in', '00:08 swarm rise', '00:16 cyan bloom'],
    formation: 'spiral · 80 drones · 60m radius',
    dmxLook: 'wash 100% cyan @ 30fps · strobe off',
  },
  {
    id: 'sc-002',
    title: 'Climax — Amber Pulse',
    beats: ['00:00 dark hold', '00:04 amber pulse x3', '00:12 burst'],
    formation: 'sphere collapse · 120 drones',
    dmxLook: 'wash amber pulse 4Hz · beam pan ±45°',
  },
];

/** Build a deterministic spiral demo scene we can validate + export. */
function buildDemoChoreo(droneCount = 80, durationSec = 16): ChoreoScene {
  const drones = Array.from({ length: droneCount }, (_, i) => {
    const phase = (i / droneCount) * Math.PI * 2;
    const radius = 30 + (i % 8) * 3;
    const path = [0, 4, 8, 12, 16].map((t) => ({
      t,
      x: Math.cos(phase + t * 0.15) * radius,
      y: Math.sin(phase + t * 0.15) * radius,
      z: 20 + Math.sin(t * 0.4 + phase) * 15 + i * 0.05,
    }));
    return {
      id: `d${String(i + 1).padStart(3, '0')}`,
      path,
      color: [
        { t: 0, r: 0, g: 0.6, b: 1 },
        { t: 8, r: 0, g: 1, b: 0.9 },
        { t: 16, r: 1, g: 0.6, b: 0 },
      ],
    };
  });
  return { title: 'FXK Demo · Spiral Bloom', drones, duration: durationSec };
}

export function AIChoreographyStudioStub() {
  const [prompt, setPrompt] = useState('');
  const [scenes] = useState(SAMPLE_SCENES);
  const [exporting, setExporting] = useState(false);

  const demoScene = useMemo(() => buildDemoChoreo(80, 16), []);
  const report = useMemo(() => validateScene(demoScene), [demoScene]);

  const errorCount = report.issues.filter((i) => i.severity === 'error').length;
  const warnCount = report.issues.filter((i) => i.severity === 'warn').length;

  const handleExport = async () => {
    setExporting(true);
    try {
      const blob = exportSkybrushPackage(demoScene, report);
      downloadBlob(blob, `fxk-skybrush-preview-${new Date().toISOString().slice(0, 10)}.zip`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 flex items-start gap-2">
        <ShieldAlert className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
        <div className="text-[11px] text-foreground/90 space-y-1">
          <p className="font-semibold">AI Guardrails active</p>
          <p className="text-muted-foreground">
            The AI generates editable scenes, drone formations and DMX looks. It does <strong>not</strong> produce
            chemical recipes, manufacturing instructions, ignition sequences or any unsafe real-world firing steps.
          </p>
          <ClaimBadge status="validated" />
        </div>
      </div>

      <div>
        <label className="text-[10px] ds-mono uppercase tracking-wider text-muted-foreground">Prompt</label>
        <div className="flex gap-2 mt-1">
          <input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g. NYE 8 minutes, 200 drones, cinematic build to amber finale"
            className="flex-1 bg-background/40 border border-border rounded-md px-3 py-2 text-xs ds-mono focus:outline-none focus:border-primary/50"
          />
          <button
            type="button"
            disabled
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background/40 px-3 py-2 text-xs ds-mono uppercase tracking-wider text-muted-foreground cursor-not-allowed"
            title="Pilot — wired in next milestone"
          >
            <Lock className="h-3 w-3" />
            Generate
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1">Generation wires in milestone day 36–60. Sample output below.</p>
      </div>

      {/* Validation + Skybrush export — R3 honest stub */}
      <div className="rounded-md border border-border bg-background/30 p-3 space-y-3">
        <div className="flex items-center gap-2">
          <h4 className="text-xs font-semibold ds-mono uppercase tracking-wider">Demo scene · validation</h4>
          <ClaimBadge status="marketing_hypothesis" />
          <span className="ml-auto text-[10px] text-muted-foreground">
            {report.totals.drones} drones · {report.totals.waypoints} waypoints · {report.totals.durationSec}s
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <Stat
            icon={errorCount > 0 ? <XCircle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            tone={errorCount > 0 ? 'error' : 'ok'}
            label="Errors"
            value={errorCount}
          />
          <Stat
            icon={<AlertTriangle className="h-3.5 w-3.5" />}
            tone={warnCount > 0 ? 'warn' : 'ok'}
            label="Warnings"
            value={warnCount}
          />
          <Stat
            icon={<CheckCircle2 className="h-3.5 w-3.5" />}
            tone={report.ok ? 'ok' : 'error'}
            label="Status"
            value={report.ok ? 'PASS' : 'BLOCK'}
          />
        </div>

        {report.issues.length > 0 && (
          <ul className="max-h-32 overflow-auto space-y-1 text-[10px] ds-mono">
            {report.issues.slice(0, 8).map((iss, idx) => (
              <li
                key={idx}
                className={`px-2 py-1 rounded border ${
                  iss.severity === 'error'
                    ? 'border-red-500/40 bg-red-500/5 text-red-400'
                    : iss.severity === 'warn'
                      ? 'border-amber-500/40 bg-amber-500/5 text-amber-400'
                      : 'border-border bg-background/40 text-muted-foreground'
                }`}
              >
                <span className="opacity-60">[{iss.rule}]</span> {iss.message}
              </li>
            ))}
            {report.issues.length > 8 && (
              <li className="text-[10px] text-muted-foreground pl-2">+{report.issues.length - 8} more…</li>
            )}
          </ul>
        )}

        <button
          type="button"
          onClick={handleExport}
          disabled={exporting}
          className="w-full inline-flex items-center justify-center gap-2 rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-xs ds-mono uppercase tracking-wider text-primary hover:bg-primary/20 disabled:opacity-60"
        >
          <FileDown className="h-3.5 w-3.5" />
          {exporting ? 'Building package…' : 'Export Skybrush preview (.zip)'}
        </button>
        <p className="text-[10px] text-muted-foreground">
          Honest preview · contains <code className="ds-mono">_FXK_DISCLAIMER.txt</code>. Do not fly without re-export from a
          validated Skybrush session.
        </p>
      </div>

      <div className="space-y-2">
        {scenes.map((s) => (
          <div key={s.id} className="rounded-md border border-border bg-background/30 p-3">
            <div className="flex items-center gap-2 mb-2">
              <Wand2 className="h-3.5 w-3.5 text-primary" />
              <h4 className="text-xs font-semibold">{s.title}</h4>
              <span className="ds-mono text-[9px] text-muted-foreground ml-auto">{s.id}</span>
            </div>
            <dl className="grid grid-cols-1 md:grid-cols-3 gap-2 text-[11px]">
              <Field label="Beats" value={s.beats.join(' → ')} />
              <Field label="Formation" value={s.formation} />
              <Field label="DMX Look" value={s.dmxLook} />
            </dl>
          </div>
        ))}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[9px] ds-mono uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="text-foreground mt-0.5">{value}</dd>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  tone: 'ok' | 'warn' | 'error';
}) {
  const cls =
    tone === 'ok'
      ? 'border-green-500/40 bg-green-500/5 text-green-400'
      : tone === 'warn'
        ? 'border-amber-500/40 bg-amber-500/5 text-amber-400'
        : 'border-red-500/40 bg-red-500/5 text-red-400';
  return (
    <div className={`rounded-md border ${cls} p-2`}>
      <div className="flex items-center gap-1.5">
        {icon}
        <span className="text-[9px] ds-mono uppercase tracking-wider opacity-80">{label}</span>
      </div>
      <p className="ds-mono text-base font-semibold mt-0.5">{value}</p>
    </div>
  );
}
