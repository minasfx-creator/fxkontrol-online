/**
 * /ai-choreography — Upload image/video → xAI Grok generates macro choreography
 * → client-side expander interpolates per-drone trajectories → Apply to ShowPlan
 * or export CSV/JSON for Skybrush / Drone Show Software.
 *
 * Hybrid scale: LLM only emits ≤50 groups + keyframes. Local expander handles
 * 2000+ drones deterministically with collision QA.
 */
import { useMemo, useRef, useState } from 'react';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Upload, Play, Sparkles, Download, Layers, AlertTriangle, Gauge, Brain, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useProjectStore } from '@/store/useProjectStore';
import { expandMacroToTrajectories } from '@/modules/aiChoreography/expander';
import { downloadExpandedShowCSV, downloadExpandedShowJSON } from '@/modules/aiChoreography/exporter';
import { applyAIChoreographyToShowPlan } from '@/modules/aiChoreography/applyToShowPlan';
import type { MacroChoreography, ExpandedShow } from '@/modules/aiChoreography/types';
import { callGrokReasoning, isAuthFailure, type GrokReasoningResult } from '@/lib/grokResponses';

const MAX_FILE_MB = 8;

// ─── Mirror of server-side schema (supabase/functions/grok-choreography) ───
// Keep limits in sync. Field-level errors are surfaced to the operator before any network call.
const CLIENT_LIMITS = {
  promptMaxChars: 2000,
  imageDataUrlMaxBytes: 10 * 1024 * 1024,
  numDrones: { min: 10, max: 5000 },
  durationSeconds: { min: 5, max: 600 },
  fps: { min: 5, max: 30 },
} as const;

const grokRequestSchema = z
  .object({
    prompt: z
      .string()
      .trim()
      .max(CLIENT_LIMITS.promptMaxChars, `Briefing acima de ${CLIENT_LIMITS.promptMaxChars} caracteres.`)
      .optional(),
    imageDataUrl: z
      .string()
      .max(CLIENT_LIMITS.imageDataUrlMaxBytes, `Asset acima de ${(CLIENT_LIMITS.imageDataUrlMaxBytes / 1024 / 1024).toFixed(0)} MB.`)
      .regex(/^data:(image|video)\/[a-zA-Z0-9.+-]+;base64,/, 'Asset inválido (use imagem ou vídeo).')
      .optional(),
    numDrones: z
      .number()
      .int('numDrones precisa ser inteiro')
      .min(CLIENT_LIMITS.numDrones.min, `numDrones mínimo ${CLIENT_LIMITS.numDrones.min}.`)
      .max(CLIENT_LIMITS.numDrones.max, `numDrones máximo ${CLIENT_LIMITS.numDrones.max}.`),
    durationSeconds: z
      .number()
      .min(CLIENT_LIMITS.durationSeconds.min, `Duração mínima ${CLIENT_LIMITS.durationSeconds.min}s.`)
      .max(CLIENT_LIMITS.durationSeconds.max, `Duração máxima ${CLIENT_LIMITS.durationSeconds.max}s.`),
    fps: z
      .number()
      .int('fps precisa ser inteiro')
      .min(CLIENT_LIMITS.fps.min, `fps mínimo ${CLIENT_LIMITS.fps.min}.`)
      .max(CLIENT_LIMITS.fps.max, `fps máximo ${CLIENT_LIMITS.fps.max}.`),
  })
  .refine((v) => (v.prompt && v.prompt.length > 0) || !!v.imageDataUrl, {
    message: 'Suba uma imagem/vídeo ou escreva um briefing.',
    path: ['prompt'],
  });

/** Map raw upstream errors (xAI / edge function) to actionable Portuguese messages. */
function friendlyUpstream(raw: string, status?: number): string {
  const m = (raw || '').toLowerCase();
  if (status === 429 || /rate.?limit|too many requests/.test(m))
    return 'Limite de requisições atingido. Aguarde alguns segundos e tente novamente.';
  if (status === 402 || /credit|payment required|insufficient.*balance|quota/.test(m))
    return 'Créditos da AI esgotados. Recarregue em Settings → Workspace → Usage.';
  if (status === 401 || /api key|unauthorized|invalid.*key|key format invalid|xai_api_key/.test(m))
    return 'Chave XAI_API_KEY inválida ou no formato errado (precisa começar com "xai-"). Atualize o secret no backend.';
  if (status === 413 || /payload too large|request entity too large|too large|max.*size/.test(m))
    return `Asset muito grande (limite ${MAX_FILE_MB}MB). Comprima a imagem/vídeo antes de enviar.`;
  if (/model.*not.*found|does not exist|unsupported|deprecat/.test(m))
    return `Modelo Grok indisponível: ${raw}. O fallback automático também falhou — atualize a lista de modelos.`;
  if (/timeout|timed out|deadline/.test(m))
    return 'Timeout ao chamar o Grok. Tente novamente ou reduza a duração do show.';
  if (/tool call|tool arguments|not valid json|structured/.test(m))
    return 'Grok respondeu em formato inválido. Tente novamente — costuma resolver.';
  if (status && status >= 500) return `Falha upstream (${status}): ${raw}`;
  return raw;
}

