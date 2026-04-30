# Blueprint UX — Landing → Office → Create → Editor

Implements the funnel `/landing → /office → /create → /editor/:showId` per the blueprint. Reuses the existing Studio editor, project store, and AI choreography modules — no rewrite. The `/create` Action Layer is the missing piece and the focus of this work.

## Scope (MVP 1)

1. `/create` Action Layer route with the four-card hub (blank / template / generated / imported).
2. `createShowPlan()` factory that resets the project store, seeds defaults, and returns a `showId`.
3. `/editor/:showId` route that hydrates the existing Studio (`Index.tsx`) from a created plan.
4. Segment selection step (PYRO / SFX / DRONES / LIGHT / DMX) persisted on the show.
5. Templates picker (5 starter templates, JSON-defined — no marketplace yet).
6. AI Generator Wizard (event type / scale / segments / duration) using the existing `aiChoreography/expander.ts`.
7. Segment-aware topbar in the Studio editor (chips drive `viewport-tools` registry already in place).
8. Office dashboard: replace current tabs-only landing with the blueprint hub cards (New Show / Open / Templates / Academy / Reports / Devices) above the existing tab strip.
9. Landing: add the “Como funciona” 4-step strip and make CTAs route to `/office` (logged-in) or `/auth?next=/office`.

Out of scope (deferred to MVP 2/3, as in blueprint): Digital Twin report, Marketplace, Academy content, Compliance Export.

## Routes

```text
/                  → redirect /studio (kept; default landing for logged-in)
/landing           → existing public Landing (CTA → /office)
/office            → Office hub (NEW: blueprint cards + existing tabs)
/create            → NEW: Action Layer (4 cards)
/create/blank      → NEW: segment picker + Continue
/create/template   → NEW: template gallery
/create/generate   → NEW: AI wizard
/editor/:showId    → NEW alias of /studio that hydrates by showId
/studio            → existing Index (kept as canonical viewport)
```

`/editor` (no id) keeps redirecting to `/studio` for backward compat.

## Data flow

Single new module `src/features/create-flow/createShowPlan.ts`:

```text
createShowPlan({ mode, segments?, templateId?, eventType?, scale?, duration? })
  ├─ generates showId (crypto.randomUUID)
  ├─ resets project store via useProjectStore.replaceProjectState({...})
  ├─ writes meta to localStorage: fxk:show:<id> = { mode, segments, createdAt, name }
  ├─ for "template": loads JSON from src/features/create-flow/templates/<id>.json
  ├─ for "generated": calls aiChoreography/expander.ts with the wizard inputs
  └─ returns showId → caller navigates(`/editor/${showId}`)
```

`/editor/:showId` reads `fxk:show:<id>` on mount; if missing, falls back to current store (legacy behavior). Studio reads `segments` to drive the segmented topbar.

State extension on `useProjectStore`:
- add `segments: SegmentType[]` (default `['PYRO']`) to `replaceProjectState` and as a top-level field.
- add `setSegments(s: SegmentType[])`.

## Files to create

```text
src/pages/
├─ Create.tsx                     // Action Layer hub (4 cards)
├─ create/
│  ├─ CreateBlank.tsx             // segment picker + Continue
│  ├─ CreateTemplate.tsx          // gallery grid
│  └─ CreateGenerate.tsx          // wizard (4 steps)

src/features/create-flow/
├─ createShowPlan.ts              // factory described above
├─ types.ts                       // CreateMode, ShowPlanMeta
├─ showMetaStore.ts               // localStorage helpers (fxk:show:<id>)
├─ templates/
│  ├─ index.ts                    // template registry (id → meta + loader)
│  ├─ pyro-sequence.json
│  ├─ drone-logo.json
│  ├─ light-chase.json
│  ├─ festival-full.json
│  └─ wedding-fx.json
└─ components/
   ├─ ActionCard.tsx              // reusable big card w/ icon + title + desc
   ├─ SegmentChips.tsx            // multi-select PYRO/SFX/DRONES/LIGHT/DMX
   └─ TemplateCard.tsx

src/features/office/
└─ OfficeHubCards.tsx             // 6-card hub strip rendered above current tabs
```

