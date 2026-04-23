/**
 * joiLLMAdapter — Cliente isolado que chama o edge function `joi-compile`
 * e materializa o resultado como JoiShowGraphV2 deep-frozen.
 *
 * Princípios:
 *  - Nunca toca runtime, HIL, firing.
 *  - Sempre retorna um JoiShowGraphV2 válido (fallback safe-empty em falha).
 *  - Validation V2 roda APÓS a recepção, antes de qualquer downstream.
 */
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
  readonly error?: string;
}

interface RawLLMOutput {
  graph?: {
    metadata?: { title?: string; tags?: string[]; notes?: string };
    duration?: number;
    stages?: Array<{
      id?: string;
      name?: string;
      startTime?: number;
      duration?: number;
      layers?: unknown[];
    }>;
  };
  confidence?: number;
  assumptions?: string[];
  warnings?: string[];
}

const DEFAULT_CONSTRAINTS: JoiConstraints = Object.freeze({
  maxConcurrentPyro: 6,
  maxDroneSpeed: 8, // m/s
  minDistanceBetweenDrones: 2.5, // m
  safetyZones: Object.freeze([]),
});

function safeEmptyGraph(prompt: string, error: string): JoiShowGraphV2 {
  return createShowGraphV2({
    metadata: {
      id: `joi-fallback-${Date.now().toString(36)}`,
      title: `Fallback: ${prompt.slice(0, 40)}`,
      notes: error,
    },
    duration: 1,
    stages: [
      {
        id: 'stage-empty',
        name: 'empty',
        startTime: 0,
        duration: 1,
        layers: [],
      },
    ],
    constraints: DEFAULT_CONSTRAINTS,
  });
}

/** Sanitiza layers vindas do LLM, descartando entradas inválidas em vez de quebrar. */
function sanitizeLayers(raw: unknown[]): JoiStage['layers'] {
  if (!Array.isArray(raw)) return [];
  const out: JoiStage['layers'][number][] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const t = (item as { type?: string }).type;
    if (t === 'drone' || t === 'dmx' || t === 'pyro') {
      out.push(item as JoiStage['layers'][number]);
    }
  }
  return out;
}

function materializeGraph(raw: RawLLMOutput, prompt: string, constraints: JoiConstraints): JoiShowGraphV2 {
  const g = raw.graph;
  if (!g || !g.duration || !Array.isArray(g.stages) || g.stages.length === 0) {
    throw new Error('LLM returned malformed graph');
  }

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

export async function generateJoiGraph(
  prompt: string,
  options?: { constraints?: JoiConstraints },
): Promise<JoiLLMResponse> {
  const constraints = options?.constraints ?? DEFAULT_CONSTRAINTS;

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
      throw new Error(msg);
    }

    const raw = data as RawLLMOutput;
    const graph = materializeGraph(raw, prompt, constraints);
    const validation = validateShowGraphV2(graph);

    return {
      graph,
      confidence: typeof raw.confidence === 'number' ? raw.confidence : 0.5,
      assumptions: Object.freeze(Array.isArray(raw.assumptions) ? raw.assumptions : []),
      warnings: Object.freeze(Array.isArray(raw.warnings) ? raw.warnings : []),
      validation,
      fallback: false,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    const fallback = safeEmptyGraph(prompt, msg);
    return {
      graph: fallback,
      confidence: 0,
      assumptions: Object.freeze([]),
      warnings: Object.freeze([`LLM generation failed: ${msg}`]),
      validation: validateShowGraphV2(fallback),
      fallback: true,
      error: msg,
    };
  }
}
