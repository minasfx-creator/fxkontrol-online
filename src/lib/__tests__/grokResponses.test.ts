import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock supabase BEFORE importing the module under test.
const invokeMock = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { functions: { invoke: (...args: unknown[]) => invokeMock(...args) } },
}));

import { callGrokReasoning, GrokReasoningError, isAuthFailure } from '@/lib/grokResponses';

describe('callGrokReasoning', () => {
  beforeEach(() => invokeMock.mockReset());

  it('unwraps a successful response', async () => {
    invokeMock.mockResolvedValueOnce({
      data: {
        ok: true,
        text: 'hello',
        reasoning: 'thinking…',
        model: 'grok-4.20-reasoning',
        usage: { input_tokens: 10, output_tokens: 5, reasoning_tokens: 3 },
        requestId: 'req_123',
        durationMs: 1234,
      },
      error: null,
    });

    const r = await callGrokReasoning({ input: 'ping' });
    expect(r.text).toBe('hello');
    expect(r.reasoning).toBe('thinking…');
    expect(r.model).toBe('grok-4.20-reasoning');
    expect(r.usage.reasoning_tokens).toBe(3);
    expect(r.requestId).toBe('req_123');
    expect(invokeMock).toHaveBeenCalledWith('grok-responses', { body: { input: 'ping' } });
  });

  it('rejects empty input client-side without calling the function', async () => {
    await expect(callGrokReasoning({ input: '   ' })).rejects.toBeInstanceOf(GrokReasoningError);
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it('maps auth errors with reason from edge function body', async () => {
    invokeMock.mockResolvedValueOnce({
      data: null,
      error: {
        message: 'fallback',
        context: {
          status: 401,
          clone: () => ({
            json: async () => ({
              error: 'Invalid XAI_API_KEY format',
              reason: 'key_format_invalid',
              hint: 'Update the secret.',
            }),
          }),
        },
      },
    });

    let caught: unknown;
    try { await callGrokReasoning({ input: 'x' }); } catch (e) { caught = e; }
    expect(caught).toBeInstanceOf(GrokReasoningError);
    const err = caught as GrokReasoningError;
    expect(err.reason).toBe('key_format_invalid');
    expect(err.status).toBe(401);
    expect(err.hint).toBe('Update the secret.');
    expect(isAuthFailure(err)).toBe(true);
  });

  it('wraps thrown network failures as network_error', async () => {
    invokeMock.mockRejectedValueOnce(new Error('fetch failed'));
    let caught: unknown;
    try { await callGrokReasoning({ input: 'x' }); } catch (e) { caught = e; }
    expect(caught).toBeInstanceOf(GrokReasoningError);
    expect((caught as GrokReasoningError).reason).toBe('network_error');
    expect(isAuthFailure(caught)).toBe(false);
  });

  it('rejects when edge function returns ok:false in payload', async () => {
    invokeMock.mockResolvedValueOnce({
      data: { ok: false, error: 'rate limited', reason: 'rate_limit' },
      error: null,
    });
    let caught: unknown;
    try { await callGrokReasoning({ input: 'x' }); } catch (e) { caught = e; }
    expect(caught).toBeInstanceOf(GrokReasoningError);
    expect((caught as GrokReasoningError).reason).toBe('rate_limit');
  });
});
