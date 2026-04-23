/**
 * JoiPanel — UI isolada para visualizar ShowGraph e timeline compilada.
 *
 * NUNCA executa nada. NUNCA toca runtime. Apenas:
 *   prompt → ShowGraph (mock) → compile → safety → preview JSON.
 *
 * Sprint 1 entrega: prompt → graph → preview + badges (deterministic / safe / hash).
 */
import { useMemo, useState } from 'react';
import { Sparkles, Shield, Hash, CheckCircle2, XCircle, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  createShowGraph,
  validateShowGraphStructure,
  compileShowGraph,
  verifyCompileDeterminism,
  runAISafetyChecks,
  type ShowGraph,
  type ShowGraphNode,
} from '@/ai';
import { cn } from '@/lib/utils';

/** Mock generator — placeholder até Joi LLM real ser plugado (Fase posterior). */
function mockGenerateShowGraph(prompt: string): ShowGraph {
  const seed = prompt.length;
  const nodes: ShowGraphNode[] = [];
  const count = Math.max(3, Math.min(12, seed % 10 + 3));
  for (let i = 0; i < count; i++) {
    nodes.push({
      id: `n-${i.toString().padStart(3, '0')}`,
      type: i % 3 === 0 ? 'pyro' : i % 3 === 1 ? 'drone' : 'dmx',
      startTime: i * 1.5,
      duration: 0.8,
      positionId: `POS-${(i + 1).toString().padStart(3, '0')}`,
      effectId: `fx-${i % 4}`,
      params: { intensity: 0.6 + (i % 5) * 0.08 },
    });
  }
  return createShowGraph({
    metadata: {
      id: `graph-${Date.now().toString(36)}`,
      title: prompt.slice(0, 60) || 'Untitled show',
      source: 'joi',
      prompt,
    },
    nodes,
    duration: count * 1.5 + 1,
  });
}

export default function JoiPanel() {
  const [prompt, setPrompt] = useState('Crisscross drone formation with gold pyro accents over 30 seconds');
  const [graph, setGraph] = useState<ShowGraph | null>(null);

  const analysis = useMemo(() => {
    if (!graph) return null;
    const structure = validateShowGraphStructure(graph);
    const compile = compileShowGraph(graph);
    const deterministic = verifyCompileDeterminism(graph);
    const safety = compile.timeline ? runAISafetyChecks(compile.timeline) : null;
    return { structure, compile, deterministic, safety };
  }, [graph]);

  const handleGenerate = () => {
    setGraph(mockGenerateShowGraph(prompt.trim()));
  };

  const handleExport = () => {
    if (!graph || !analysis?.compile.timeline) return;
    const payload = {
      graph,
      timeline: analysis.compile.timeline,
      safety: analysis.safety,
      deterministic: analysis.deterministic,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${graph.metadata.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full max-w-3xl mx-auto p-4 space-y-4">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary/25 to-accent/15 flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-primary" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-foreground uppercase tracking-wider font-display">Joi · Show Designer</h2>
          <p className="text-[10px] text-muted-foreground">AI layer — isolated, never executes</p>
        </div>
      </div>

      <div className="rounded-2xl border border-border/30 bg-card p-3 space-y-2">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={3}
          placeholder="Describe the show…"
          className="w-full rounded-xl bg-surface-0 border border-border/20 p-3 text-xs text-foreground outline-none focus:border-primary/40 resize-none"
        />
        <div className="flex gap-2">
          <Button onClick={handleGenerate} size="sm" className="flex-1">
            <Sparkles className="w-3.5 h-3.5" /> Generate ShowGraph
          </Button>
          <Button onClick={handleExport} size="sm" variant="outline" disabled={!graph}>
            <Download className="w-3.5 h-3.5" /> Export JSON
          </Button>
        </div>
      </div>

      {graph && analysis && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <Badge
              icon={<CheckCircle2 className="w-3 h-3" />}
              label="Structure"
              ok={analysis.structure.valid}
              detail={analysis.structure.valid ? 'valid' : `${analysis.structure.errors.length} err`}
            />
            <Badge
              icon={<Shield className="w-3 h-3" />}
              label="Safety"
              ok={!!analysis.safety?.passed}
              detail={analysis.safety?.passed ? 'passed' : `${analysis.safety?.violations.length ?? 0} viol`}
            />
            <Badge
              icon={<Hash className="w-3 h-3" />}
              label="Deterministic"
              ok={analysis.deterministic}
              detail={analysis.compile.timeline?.hash ?? '—'}
            />
          </div>

          <div className="rounded-2xl border border-border/30 bg-card p-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Compiled timeline · {analysis.compile.timeline?.events.length ?? 0} events · {graph.duration.toFixed(1)}s
              </h3>
              <span className="text-[9px] font-mono text-muted-foreground/60">{graph.metadata.id}</span>
            </div>
            <pre className="text-[10px] font-mono text-foreground/80 max-h-72 overflow-auto bg-surface-0 rounded-xl p-2 border border-border/10">
              {JSON.stringify(analysis.compile.timeline, null, 2)}
            </pre>
          </div>

          <p className="text-[9px] text-muted-foreground/70 text-center">
            Read-only preview · No HIL · No firing · No runtime mutation
          </p>
        </div>
      )}
    </div>
  );
}

function Badge({
  icon,
  label,
  ok,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  ok: boolean;
  detail: string;
}) {
  return (
    <div
      className={cn(
        'rounded-xl border p-2 flex items-center gap-2',
        ok ? 'border-success/30 bg-success/10' : 'border-destructive/30 bg-destructive/10',
      )}
    >
      <span className={ok ? 'text-success' : 'text-destructive'}>{ok ? icon : <XCircle className="w-3 h-3" />}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</p>
        <p className={cn('text-[10px] font-mono truncate', ok ? 'text-success' : 'text-destructive')}>{detail}</p>
      </div>
    </div>
  );
}