async function fileToDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(r.error);
    r.onload = () => resolve(r.result as string);
    r.readAsDataURL(file);
  });
}

async function videoFirstFrame(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.src = url;
    v.muted = true;
    v.playsInline = true;
    v.onloadeddata = () => {
      try {
        v.currentTime = Math.min(0.1, (v.duration || 1) * 0.1);
      } catch (e) { reject(e); }
    };
    v.onseeked = () => {
      const c = document.createElement('canvas');
      c.width = v.videoWidth || 640;
      c.height = v.videoHeight || 360;
      const ctx = c.getContext('2d');
      if (!ctx) { URL.revokeObjectURL(url); return reject(new Error('canvas 2d')); }
      ctx.drawImage(v, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', 0.85));
    };
    v.onerror = () => { URL.revokeObjectURL(url); reject(new Error('video decode failed')); };
  });
}

export default function AIChoreographyPage() {
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('Show épico cinematográfico com formações grandes e transições suaves.');
  const [numDrones, setNumDrones] = useState(500);
  const [duration, setDuration] = useState(60);
  const [fps, setFps] = useState(10);
  const [busy, setBusy] = useState(false);
  const [macro, setMacro] = useState<MacroChoreography | null>(null);
  const [show, setShow] = useState<ExpandedShow | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const addDroneFormation = useProjectStore(s => s.addDroneFormation);
  const materializeFormation = useProjectStore(s => s.materializeFormation);
  const recalculateFormationTimings = useProjectStore(s => s.recalculateFormationTimings);

  const onFile = async (f: File | null) => {
    if (!f) return;
    if (f.size > MAX_FILE_MB * 1024 * 1024) {
      toast.error(`Arquivo > ${MAX_FILE_MB}MB. Comprima antes de subir.`);
      return;
    }
    setFile(f);
    try {
      const data = f.type.startsWith('video/') ? await videoFirstFrame(f) : await fileToDataURL(f);
      setPreview(data);
    } catch (e) {
      toast.error('Não consegui ler o arquivo.');
      setPreview(null);
    }
  };

  const generate = async () => {
    // ─── Client-side prevalidation (mirrors edge function zod schema) ───
    const candidate = {
      prompt: prompt.trim() || undefined,
      imageDataUrl: preview ?? undefined,
      numDrones,
      durationSeconds: duration,
      fps,
    };
    const parsed = grokRequestSchema.safeParse(candidate);
    if (!parsed.success) {
      const flat = parsed.error.flatten();
      const fe: Record<string, string> = {};
      for (const [k, v] of Object.entries(flat.fieldErrors)) {
        if (v?.[0]) fe[k] = v[0];
      }
      const formMsg = flat.formErrors[0];
      setFieldErrors(fe);
      const firstMsg = Object.values(fe)[0] ?? formMsg ?? 'Campos inválidos.';
      toast.error(firstMsg, {
        description: Object.keys(fe).length > 1 ? `+${Object.keys(fe).length - 1} outro(s) campo(s) com erro.` : undefined,
      });
      return;
    }
    setFieldErrors({});
    setBusy(true);
    setMacro(null); setShow(null);
    try {
      const { data, error } = await supabase.functions.invoke('grok-choreography', {
        body: {
          prompt,
          imageDataUrl: preview ?? undefined,
          numDrones,
          durationSeconds: duration,
          fps,
        },
      });

      // supabase.functions.invoke wraps non-2xx responses in FunctionsHttpError;
      // the real `{ok:false,error:"…"}` payload lives on error.context (a Response).
      if (error) {
        let upstreamMsg = error.message || 'Erro desconhecido';
        let status: number | undefined;
        const ctx = (error as any).context;
        if (ctx && typeof ctx.json === 'function') {
          try {
            status = ctx.status;
            const body = await ctx.clone().json();
            if (body?.error) upstreamMsg = String(body.error);
          } catch {
            try { upstreamMsg = await ctx.clone().text(); } catch { /* ignore */ }
          }
        }
        throw new Error(friendlyUpstream(upstreamMsg, status));
      }
      if (!data?.ok) throw new Error(friendlyUpstream(data?.error ?? 'falha no Grok'));

      const macroData = data.macro as MacroChoreography;
      setMacro(macroData);
      toast.success(`Macro gerada (${macroData.formations?.length ?? 0} keyframes). Expandindo trajetórias…`);
      const expanded = expandMacroToTrajectories(macroData, {
        totalDrones: numDrones,
        fps,
      });
      setShow(expanded);
      toast.success(`${expanded.drones.length} drones · ${expanded.drones[0]?.frames.length ?? 0} frames · pico ${expanded.maxSpeedObserved.toFixed(1)} m/s`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // Auth-flavoured failures get a self-diagnosis CTA: a single click pings
      // the lightweight `xai-key-health` endpoint and surfaces the verdict
      // (format wrong, upstream 401, network issue, etc.) so operators don't
      // have to guess whether the key, the workspace, or the network is at
      // fault.
      const looksAuth = /xai_api_key|api key|chave xai|unauthorized|401/i.test(msg);
      toast.error(msg, {
        duration: 7000,
        action: looksAuth
          ? {
              label: 'Diagnosticar chave',
              onClick: async () => {
                const t = toast.loading('Testando XAI_API_KEY…');
                try {
                  const { data, error } = await supabase.functions.invoke('xai-key-health', { method: 'GET' });
                  toast.dismiss(t);
                  if (error) {
                    toast.error(`Health-check falhou: ${error.message}`);
                    return;
                  }
                  if (data?.valid) {
                    toast.success(`Chave OK (${data.masked}). Tente gerar de novo.`);
                  } else {
                    toast.error(`${data?.masked ?? '—'} · ${data?.reason ?? 'unknown'}`, {
                      description: data?.hint ?? 'Sem dica disponível.',
                      duration: 12000,
                    });
                  }
                } catch (e) {
                  toast.dismiss(t);
                  toast.error(`Health-check falhou: ${e instanceof Error ? e.message : String(e)}`);
                }
              },
            }
          : undefined,
      });
    } finally {
      setBusy(false);
    }
  };

  const apply = () => {
    if (!macro || !show) return;
    const r = applyAIChoreographyToShowPlan(macro, show, {
      addDroneFormation, materializeFormation, recalculateFormationTimings,
    });
    toast.success(`+${r.cuesCreated} cues no ShowPlan (${r.droneCount} drones).`);
  };

  const macroPreview = useMemo(() => {
    if (!macro) return '';
    return JSON.stringify({ metadata: macro.metadata, formations: macro.formations.slice(0, 3) }, null, 2);
  }, [macro]);

  return (
    <div className="min-h-[100dvh] w-full bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b border-border/40 bg-background/80 backdrop-blur">
        <div className="flex items-center gap-3 px-4 py-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
          </Button>
          <Sparkles className="w-5 h-5 text-primary" />
          <div>
            <h1 className="text-base font-semibold leading-tight">AI Choreography</h1>
            <p className="text-xs text-muted-foreground">xAI Grok vision → macro JSON → 2000-drone trajectories</p>
          </div>
        </div>
      </header>

      <main className="grid gap-4 p-4 lg:grid-cols-[380px_minmax(0,1fr)]">
        {/* Controls */}
        <section className="rounded-xl border border-border/40 bg-card p-4 space-y-4">
          <div>
            <Label className="text-xs uppercase text-muted-foreground">Asset visual</Label>
            <div
              onClick={() => fileRef.current?.click()}
              className="mt-2 cursor-pointer rounded-lg border border-dashed border-border/60 bg-background/40 p-4 text-center hover:border-primary/60 transition"
            >
              {preview ? (
                <img src={preview} alt="preview" className="mx-auto max-h-40 rounded" />
              ) : (
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <Upload className="w-6 h-6" />
                  <span className="text-sm">Clique para subir imagem/vídeo (≤ {MAX_FILE_MB}MB)</span>
                </div>
              )}
              {file && <p className="mt-2 text-xs text-muted-foreground truncate">{file.name}</p>}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,video/*"
              className="hidden"
              onChange={(e) => onFile(e.target.files?.[0] ?? null)}
            />
          </div>

          <div>
            <Label htmlFor="brief" className="text-xs uppercase text-muted-foreground">Briefing</Label>
            <Textarea
              id="brief"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value.slice(0, 2000))}
              rows={4}
              className={`mt-1 text-sm ${fieldErrors.prompt ? 'border-destructive focus-visible:ring-destructive' : ''}`}
              placeholder="Estilo, paleta, momentos-chave, marca…"
              aria-invalid={!!fieldErrors.prompt}
              aria-describedby={fieldErrors.prompt ? 'brief-err' : undefined}
            />
            {fieldErrors.prompt && (
              <p id="brief-err" className="mt-1 text-xs text-destructive">{fieldErrors.prompt}</p>
            )}
            {fieldErrors.imageDataUrl && (
              <p className="mt-1 text-xs text-destructive">{fieldErrors.imageDataUrl}</p>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs uppercase text-muted-foreground">Drones</Label>
              <Input type="number" min={10} max={5000} step={10}
                value={numDrones}
                onChange={(e) => setNumDrones(Math.max(10, Math.min(5000, parseInt(e.target.value) || 500)))}
                aria-invalid={!!fieldErrors.numDrones}
                className={fieldErrors.numDrones ? 'border-destructive focus-visible:ring-destructive' : ''}
              />
              {fieldErrors.numDrones && <p className="mt-1 text-xs text-destructive">{fieldErrors.numDrones}</p>}
            </div>
            <div>
              <Label className="text-xs uppercase text-muted-foreground">Duração (s)</Label>
              <Input type="number" min={5} max={600}
                value={duration}
                onChange={(e) => setDuration(Math.max(5, Math.min(600, parseFloat(e.target.value) || 60)))}
                aria-invalid={!!fieldErrors.durationSeconds}
                className={fieldErrors.durationSeconds ? 'border-destructive focus-visible:ring-destructive' : ''}
              />
              {fieldErrors.durationSeconds && <p className="mt-1 text-xs text-destructive">{fieldErrors.durationSeconds}</p>}
            </div>
            <div>
              <Label className="text-xs uppercase text-muted-foreground">FPS</Label>
              <Input type="number" min={5} max={30}
                value={fps}
                onChange={(e) => setFps(Math.max(5, Math.min(30, parseInt(e.target.value) || 10)))}
                aria-invalid={!!fieldErrors.fps}
                className={fieldErrors.fps ? 'border-destructive focus-visible:ring-destructive' : ''}
              />
              {fieldErrors.fps && <p className="mt-1 text-xs text-destructive">{fieldErrors.fps}</p>}
            </div>
          </div>

          <Button onClick={generate} disabled={busy} className="w-full">
            {busy ? (
              <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> Gerando…</span>
            ) : (
              <span className="flex items-center gap-2"><Play className="w-4 h-4" /> Gerar coreografia</span>
            )}
          </Button>

          {show && (
            <div className="space-y-2 pt-2 border-t border-border/40">
              <div className="grid grid-cols-3 gap-2 text-xs">
                <Stat label="Drones" value={show.drones.length} />
                <Stat label="Frames" value={show.drones[0]?.frames.length ?? 0} />
                <Stat label="Pico m/s" value={show.maxSpeedObserved.toFixed(1)} />
              </div>
              {show.collisions.length > 0 && (
                <div className="flex items-start gap-2 rounded border border-warning/40 bg-warning/10 p-2 text-xs text-warning-foreground">
                  <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span>{show.collisions.length} possíveis colisões (&lt; 2 m). Revise antes do voo real.</span>
                </div>
              )}
              <div className="grid grid-cols-3 gap-2">
                <Button size="sm" variant="default" onClick={apply}>
                  <Layers className="w-3.5 h-3.5 mr-1" /> Aplicar
                </Button>
                <Button size="sm" variant="outline" onClick={() => downloadExpandedShowCSV(show)}>
                  <Download className="w-3.5 h-3.5 mr-1" /> CSV
                </Button>
                <Button size="sm" variant="outline" onClick={() => downloadExpandedShowJSON(show)}>
                  <Download className="w-3.5 h-3.5 mr-1" /> JSON
                </Button>
              </div>
            </div>
          )}
        </section>

        {/* Preview */}
        <section className="rounded-xl border border-border/40 bg-card p-4 min-h-[60dvh]">
          <div className="flex items-center gap-2 mb-2">
            <Gauge className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold">Macro JSON (preview)</h2>
            {macro && <span className="text-xs text-muted-foreground">{macro.metadata.title}</span>}
          </div>
          {macro ? (
            <pre className="text-xs leading-relaxed overflow-auto max-h-[70dvh] rounded bg-background/60 p-3 border border-border/40">
{macroPreview}
            </pre>
          ) : (
            <div className="h-full grid place-items-center text-muted-foreground text-sm">
              Suba um asset, descreva o briefing e clique em <b className="mx-1">Gerar coreografia</b>.
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded bg-background/60 border border-border/40 p-2 text-center">
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold">{value}</div>
    </div>
  );
}
