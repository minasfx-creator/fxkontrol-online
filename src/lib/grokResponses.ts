/**
 * grokResponses — typed client adapter for the `grok-responses` edge function.
 *
 * Wraps `supabase.functions.invoke('grok-responses', …)`, normalizes the
 * various error shapes (network error, FunctionsHttpError with JSON body,
 * structured `{ ok:false, error }` payloads) into a single `GrokReasoningError`
 * that carries the user-facing reason — so consumers (AIChoreography,
 * FXKAssistant) can decide whether to show the "Diagnosticar chave" CTA.
 */
import { supabase } from '@/integrations/supabase/client';

export interface GrokReasoningRequest {
  /** User prompt / question. 1..8000 chars. */
  input: string;
  /** Optional system steer. */
  system?: string;
  /** Override default model (`grok-4.20-reasoning`). */
  model?: string;
  /** Reasoning effort knob — higher = slower but deeper. */
  reasoning?: { effort?: 'low' | 'medium' | 'high' };
  /** Hard cap on output tokens (default 4000, max 16000). */
  maxOutputTokens?: number;
  /** Sampling temperature (default 0.4). */
  temperature?: number;
}

export interface GrokReasoningUsage {
  input_tokens?: number;
  output_tokens?: number;
  reasoning_tokens?: number;
}

export interface GrokReasoningResult {
  text: string;
  reasoning?: string;
  model: string;
  usage: GrokReasoningUsage;
  requestId: string | null;
  durationMs: number;
}

/** Stable, machine-checkable failure reasons — drives toast CTA selection. */
export type GrokReasoningErrorReason =
  | 'key_missing'
  | 'key_format_invalid'
  | 'auth'
  | 'rate_limit'
  | 'credits'
  | 'model_not_found'
  | 'validation'
  | 'invalid_json'
  | 'timeout'
  | 'network_error'
  | 'parse_error'
  | 'empty_response'
  | 'upstream_error'
  | 'unknown';

export class GrokReasoningError extends Error {
  readonly reason: GrokReasoningErrorReason;
  readonly status?: number;
  readonly hint?: string;
  constructor(message: string, reason: GrokReasoningErrorReason, opts?: { status?: number; hint?: string }) {
    super(message);
    this.name = 'GrokReasoningError';
    this.reason = reason;
    this.status = opts?.status;
    this.hint = opts?.hint;
  }
}

/** True when the failure is auth-flavoured (drives "Diagnosticar chave" CTA). */
export function isAuthFailure(err: unknown): boolean {
  if (err instanceof GrokReasoningError) {
    return err.reason === 'auth' || err.reason === 'key_missing' || err.reason === 'key_format_invalid';
  }
  if (err instanceof Error) {
    return /xai_api_key|api key|chave xai|unauthorized|401/i.test(err.message);
  }
  return false;
}

interface InvokeErrorContext {
  status?: number;
  json?: () => Promise<unknown>;
  clone?: () => Response;
}

async function readErrorBody(error: { message?: string; context?: InvokeErrorContext } | null): Promise<{
  message: string;
  status?: number;
  reason?: string;
  hint?: string;
}> {
  if (!error) return { message: 'Unknown error' };
  let message = error.message ?? 'Unknown error';
  let status: number | undefined;
  let reason: string | undefined;
  let hint: string | undefined;

  const ctx = error.context;
  if (ctx) {
    status = ctx.status;
    try {
      const cloned = typeof ctx.clone === 'function' ? ctx.clone() : undefined;
      const body = cloned ? await cloned.json() : undefined;
      if (body && typeof body === 'object') {
        const b = body as Record<string, unknown>;
        if (typeof b.error === 'string') message = b.error;
        if (typeof b.reason === 'string') reason = b.reason;
        if (typeof b.hint === 'string') hint = b.hint;
      }
    } catch {
      // body wasn't JSON or already consumed — keep current message
    }
  }
  return { message, status, reason, hint };
}

export async function callGrokReasoning(req: GrokReasoningRequest): Promise<GrokReasoningResult> {
  if (!req.input || req.input.trim().length === 0) {
    throw new GrokReasoningError('input is required', 'validation');
  }

  let invokeResult: Awaited<ReturnType<typeof supabase.functions.invoke>>;
  try {
    invokeResult = await supabase.functions.invoke('grok-responses', { body: req });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new GrokReasoningError(`Network error: ${msg}`, 'network_error');
  }

  const { data, error } = invokeResult as { data: unknown; error: { message?: string; context?: InvokeErrorContext } | null };

  if (error) {
    const parsed = await readErrorBody(error);
    const reason = (parsed.reason as GrokReasoningErrorReason | undefined) ?? 'upstream_error';
    throw new GrokReasoningError(parsed.message, reason, { status: parsed.status, hint: parsed.hint });
  }

  if (!data || typeof data !== 'object') {
    throw new GrokReasoningError('Empty response from grok-responses', 'empty_response');
  }
  const d = data as Record<string, unknown>;
  if (d.ok !== true || typeof d.text !== 'string') {
    const msg = typeof d.error === 'string' ? d.error : 'grok-responses returned ok:false';
    const reason = (typeof d.reason === 'string' ? d.reason : 'unknown') as GrokReasoningErrorReason;
    throw new GrokReasoningError(msg, reason);
  }

  return {
    text: d.text,
    reasoning: typeof d.reasoning === 'string' ? d.reasoning : undefined,
    model: typeof d.model === 'string' ? d.model : 'grok-4.20-reasoning',
    usage: (d.usage && typeof d.usage === 'object' ? (d.usage as GrokReasoningUsage) : {}),
    requestId: typeof d.requestId === 'string' ? d.requestId : null,
    durationMs: typeof d.durationMs === 'number' ? d.durationMs : 0,
  };
}
