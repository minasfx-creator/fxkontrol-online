/**
 * joiLLMAdapter — Cliente isolado que chama o edge function `joi-compile`
 * e materializa o resultado como JoiShowGraphV2 deep-frozen.
 *
 * Pipeline (defesa em profundidade):
 *   raw → Zod RAW validation → materialize → V2 structural validation
 *
 * Garantias:
 *  - Nunca toca runtime, HIL, firing.
 *  - Sempre retorna um JoiShowGraphV2 válido (fallback safe-empty em falha).
 *  - `fallbackReason` rastreável para auditoria de geração ruim.
 */
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import {
  createShowGraphV2,
  validateShowGraphV2,
  type JoiShowGraphV2,
  type JoiStage,
  type JoiValidationResult,
  type JoiConstraints,
} from './showGraphV2';

export interface JoiLLMResponse {
  readonly graph: JoiShowGraphV2;
  readonly confidence: number;
  readonly assumptions: readonly string[];
  readonly warnings: readonly string[];
  readonly validation: JoiValidationResult;
  readonly fallback: boolean;
  /** Motivo estruturado quando fallback=true. Para auditoria. */
  readonly fallbackReason?: string;
  readonly error?: string;
}

// ─── Zod RAW schema (defesa upstream antes de materializar) ─────────
const LayerRawSchema = z
  .object({ type: z.enum(['drone', 'dmx', 'pyro']) })
  .passthrough();

const StageRawSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  startTime: z.number().min(0).optional(),
  duration: z.number().min(0.1).optional(),
  layers: z.array(z.unknown()).optional(),
});

const RawLLMSchema = z.object({
  graph: z.object({
    metadata: z
      .object({
        title: z.string().optional(),
        tags: z.array(z.string()).optional(),
        notes: z.string().optional(),
      })
      .optional(),
    duration: z.number().min(0.1),
    stages: z.array(StageRawSchema).min(1),
  }),
  confidence: z.number().min(0).max(1).optional(),
  assumptions: z.array(z.string()).optional(),
  warnings: z.array(z.string()).optional(),
});

type RawLLMOutput = z.infer<typeof RawLLMSchema>;

const DEFAULT_CONSTRAINTS: JoiConstraints = Object.freeze({
  maxConcurrentPyro: 6,
  maxDroneSpeed: 8, // m/s
  minDistanceBetweenDrones: 2.5, // m
  safetyZones: Object.freeze([]),
});

function safeEmptyGraph(prompt: string, reason: string): JoiShowGraphV2 {
  return createShowGraphV2({
    metadata: {
      id: `joi-fallback-${Date.now().toString(36)}`,
      title: `Fallback: ${prompt.slice(0, 40)}`,
      notes: reason,
    },
    duration: 1,
    stages: [
      { id: 'stage-empty', name: 'empty', startTime: 0, duration: 1, layers: [] },
    ],
    constraints: DEFAULT_CONSTRAINTS,
  });
}

function sanitizeLayers(raw: unknown[]): JoiStage['layers'] {
  if (!Array.isArray(raw)) return [];
  const out: JoiStage['layers'][number][] = [];
  for (const item of raw) {
    const parsed = LayerRawSchema.safeParse(item);
    if (parsed.success) out.push(parsed.data as unknown as JoiStage['layers'][number]);
  }
  return out;
}

function materializeGraph(raw: RawLLMOutput, prompt: string, constraints: JoiConstraints): JoiShowGraphV2 {
  const g = raw.graph;
  const stages: JoiStage[] = g.stages.map((s, i) => ({
    id: s.id ?? `stage-${i}`,
    name: s.name ?? `Stage ${i + 1}`,
    startTime: typeof s.startTime === 'number' ? s.startTime : 0,
    duration: typeof s.duration === 'number' ? s.duration : 1,
    layers: sanitizeLayers(s.layers ?? []),
  }));

  return createShowGraphV2({
    metadata: {
      id: `joi-${Date.now().toString(36)}`,
      title: g.metadata?.title ?? prompt.slice(0, 60) ?? 'Untitled',
      tags: g.metadata?.tags,
      notes: g.metadata?.notes,
    },
    duration: g.duration,
    stages,
    constraints,
  });
}

function makeFallbackResponse(prompt: string, reason: string, error?: string): JoiLLMResponse {
  const fallback = safeEmptyGraph(prompt, reason);
  return {
    graph: fallback,
    confidence: 0,
    assumptions: Object.freeze([]),
    warnings: Object.freeze([`LLM generation failed: ${reason}`]),
    validation: validateShowGraphV2(fallback),
    fallback: true,
    fallbackReason: reason,
    error,
  };
}

export async function generateJoiGraph(
  prompt: string,
  options?: { constraints?: JoiConstraints; isPaid?: boolean },
): Promise<JoiLLMResponse> {
  const constraints = options?.constraints ?? DEFAULT_CONSTRAINTS;

  // Free-tier daily quota gate. Paid users (`isPaid: true` from useEntitlements.joiUnlimited)
  // bypass entirely. On overflow we surface the global UpgradeDialog and short-circuit
  // with a safe fallback graph (no LLM call, no cost).
  if (!options?.isPaid) {
    const { consumeJoiQuota } = await import('@/lib/joiQuota');
    const { promptUpgrade } = await import('@/lib/upgradePrompt');
    if (!consumeJoiQuota()) {
      promptUpgrade({ reason: 'joi-quota' });
      return makeFallbackResponse(prompt, 'free_tier_quota_exceeded', 'Daily JOI generation limit reached');
    }
  }

  let rawResponse: unknown;
  try {
    const { data, error } = await supabase.functions.invoke('joi-compile', {
      body: {
        prompt,
        constraints: {
          maxConcurrentPyro: constraints.maxConcurrentPyro,
          maxDroneSpeed: constraints.maxDroneSpeed,
          minDistanceBetweenDrones: constraints.minDistanceBetweenDrones,
        },
      },
    });

    if (error || !data || (data as { error?: string }).error) {
      const msg = (data as { error?: string })?.error ?? error?.message ?? 'Unknown LLM error';
      return makeFallbackResponse(prompt, `gateway_error: ${msg}`, msg);
    }
    rawResponse = data;
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return makeFallbackResponse(prompt, `network_error: ${msg}`, msg);
  }

  // ─── RAW validation upstream (Zod) ───
  const rawParsed = RawLLMSchema.safeParse(rawResponse);
  if (!rawParsed.success) {
    const issues = rawParsed.error.issues.slice(0, 3).map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    return makeFallbackResponse(prompt, `raw_schema_invalid: ${issues}`);
  }

  const raw = rawParsed.data;
  let graph: JoiShowGraphV2;
  try {
    graph = materializeGraph(raw, prompt, constraints);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'materialize failed';
    return makeFallbackResponse(prompt, `materialize_error: ${msg}`, msg);
  }

  const validation = validateShowGraphV2(graph);
  return {
    graph,
    confidence: typeof raw.confidence === 'number' ? raw.confidence : 0.5,
    assumptions: Object.freeze(raw.assumptions ?? []),
    warnings: Object.freeze(raw.warnings ?? []),
    validation,
    fallback: false,
  };
}