## Files to edit

- `src/App.tsx` — add lazy imports + 5 new routes (`/create`, `/create/blank`, `/create/template`, `/create/generate`, `/editor/:showId`).
- `src/pages/Office.tsx` — render `<OfficeHubCards />` above the tab nav; `New Show` card → `navigate('/create')`, `Open Project` → opens existing project list, others link to existing tabs.
- `src/pages/Index.tsx` — read `:showId` param, hydrate from `showMetaStore` if present, expose `segments` to the topbar.
- `src/store/useProjectStore.ts` — add `segments` field + `setSegments` + include in `replaceProjectState`.
- `src/pages/Landing.tsx` — add 4-step "Como funciona" section before pricing; wire primary CTA to `/office` (auth-gated via existing `AuthRoute`/`ProtectedRoute`).

## Editor topbar (segment-aware)

The viewport-tools registry already exists (`src/features/viewport-tools/ViewportToolPanel.tsx`). Add a thin top strip in `Index.tsx`:

```text
[ PYRO ] [ SFX ] [ DRONES ] [ LIGHT ] [ DMX ]   [ Guide ON ] [ Validate ] [ Export ]
```

- Chips reflect `segments` from the store; clicking a chip sets the active segment that `ViewportToolPanel` already consumes.
- `Guide ON` toggles a local `useProjectStore.uiHelpers` flag (already present, reused).
- `Validate` and `Export` reuse existing buttons from the current Studio header (no new logic).

## AI Generator Wizard

`CreateGenerate.tsx` — 4 sequential steps using the existing UI primitives (`Card`, `Button`, segmented chips):

1. Event type: Festival / Casamento / Arena / Corporativo
2. Scale: Pequeno / Médio / Grande
3. Segments: multi-select chips
4. Duration: 30s / 1min / 3min / Custom

`Generate Show` button → `createShowPlan({ mode: 'generated', ... })` which delegates to `src/modules/aiChoreography/expander.ts` (already implemented and used by `AIShowBuilderPanel`). On success → `navigate(\`/editor/\${showId}\`)`.

## ASCII map of the flow

```text
Landing  ──CTA──►  /auth?next=/office  ──►  /office
                                              │
                            ┌─────────────────┼─────────────────┐
                            ▼                 ▼                 ▼
                       New Show          Templates           Open
                            │                 │                 │
                            ▼                 ▼                 ▼
                        /create  ──►  /create/template ──►  picker
                            │
            ┌───────────────┼───────────────┬───────────────┐
            ▼               ▼               ▼               ▼
         blank          template        generate         import
            │               │               │               │
            └───────────────┴──► createShowPlan() ──► /editor/:showId
```

## Acceptance criteria

- From a fresh session, user can: land on `/landing`, click CTA, log in, reach `/office`, click `New Show`, choose `Generate Automatically`, run the 4-step wizard, and arrive on `/editor/<uuid>` with the Studio already populated by the AI expander.
- `Use Template` flow loads one of the 5 starter JSONs and seeds the project store atomically (no merge with prior state).
- `Blank` flow seeds an empty plan with the chosen segments and the editor topbar reflects them.
- `/editor/:showId` survives a hard reload (meta lives in `localStorage`).
- Existing routes (`/studio`, `/office?tab=...`, `/command`, `/field`) keep working unchanged.

## Non-goals

- No backend persistence in this PR (showId lives in `localStorage`); Supabase persistence stays in `useProjectPersistence` as today.
- No marketplace, no Academy content, no Digital Twin report.
- No safety/ARM changes — `createShowPlan` only writes to the design-time store; never touches `SafetyStateMachine`.
