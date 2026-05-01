import { useMemo, useState } from 'react';
import { ClaimBadge } from './ClaimBadge';
import { Wand2, ShieldAlert, FileDown, CheckCircle2, AlertTriangle, XCircle, Sparkles, SlidersHorizontal } from 'lucide-react';
import {
  validateScene,
  exportSkybrushPackage,
  downloadBlob,
} from '@/lib/skybrushExport';
import { TEMPLATES, getTemplate, type TemplateId } from '@/lib/aiChoreographyTemplates';

type Mode = 'beginner' | 'expert';

export function AIChoreographyStudioStub() {
  const [mode, setMode] = useState<Mode>('beginner');
  const [templateId, setTemplateId] = useState<TemplateId>('stadium-opener');
  const [droneCount, setDroneCount] = useState(120);
  const [duration, setDuration] = useState(20);
  const [exporting, setExporting] = useState(false);

  const tmpl = getTemplate(templateId)!;

  // Lock parameters to template defaults in beginner mode.
  const effDrones = mode === 'beginner' ? tmpl.defaultDrones : droneCount;
  const effDuration = mode === 'beginner' ? tmpl.durationSec : duration;

  const scene = useMemo(
    () => tmpl.build(effDrones, effDuration),
    [tmpl, effDrones, effDuration],
  );
  const report = useMemo(() => validateScene(scene), [scene]);

  const errorCount = report.issues.filter((i) => i.severity === 'error').length;
  const warnCount = report.issues.filter((i) => i.severity === 'warn').length;

  const handleExport = async () => {
    setExporting(true);
    try {
      const blob = exportSkybrushPackage(scene, report);
      downloadBlob(blob, `fxk-${templateId}-${new Date().toISOString().slice(0, 10)}.zip`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Mode toggle */}
      <div className="flex items-center gap-1 rounded-md border border-border bg-background/40 p-1 w-fit">
        <ModeBtn active={mode === 'beginner'} onClick={() => setMode('beginner')} icon={<Sparkles className="h-3.5 w-3.5" />} label="Beginner" />
        <ModeBtn active={mode === 'expert'} onClick={() => setMode('expert')} icon={<SlidersHorizontal className="h-3.5 w-3.5" />} label="Expert" />
      </div>

      <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 flex items-start gap-2">
        <ShieldAlert className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
        <div className="text-[11px] text-foreground/90 space-y-1">
          <p className="font-semibold">AI Guardrails active</p>
          <p className="text-muted-foreground">
            Editable scenes, drone formations and DMX looks only. <strong>No</strong> chemical recipes,
            manufacturing instructions or ignition sequences are ever produced.
          </p>
          <ClaimBadge status="validated" />
        </div>
      </div>

      {/* Template picker (Beginner) */}
      {mode === 'beginner' && (
        <div className="space-y-2">
          <label className="text-[10px] ds-mono uppercase tracking-wider text-muted-foreground">Choose a template</label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {TEMPLATES.map((t) => {
              const active = templateId === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTemplateId(t.id)}
                  className={`text-left rounded-md border p-3 transition-colors ${
                    active ? 'border-primary/60 bg-primary/5' : 'border-border bg-background/30 hover:border-border-strong'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Wand2 className="h-3.5 w-3.5 text-primary" />
                    <h4 className="text-xs font-semibold">{t.title}</h4>
                    <span className="ml-auto text-[9px] ds-mono text-muted-foreground">{t.defaultDrones}d · {t.durationSec}s</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">{t.description}</p>
                  <p className="text-[10px] ds-mono text-cyan-400 mt-1">DMX: {t.dmxLook}</p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Expert overrides */}
      {mode === 'expert' && (
        <div className="rounded-md border border-border bg-background/30 p-3 space-y-3">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-3.5 w-3.5 text-primary" />
            <h4 className="text-xs font-semibold">Expert overrides</h4>
            <ClaimBadge status="pilot" className="ml-auto" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <Select label="Template" value={templateId} onChange={(v) => setTemplateId(v as TemplateId)} options={TEMPLATES.map(t => ({ value: t.id, label: t.title }))} />
            <NumInput label="Drones" value={droneCount} min={10} max={500} onChange={setDroneCount} />
            <NumInput label="Duration (s)" value={duration} min={4} max={300} onChange={setDuration} />
          </div>
          <p className="text-[10px] text-muted-foreground">
            Overrides are saved per-session only. Export carries all values into the validation report.
          </p>
        </div>
      )}

      {/* Validation + Export */}
      <div className="rounded-md border border-border bg-background/30 p-3 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <h4 className="text-xs font-semibold ds-mono uppercase tracking-wider">Validation</h4>
          <ClaimBadge status="marketing_hypothesis" />
          <span className="ml-auto text-[10px] text-muted-foreground">
            {report.totals.drones} drones · {report.totals.waypoints} waypoints · {report.totals.durationSec}s
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <Stat icon={errorCount > 0 ? <XCircle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />} tone={errorCount > 0 ? 'error' : 'ok'} label="Errors" value={errorCount} />
          <Stat icon={<AlertTriangle className="h-3.5 w-3.5" />} tone={warnCount > 0 ? 'warn' : 'ok'} label="Warnings" value={warnCount} />
          <Stat icon={<CheckCircle2 className="h-3.5 w-3.5" />} tone={report.ok ? 'ok' : 'error'} label="Status" value={report.ok ? 'PASS' : 'BLOCK'} />
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
          Honest preview · contains <code className="ds-mono">_FXK_DISCLAIMER.txt</code>. Do not fly without re-export from a validated Skybrush session.
        </p>
      </div>
    </div>
  );
}

function ModeBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-[11px] ds-mono uppercase tracking-wider transition-colors ${
        active ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: Array<{ value: string; label: string }> }) {
  return (
    <label className="block">
      <span className="text-[9px] ds-mono uppercase tracking-wider text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full bg-background/40 border border-border rounded-md px-2 py-1.5 text-xs ds-mono focus:outline-none focus:border-primary/50"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}

function NumInput({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="text-[9px] ds-mono uppercase tracking-wider text-muted-foreground">{label}</span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n)) onChange(Math.max(min, Math.min(max, n)));
        }}
        className="mt-1 w-full bg-background/40 border border-border rounded-md px-2 py-1.5 text-xs ds-mono focus:outline-none focus:border-primary/50"
      />
    </label>
  );
}

function Stat({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number | string; tone: 'ok' | 'warn' | 'error' }) {
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
