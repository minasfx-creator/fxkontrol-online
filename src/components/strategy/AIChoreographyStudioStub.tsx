import { useState } from 'react';
import { ClaimBadge } from './ClaimBadge';
import { Wand2, ShieldAlert, Lock } from 'lucide-react';

interface Scene {
  id: string;
  title: string;
  beats: string[];
  formation: string;
  dmxLook: string;
}

const SAMPLE_SCENES: Scene[] = [
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

export function AIChoreographyStudioStub() {
  const [prompt, setPrompt] = useState('');
  const [scenes] = useState(SAMPLE_SCENES);

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
            disabled
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background/40 px-3 py-2 text-xs ds-mono uppercase tracking-wider text-muted-foreground cursor-not-allowed"
            title="Pilot — wired in next milestone"
          >
            <Lock className="h-3 w-3" />
            Generate
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1">Wired in milestone day 36–60. Sample output below.</p>
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
