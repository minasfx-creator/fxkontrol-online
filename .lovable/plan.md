# Strategic Command Hub — Round 2

Round 1 delivered the `/strategy` hub with Asset Library, AI Choreography stub, DockTwin Pilot, Client Approval and 90-Day Plan. Round 2 unlocks the **Days 16–35** roadmap items: use the Hub in real demos, generate reports, and ship a segmented public landing.

## Goals

1. **Demo Sessions** — log every time the Hub is used in front of a prospect, with audience, assets shown, objections and outcome.
2. **Client Approval Report (PDF)** — exportable artifact from `ClientApprovalPanel` (scope, version, comments, approval status, claim disclaimers).
3. **Strategy Report after each demo** — extends the existing JSON export with the demo session context and an HTML/PDF rendering for sales follow-up.
4. **Segmented Public Landing `/pitch/us`** — top-of-funnel page derived from the US Pitch Package asset, no auth, with claim-policy footer.

## What gets built

### Backend (Lovable Cloud)
- `demo_sessions` table:
  - `id, created_at, owner_id, prospect_company, prospect_audience (enterprise|producer|operator|investor), asset_ids[], objections, next_step, outcome (pending|won|lost|nurture), notes`
  - RLS: owner read/write; admin read-all (uses existing `has_role(uid,'admin')` pattern).
- `client_approvals` table:
  - `id, demo_session_id (nullable), scope, preview_version, comments_jsonb, approved boolean, approved_at, approver_email`
  - RLS: owner read/write; admin read-all.
- No new buckets; PDFs are generated client-side and downloaded directly (no storage cost, no email path here — reuse existing `send-transactional-email` only when the user explicitly clicks "Email to client" in a follow-up round).

### Frontend
- New tab in `/strategy`: **Demo Sessions** (`src/components/strategy/DemoSessionsPanel.tsx`)
  - Form: prospect, audience, assets shown (multi-select from `SEED_ASSETS`), objections, outcome
  - List of past sessions with filters
  - "Generate strategy report" per session → PDF
- `ClientApprovalPanel` extended:
  - Persists scope/version/comments/approval to `client_approvals`
  - "Export approval report (PDF)" button
- `src/lib/strategyReport.ts` — pure builder that takes `{session, assets, claims}` and produces the report data structure
- `src/lib/pdfRenderer.ts` — thin wrapper around `pdf-lib` (already lightweight) to render both report types from a shared template

### Public landing
- New route `/pitch/us` (public, no auth) — `src/pages/PitchUS.tsx`
  - Hero: "The Operating System for Massive Spectacles"
  - Three core messages
  - Asset highlights (filtered from `SEED_ASSETS` where `audience` includes `enterprise|producer|investor` and `funnel = 'top'`)
  - Claim policy footer (validated/pilot/marketing_hypothesis legend)
  - CTA → existing `/comercial#demo-form`
- Registered in `src/App.tsx` and `src/seo/publicRoutes.ts`

## Architecture notes

- PDFs generated client-side with `pdf-lib` to keep the surface dependency-free of edge functions for v1.
- Strategy export JSON (`fxkontrol.strategy.v1`) gets a new optional `session` field when exported from a demo session row.
- All claim disclaimers from `src/lib/claims.ts` are auto-attached to PDFs whenever a referenced asset has `claimStatus !== 'validated'`.
- No operational coupling: Demo Sessions and Client Approvals never touch `commandBus`, `safetyStateMachine` or hardware. Pure GTM surface (per `mem://funcionalidades/strategic-command-hub-gtm`).

## Out of scope (later rounds)

- Email-to-client of the approval PDF (Days 36–60, ties into existing `send-transactional-email`)
- AI Choreography Studio "Generate" wiring (Days 36–60)
- DockTwin live companion telemetry (Days 36–60)
- Pricing/objection analytics dashboard (Days 61–90)

## Files

**Created**
- `src/components/strategy/DemoSessionsPanel.tsx`
- `src/lib/strategyReport.ts`
- `src/lib/pdfRenderer.ts`
- `src/pages/PitchUS.tsx`

**Modified**
- `src/pages/Strategy.tsx` (new "Demo Sessions" tab)
- `src/components/strategy/ClientApprovalPanel.tsx` (persist + PDF export)
- `src/App.tsx` (`/pitch/us` route)
- `src/seo/publicRoutes.ts`
- `mem://index.md` (extend the Strategic Hub memory entry)

**Database migration**
- create `demo_sessions`, `client_approvals` with RLS policies (owner + admin pattern)
