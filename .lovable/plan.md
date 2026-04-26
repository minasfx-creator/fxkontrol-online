# Round 2: Lint Cleanup, Reliability Hardening & UX Micro-polish

Round 1 already fixed the 4 failing tests, the duplicate Lockstep warning, and added the Free Mode hint. **Tests 600/600 ✅, typecheck ✅, build ✅, dev-server log clean ✅, no console warnings.**

This round goes one layer deeper: **lint debt, reliability of the 15 unused-expressions (often real bugs), and small UX details.**

---

## 🐛 Real Bugs to Fix

### 1. `no-unused-expressions` (15 occurrences) — likely silent dead code
ESLint flags 15 expressions whose result is discarded. These are usually real bugs (someone wrote `foo === bar;` instead of `foo = bar;`, or `someFn?.()` was lost). I'll review each and fix the genuine ones (typically 80–100% turn out to be bugs). Files mostly in adapters/bridges.

### 2. `no-empty-object-type` (8 occurrences)
Interfaces declared as `interface X {}` (extending nothing). Either delete the empty interface or convert to `type X = ...` so it doesn't accidentally accept anything-shaped objects.

### 3. ESLint auto-fixable (24 occurrences)
Run `eslint --fix` on the safe rules only (whitespace, unused imports, prefer-const). Reviewed before committing.

---

## 🧹 `no-explicit-any` Triage (575 occurrences)

I will **NOT** blanket-fix these — many are legitimate (Web Serial DataView, worker postMessage, external SDK types). Instead:

- **Targeted pass on hot-path files** (timeline, safety, command bus, transport): replace `any` with `unknown` + type narrowing where it's actually safer.
- **Workers (`dmxTimingWorker.ts`, `videoTrackingWorker.ts`)**: keep `any` at the message boundary but document why (binary protocol, dynamic dispatch). Add `// eslint-disable-next-line @typescript-eslint/no-explicit-any -- binary protocol boundary` with reason.
- Aim: cut the 575 down to ~500 *justified* anys, not zero.

This is a multi-day refactor if done blindly, so I'll cap this round at **~50–80 of the most impactful conversions** (the ones in `src/core/safety`, `src/core/timeline`, `src/orchestration`).

---

## ✨ UI/UX Micro-polish

### 4. Settings → Segurança tab — keyboard accessibility
Verify that the master switch and 4 layer toggles are keyboard-reachable in tab order, and that the disabled toggles (when master is off) are correctly `aria-disabled`. The current code uses Radix `<Switch>` (accessible by default) — just need to confirm the `disabled` prop is wired.

### 5. LockoutPanel mobile (440×688) — verify chip wrap
The `Lockout desativado` info chip in `LockoutPanel.tsx` was added in Round 1. Confirm it doesn't overflow on the 440px viewport and the link to Settings has a ≥44px touch target.

### 6. Free Mode hint — distinguish from error/warning colors
The Round 1 hint uses `text-primary/80`. On the orange-tinted Safety background it might read as an alert. Switch to a calmer success-tinted shade (e.g. `text-emerald-400/90`) for unambiguous "all good" semantics.

---

## 📦 Bundle / Performance (informational only)

- `three-core` chunk: 230 KB gzip — already isolated; no action.
- No new perf regressions detected vs. last build.

---

## ✅ Verification Plan

1. `bunx vitest run` → expect 600 passing, 0 failing.
2. `npx tsc --noEmit` → clean.
3. `bunx eslint src --quiet` → expect 660 → ~570 (cut from `unused-expressions`, `empty-object-type`, auto-fixable, and targeted `any` pass).
4. Manual: open `/settings?tab=safety`, tab through all controls, verify focus ring + disabled state.
5. Visual diff on `LockoutPanel` at 440px.

---

## 🚫 Out of Scope (intentional)

- **Full eradication of all 575 `any`s** — would require touching 80+ files in workers/protocols and risk regressions in the binary DMX/PBUS pipeline for cosmetic gain. Better as a dedicated typed-protocol epic.
- **Adding new features** — explicitly cleanup-only this round.
- **End-to-end browser testing of all 31 routes** — better suited to a targeted session against a specific user flow (let me know which one matters most: Studio, Live Firing, Auth, AI Choreography, Office, etc.).

---

**Estimated impact:** ~10–15 files edited. Mostly fixing real bugs hidden behind `unused-expressions`, plus a small UI polish on the new Safety Gate UI.