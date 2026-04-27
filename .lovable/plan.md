# Plan — Grok 4.20 Reasoning via /v1/responses

Add a dedicated reasoning surface using xAI's **Responses API** and the new **`grok-4.20-reasoning`** model, without disturbing the green choreography pipeline.

## 1. New edge function: `supabase/functions/grok-responses/index.ts`

A focused, well-instrumented wrapper around `POST https://api.x.ai/v1/responses`.

**Contract (POST JSON body):**
```ts
{
  input: string,                           // required, 1..8000 chars (Zod-validated)
  system?: string,                         // optional system steer
  model?: string,                          // default "grok-4.20-reasoning"
  reasoning?: { effort?: "low" | "medium" | "high" },  // default "medium"
  maxOutputTokens?: number,                // default 4000, capped at 16k
  temperature?: number,                    // default 0.4
}
```

**Response:**
```ts
{
  ok: true,
  text: string,                            // flattened response.output_text
  reasoning?: string,                      // surfaced thinking (when present)
  model: string,                           // echo of model actually used
  usage: { input_tokens, output_tokens, reasoning_tokens? },
  requestId: string,                       // for log correlation
}
```

**Failure modes (mirroring `grok-choreography` patterns):**
- Reuse the same key-format guard (`/^xai-[A-Za-z0-9_-]{20,}$/`) → 401 with the friendly "rotate the secret" copy.
- Map upstream 401/403 → `auth`, 429 → `rate_limit`, 402 → `credits`, 404 (model) → `model_not_found`, others → `upstream_error`.
- 5 s connect timeout, 60 s overall (reasoning models are slower than chat).
- Structured logging (stage / outcome / status / model / duration_ms) so it shows up in the existing `edge_function_logs` analytics surface.

**Why a separate function (not extending `grok-choreography`):**
- Different endpoint shape (`/v1/responses` payload differs from `chat/completions`).
- No tool-call schema → simpler surface, smaller blast radius.
- Lets `grok-choreography` keep its tested fallback chain unchanged.

**No `config.toml` change needed** — defaults (verify_jwt = false managed by Lovable Cloud) are correct.

## 2. Client adapter: `src/lib/grokResponses.ts`

Tiny typed wrapper:
```ts
export interface GrokReasoningRequest { ... }
export interface GrokReasoningResult { text: string; reasoning?: string; usage: ...; model: string }
export async function callGrokReasoning(req): Promise<GrokReasoningResult>
```
- Uses `supabase.functions.invoke('grok-responses', { body })`.
- Maps known error reasons → user-facing toast strings (re-uses the same auth-error detection logic from `AIChoreography.tsx` so the existing "Diagnosticar chave" CTA still appears).

Includes a Vitest unit covering: success unwrap, auth-error mapping, network error → friendly fallback. Matches the project's "always wrap unknown errors" convention.

## 3. Surface A — AI Choreography refinement

In `src/pages/AIChoreography.tsx` (the page the user is currently on):

- Add a **"Refine with reasoning"** secondary button next to the existing generate CTA, enabled only after a macro choreography has been produced.
- Click → sends the current macro plan + the original prompt to `grok-responses` with a curated system prompt: *"You are a critique-and-improve assistant. Identify weaknesses (timing collisions, monotony, safety distance issues) and propose concrete edits. Return concise bullet-point recommendations."*
- The reasoning output is rendered in a new collapsible **"Reasoning Notes"** panel under the macro preview (not auto-applied — operators still own the choreography).
- Shows token usage + reasoning_tokens in a small footer for transparency.
- Disabled while busy; toast shows the same diagnostic CTA on auth failure.

**Why critique-only (not auto-apply):** consistent with `mem://restricoes/seguranca-latencia-e-auditoria-v5-crificos` (operator must own destructive changes), and matches the JOI Honesty Layer (`mem://arquitetura/camada-verdade-integracao-provenance-honesty`).

## 4. Surface B — JOI assistant chat (FXKAssistant)

In `src/components/FXKAssistant.tsx`:

- Add a **"Reasoning"** toggle (segmented control next to the input: `Standard` / `Reasoning`) defaulting to `Standard` so the existing fast streaming path (`fxk-ai-chat` → Lovable AI Gateway) is unchanged.
- When `Reasoning` is selected:
  - Route the request to `grok-responses` instead of streaming from `fxk-ai-chat`.
  - Non-streaming for now (Responses API streaming format is different — keep scope small). UI shows a "Thinking…" indicator with the orb pulse.
  - When response arrives, render `text` as the assistant message AND, if `reasoning` is present, append a `<details>` block titled "Cadeia de raciocínio" so power users can audit.
- Tooltip on the toggle: *"Slower (15-30s) but stronger at multi-step planning, validation explanations, and safety reasoning. Costs more tokens."*

Persist the toggle in `localStorage` (`fxk:joi:reasoning-mode`) so user preference sticks.

## 5. Tests & verification

- **Unit:** `src/lib/__tests__/grokResponses.test.ts` (3-4 cases).
- **Edge function smoke test via curl_edge_functions** after deploy: send a tiny prompt, assert `ok: true` and that `model` echoes `grok-4.20-reasoning`. If xAI rejects the model name (preview availability), the function will return `model_not_found` and we'll fall back to `grok-4` automatically (added as a single-step fallback, mirroring choreography's pattern).
- **Regression:** full vitest run (currently 656/656) + tsc.
- **Lint:** target zero new warnings (continue the cleanup trajectory).

## 6. Out of scope (explicit)

- **No** changes to `grok-choreography` — its fallback chain stays `grok-4` → `grok-4-fast` → `grok-2-vision-latest`.
- **No** streaming on the Responses API path (deferred — let's confirm the model is healthy and useful first).
- **No** auto-apply of reasoning suggestions to the macro choreography (operator-controlled).
- **No** new secrets — reuses existing `XAI_API_KEY`.

## Files created / edited

**Created**
- `supabase/functions/grok-responses/index.ts`
- `src/lib/grokResponses.ts`
- `src/lib/__tests__/grokResponses.test.ts`

**Edited**
- `src/pages/AIChoreography.tsx` — adds "Refine with reasoning" button + Reasoning Notes panel
- `src/components/FXKAssistant.tsx` — adds Standard/Reasoning toggle + non-streaming reasoning path

## Acceptance checks (post-deploy)

1. `curl_edge_functions` to `/grok-responses` with `{"input":"ping"}` returns `ok:true` and a non-empty `text`.
2. AI Choreography page: generate a plan → click "Refine with reasoning" → critique appears within ~30s.
3. JOI assistant: toggle to Reasoning → ask "Why does this safety distance matter?" → reasoning chain renders in the collapsible.
4. Auth-failure path still surfaces the existing "Diagnosticar chave" toast CTA.
5. 656+ tests green; tsc clean.
