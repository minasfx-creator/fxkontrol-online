# Round 8 — Canvas-Free E2E + Security Sweep

## Carry-forward from Round 7
- ✅ `grok-choreography` now returns structured 401/402 with actionable copy
- ⏳ User still needs to rotate `XAI_API_KEY` in Lovable Cloud → Backend → Secrets
- ✅ Tests 604/604, typecheck clean
- ⚠️ Lint: 758 issues (3 documented out-of-scope buckets — no action)

## 1. Canvas-free E2E walkthrough (headless browser)
Routes the headless tool can meaningfully exercise (no WebGL needed):

| Route | Verification |
|---|---|
| `/` (Landing) | Renders, CTA buttons present, no console errors |
| `/auth` | Form labels, disabled-when-empty submit, error banner on bad creds |
| `/office` | Dashboard cards render, nav works, no 4xx/5xx in network |
| `/settings` | Tabs render, Safety Gate opt-in toggles persist, DMX budget preset visible |
| `/pricing` | Plan cards render, CTA wired |
| `/platform-status` | Health widgets render, no failed fetches |
| `/network-settings` | Form renders, toggles persist |
| `/command-center` | Panels render, no console errors |
| `/ai-choreography` | UI renders; trigger Grok call → confirm friendly toast appears (validates Round 7 fix end-to-end) |

For each: navigate → screenshot → interact with primary control → screenshot → console+network scan.

## 2. Security & DB sweep
- `security--run_security_scan` — surface any RLS gaps or exposed-data findings
- `supabase--linter` — DB-level checks
- Triage findings: critical = fix inline (RLS, missing policies); informational = report only

## 3. Backend health check
- `supabase--cloud_status` (project_debug if needed) — confirm ACTIVE_HEALTHY before any DB ops
- Sample recent edge logs for 5xx errors across all functions
- `grok-choreography` curl with current (invalid) key → confirm structured 401, not opaque 502

## 4. Inline fixes (only if discovered)
- Missing `aria-label` on icon-only buttons in audited pages
- Theme-token violations (raw hex → semantic token)
- Console warnings (key props, hydration, missing deps with real bugs)
- Broken CTAs / dead links

Larger findings → reported, not auto-fixed (keeps diff reviewable).

## 5. Verification before handoff
- `tsc --noEmit` clean
- `vitest run` ≥604 passing
- E2E report with screenshots + per-route status
- Security findings triaged

## Out of scope
- 3D viewport interactions (canvas unavailable in headless tool — documented)
- 575 `no-explicit-any` baseline at protocol boundaries
- Rotating `XAI_API_KEY` (user action — already requested in Round 7)

## Deliverables
- E2E walkthrough report (per-route screenshots + console/network notes)
- Security scan triage summary
- Any inline UI/UX patches applied
- Confirmation that Round 7 Grok fallback works end-to-end in the UI
