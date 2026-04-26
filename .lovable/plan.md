# Round 7 — Targeted Fix + Canvas-Free E2E Walkthrough

## Health baseline (carried from Round 6)
- Tests: 604/604 ✅
- Typecheck: clean ✅
- Lint: 758 (all in 3 documented out-of-scope buckets)
- Last fix shipped: silent black-viewport guard in `SkyCanvas.tsx`

## 1. 🐛 Real production bug — `grok-choreography` returns 502

Edge function logs show every request failing:
```
xAI error [model=grok-4] 400 "Incorrect API key provided: cu***"
upstream:all_models_failed → 502
```

The AI Choreo (Grok path) is **broken in production** because the `XAI_API_KEY` secret is invalid (looks like a Cursor key was pasted). I'll:

1. Read `supabase/functions/grok-choreography/index.ts` to confirm the secret name and fallback chain.
2. Check whether the function has a graceful degrade path when xAI rejects the key (currently it bubbles 502 — we should return a structured `{ ok: false, reason: "AI_KEY_INVALID" }` so the UI can show a friendly message instead of a generic network error).
3. Add a clear error-message branch in the function: if upstream returns 401/403 or "Incorrect API key", surface `reason: "AI_KEY_INVALID"` with HTTP 503 + actionable copy.
4. Update the calling UI (likely `src/modules/swarmgpt/...` or a Choreo panel) to render that reason as a toast: *"AI choreography service unavailable — admin must update the xAI key in Cloud secrets."*
5. Tell the user to re-add a valid `XAI_API_KEY` via the secrets panel. (I won't touch the secret itself.)

## 2. Canvas-free E2E walkthrough

Routes/flows the headless browser **can** exercise meaningfully:

| Flow | What I'll verify |
|---|---|
| **`/auth`** | Page loads, form fields have labels, submit disabled when empty, error banner on bad creds, no console errors |
| **`/office`** (or equivalent landing) | Dashboard cards render, navigation works, no 4xx/5xx in network tab |
| **`/settings`** | Tabs render, Safety Gate opt-in toggles persist, DMX budget preset selector visible |
| **Live Firing safety UI** (panel inside `/studio` shell — doesn't need 3D canvas) | Hold-to-Confirm button physics, E-STOP visible, preflight gating banner shows when not ready |

For each: smoke-screenshot → observe → interact with primary control → screenshot → console scan.

## 3. Inline polish (only if discovered during pass)
- Missing `aria-label` on icon-only buttons in audited pages
- Theme-token violations (raw hex instead of `bg-card`/`border-border`)
- Console warnings from React (key props, hydration, etc.)

Larger findings get reported, not auto-fixed, to keep the diff reviewable.

## 4. Verification before handoff
- `tsc --noEmit` clean
- `vitest run` 604+/604+ passing
- Re-run edge logs to confirm `grok-choreography` now returns the structured 503 instead of opaque 502

## Out of scope
- 3D viewport interactions (canvas unavailable in headless tool — already documented)
- The 575 `no-explicit-any` baseline at protocol boundaries
- Touching/rotating the actual `XAI_API_KEY` secret (user action required)

## Deliverables
- `supabase/functions/grok-choreography/index.ts` — graceful 503 + reason code
- 1 UI file — toast/banner for `AI_KEY_INVALID`
- E2E report with screenshots + any small fixes applied inline
- Action item for the user: rotate `XAI_API_KEY` in Cloud secrets
