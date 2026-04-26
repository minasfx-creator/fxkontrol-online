# Round 4 — End-to-End Audit, Cleanup & Polish

## ✅ Health Snapshot (read-only audit just performed)
- **Tests:** 604 / 604 passing (incl. the 4 new visual-regression snapshots from last round)
- **Typecheck:** clean (`tsc --noEmit`)
- **Dev-server runtime:** no errors, no warnings in log
- **ESLint:** 643 errors total — but only **~35 are actionable**; the rest are `no-explicit-any` at protocol/worker boundaries (intentional, out of scope per Round 2 policy)

Platform is healthy. This round is **pure cleanup + 1 real bug fix**, no behavior changes.

---

## 🐛 Real Bug to Fix (1)

### `no-case-declarations` in `src/core/joi/joiModes.ts:210`
A `let`/`const` inside a `switch case` without braces leaks into sibling cases — classic source of "wrong mode behavior" bugs. Wrap the case body in `{ … }` to scope the declaration.

---

## 🧹 Lint Auto-Fix Pass (~30 issues)

### `prefer-const` (24 occurrences, all `--fix`-safe)
Variables declared `let` but never reassigned across:
- `src/components/editor/SkyCanvas.tsx` (8 — the `_skyScatterUniforms_local`, `_adaptiveExposure_local`, etc.)
- `src/core/timeline/Timeline.tsx`, `src/lib/ildaParser.ts`, `src/lib/kmlParser.ts`, `src/modules/swarmgpt/**` (~16 more)

These are mechanical, zero-risk. Will run `eslint --fix` scoped to this rule only, then review the diff.

### `no-empty-object-type` (8 occurrences)
Convert empty `interface X {}` to either:
- `type X = BaseType` when extending, or
- delete entirely if unused

Files: `src/components/ui/badge.tsx`, plus 7 component prop interfaces flagged by ESLint.

---

## 🎨 UI / UX Micro-Polish

### Visual Regression Snapshot Hardening
The 3 new snapshots added last round (`EditorLayout.visual.test.tsx`) currently render components in isolation. Add **a smoke assertion** that:
1. Each snapshot contains the expected dark-mode token classes (e.g., `bg-card/85`, `text-muted-foreground`)
2. The mode chip in `ViewportBar` renders with correct `aria-label` for screen readers

This makes the snapshots **semantically meaningful**, not just structural — so a class-name refactor that breaks dark mode will fail the test with a clear message instead of a generic snapshot diff.

### `SafetyGateSettings` — confirm Round 2 polish landed correctly
Quick visual verification (read-only) that the `text-emerald-400/90` "Modo livre ativo" hint is wired to the master switch state and not stuck on.

---

## 🚫 Out of Scope (intentional)

- **Remaining 575 `no-explicit-any`** — workers, binary protocols (PBUS/DMX), Web Serial DataView. Per Round 2 policy: keep with `// eslint-disable-next-line ... -- reason` comments only when touched for other work. Not a blanket rewrite.
- **New features** — cleanup only.
- **Browser E2E testing of all 31 routes** — better as a targeted user-flow request. Let me know which flow matters most (Studio, Live Firing, Auth, AI Choreo, Office) and I'll run a focused browser pass next round.

---

## ✅ Verification Plan

1. `bunx vitest run` → expect **604 passing**, plus the new semantic assertions on the 3 visual snapshots.
2. `npx tsc --noEmit` → clean.
3. `bunx eslint src --quiet` → expect **643 → ~610** (24 `prefer-const` + 8 `empty-object-type` + 1 `no-case-declarations` resolved).
4. Manual: open `/settings?tab=safety`, toggle master switch, confirm green hint appears/disappears.

---

**Estimated impact:** ~12 files touched, all mechanical except the `joiModes.ts` switch-case scope fix (the only real bug).
